import { defineService } from "@mosaic/sdk/service";
import { UsageCache } from "./cache";
import { CodexUsageError, readCodexUsage } from "./codex";
import type { UsageResult } from "../src/domain/usage";

let cache: UsageCache | undefined;

export default defineService({
  start(ctx) {
    const configured = ctx.configuration.codexBin;
    if (
      configured !== undefined &&
      (typeof configured !== "string" || !configured.trim())
    )
      throw new Error("Invalid Codex executable configuration");
    const command =
      typeof configured === "string"
        ? configured
        : process.env.MOSAIC_CODEX_BIN || "codex";
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
