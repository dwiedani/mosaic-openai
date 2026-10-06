import { createOpenAIProvider, providerDefinition } from "./ai";
import {
  codexAIAvailable,
  codexProviderDefinition,
  createCodexAIProvider,
} from "./codex-ai";
import { defineService } from "@mosaic/sdk/service";
import { UsageCache } from "./cache";
import { CodexUsageError, readCodexUsage } from "./codex";
import { resolveCodexCommand } from "./codex-command";
import type { UsageResult } from "../src/domain/usage";

let cache: UsageCache | undefined;

export default defineService({
  async start(ctx) {
    const ai = createOpenAIProvider(ctx.configuration);
    if (ai)
      ctx.registerAIProvider(
        {
          ...providerDefinition,
          capabilities: providerDefinition.capabilities.filter(
            (capability) =>
              capability !== "embeddings" ||
              typeof ctx.configuration.embeddingModel === "string",
          ),
        },
        (capability, request) => ai(capability, request),
      );
    const configured = ctx.configuration.codexBin;
    if (
      configured !== undefined &&
      (typeof configured !== "string" || !configured.trim())
    )
      throw new Error("Invalid Codex executable configuration");
    const command = await resolveCodexCommand(configured);
    if (
      await codexAIAvailable(command, {
        version: ctx.app.version,
        signal: ctx.signal,
      })
    ) {
      const codex = createCodexAIProvider(command, {
        version: ctx.app.version,
        signal: ctx.signal,
        model:
          typeof ctx.configuration.codexModel === "string"
            ? ctx.configuration.codexModel
            : undefined,
      });
      ctx.registerAIProvider(codexProviderDefinition, codex);
      ctx.logging.info("codex_ai_provider_registered");
    }
    cache = new UsageCache((signal) =>
      readCodexUsage(command, 8000, { signal, version: ctx.app.version }),
    );
    ctx.logging.info("usage_service_started");
  },
  methods: {
    getUsage: {
      async handler(ctx, input): Promise<UsageResult> {
        if (input != null) throw new Error("getUsage accepts no input");
        if (!cache)
          return { status: "unavailable", reason: "service-unavailable" };
        try {
          return { status: "ready", data: await cache.load(ctx.signal) };
        } catch (error) {
          ctx.signal.throwIfAborted();
          return {
            status: "unavailable",
            reason:
              error instanceof CodexUsageError ? error.reason : "connection",
          };
        }
      },
    },
  },
  async stop() {
    await cache?.close();
    cache = undefined;
  },
});
