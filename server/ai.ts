import {
  defineAIProvider,
  type AICapability,
  type AIRequest,
} from "@mosaic/sdk/service";
export const providerDefinition = defineAIProvider({
  id: "openai",
  capabilities: [
    "text-generation",
    "structured-output",
    "classification",
    "embeddings",
  ],
});
/** Credentials stay in the provider service. No autonomous tools or file mutation. */
export function createOpenAIProvider(
  configuration: Readonly<Record<string, unknown>>,
  fetcher: typeof fetch = fetch,
) {
  const key = configuration.apiKey;
  const model = configuration.model;
  if (typeof key !== "string" || !key || typeof model !== "string" || !model)
    return null;
  return async (
    capability: AICapability,
    request: AIRequest,
  ): Promise<unknown> => {
    const embedding = capability === "embeddings";
    const selectedModel = embedding ? configuration.embeddingModel : model;
    if (typeof selectedModel !== "string" || !selectedModel)
      throw new Error("AI model not configured");
    const classification = capability === "classification";
    const schema = classification
      ? {
          type: "object",
          properties: { label: { type: "string", enum: request.labels } },
          required: ["label"],
          additionalProperties: false,
        }
      : request.schema;
    if (
      (classification && !request.labels?.length) ||
      (capability === "structured-output" && !schema)
    )
      throw new Error("AI schema missing");
    const body = embedding
      ? { model: selectedModel, input: request.prompt }
      : {
          model: selectedModel,
          store: false,
          input: JSON.stringify({
            prompt: request.prompt,
            contextId: request.contextId ?? null,
            entities: request.entities ?? [],
          }),
          instructions:
            "Return inference only. Entity references identify the selected scope; they are not document contents. Never claim to have read their contents. Never execute actions.",
          ...(schema
            ? {
                text: {
                  format: {
                    type: "json_schema",
                    name: "mosaic_result",
                    strict: true,
                    schema,
                  },
                },
              }
            : {}),
        };
    const response = await fetcher(
      `https://api.openai.com/v1/${embedding ? "embeddings" : "responses"}`,
      {
        method: "POST",
        redirect: "error",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: request.signal
          ? AbortSignal.any([request.signal, AbortSignal.timeout(30000)])
          : AbortSignal.timeout(30000),
      },
    );
    if (!response.ok) throw new Error("AI provider request failed");
    const raw: unknown = await response.json();
    if (!raw || typeof raw !== "object") throw new Error("Invalid AI result");
    if (embedding) {
      if (!("data" in raw) || !Array.isArray(raw.data))
        throw new Error("Invalid embedding");
      const first: unknown = raw.data[0];
      if (!first || typeof first !== "object" || !("embedding" in first))
        throw new Error("Invalid embedding");
      return first.embedding;
    }
    if (
      !("output" in raw) ||
      !Array.isArray(raw.output) ||
      !("status" in raw) ||
      raw.status !== "completed"
    )
      throw new Error("Incomplete AI result");
    const text = raw.output
      .flatMap((item: unknown) => {
        if (
          !item ||
          typeof item !== "object" ||
          !("type" in item) ||
          item.type !== "message" ||
          !("content" in item) ||
          !Array.isArray(item.content)
        )
          return [];
        return item.content.flatMap((part: unknown) =>
          part &&
          typeof part === "object" &&
          "type" in part &&
          part.type === "output_text" &&
          "text" in part &&
          typeof part.text === "string"
            ? [part.text]
            : [],
        );
      })
      .join("");
    if (!text) throw new Error("Empty or refused AI result");
    if (!schema) return text;
    const parsed: unknown = JSON.parse(text);
    if (classification) {
      if (!parsed || typeof parsed !== "object" || !("label" in parsed))
        throw new Error("Invalid classification");
      return parsed.label;
    }
    return parsed;
  };
}
