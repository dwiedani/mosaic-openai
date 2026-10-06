import { test } from "node:test";
import assert from "node:assert/strict";
import { createOpenAIProvider } from "../server/ai";
test("AI provider remains opt-in and sends structured responses through a mock transport", async () => {
  assert.equal(createOpenAIProvider({}), null);
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const provider = createOpenAIProvider(
    {
      apiKey: "test",
      model: "configured-model",
      embeddingModel: "configured-embedding",
    },
    async (url, init) => {
      const body = JSON.parse(String(init?.body));
      calls.push({ url: String(url), body });
      assert.equal(
        new Headers(init?.headers).get("Authorization"),
        "Bearer test",
      );
      if (String(url).endsWith("/embeddings"))
        return Response.json({ data: [{ embedding: [0.1, 0.2] }] });
      return Response.json({
        status: "completed",
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: body.text ? '{"label":"invoice"}' : "hello",
              },
            ],
          },
        ],
      });
    },
  );
  assert.ok(provider);
  assert.equal(await provider("text-generation", { prompt: "hello" }), "hello");
  assert.equal(
    await provider("classification", {
      prompt: "classify",
      labels: ["invoice", "other"],
    }),
    "invoice",
  );
  assert.deepEqual(
    await provider("embeddings", { prompt: "embed" }),
    [0.1, 0.2],
  );
  assert.equal(calls[0]?.body.store, false);
  assert.equal(calls[0]?.body.model, "configured-model");
  assert.equal(calls[2]?.body.model, "configured-embedding");
});
test("AI provider surfaces refusals, incomplete responses and HTTP errors safely", async () => {
  for (const response of [
    Response.json({ error: "secret" }, { status: 401 }),
    Response.json({ status: "incomplete", output: [] }),
    Response.json({
      status: "completed",
      output: [
        { type: "message", content: [{ type: "refusal", refusal: "secret" }] },
      ],
    }),
  ]) {
    const provider = createOpenAIProvider(
      { apiKey: "test", model: "configured" },
      async () => response,
    );
    assert.ok(provider);
    await assert.rejects(
      provider("text-generation", { prompt: "hello" }),
      (error) => error instanceof Error && !error.message.includes("secret"),
    );
  }
});
