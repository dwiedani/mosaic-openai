import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import {
  normalizeRateLimits,
  unavailableMessages,
  type UnavailableReason,
  type UsageSnapshot,
} from "../src/domain/usage";

export class CodexUsageError extends Error {
  constructor(readonly reason: UnavailableReason) {
    super(unavailableMessages[reason]);
  }
}

/** Read quota metadata through Codex's stdio API; never read or expose token files. */
export function readCodexUsage(
  command = process.env.MOSAIC_CODEX_BIN || "codex",
  timeoutMs = 8000,
  options: { readonly signal?: AbortSignal; readonly version?: string } = {},
): Promise<UsageSnapshot> {
  if (options.signal?.aborted) return Promise.reject(options.signal.reason);
  return new Promise((resolve, reject) => {
    const child = spawn(command, ["app-server"], {
      stdio: ["pipe", "pipe", "ignore"],
    });
    const lines = createInterface({ input: child.stdout });
    let settled = false;
    const finish = (error?: Error, snapshot?: UsageSnapshot) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      options.signal?.removeEventListener("abort", abort);
      lines.close();
      // Wait for the child to exit so a service stop cannot leave integration processes behind.
      child.once("close", () => {
        clearTimeout(force);
        if (error) reject(error);
        else if (snapshot) resolve(snapshot);
      });
      child.stdin.end();
      child.kill();
      const force = setTimeout(() => child.kill("SIGKILL"), 1000);
      force.unref();
    };
    const timeout = setTimeout(
      () => finish(new CodexUsageError("timeout")),
      timeoutMs,
    );
    const abort = () => finish(new CodexUsageError("connection"));
    options.signal?.addEventListener("abort", abort, { once: true });
    const send = (message: unknown) =>
      child.stdin.write(`${JSON.stringify(message)}\n`);
    child.on("error", () => finish(new CodexUsageError("codex-missing")));
    child.stdin.on("error", () => finish(new CodexUsageError("connection")));
    child.on("exit", () => finish(new CodexUsageError("connection")));
    lines.on("line", (line) => {
      try {
        const message = JSON.parse(line) as {
          id?: number;
          error?: unknown;
          result?: unknown;
        };
        if (message.id !== 1 && message.id !== 2) return;
        if (message.error) {
          finish(new CodexUsageError("login-required"));
          return;
        }
        if (message.id === 1) {
          send({ method: "initialized", params: {} });
          send({ id: 2, method: "account/rateLimits/read" });
        } else {
          finish(undefined, normalizeRateLimits(message.result));
        }
      } catch {
        finish(new CodexUsageError("invalid-data"));
      }
    });
    send({
      id: 1,
      method: "initialize",
      params: {
        clientInfo: {
          name: "mosaic_openai",
          title: "Mosaic OpenAI",
          version: options.version ?? "0.0.2",
        },
      },
    });
  });
}
