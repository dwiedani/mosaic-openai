import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { normalizeRateLimits, type UsageSnapshot } from "../src/domain/usage";

/** Read quota metadata through Codex's stdio API; never read or expose token files. */
export function readCodexUsage(
  command = process.env.MOSAIC_CODEX_BIN || "codex",
  timeoutMs = 20000,
): Promise<UsageSnapshot> {
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
      lines.close();
      child.stdin.end();
      child.kill();
      const force = setTimeout(() => child.kill("SIGKILL"), 1000);
      force.unref();
      child.once("close", () => clearTimeout(force));
      if (error) reject(error);
      else if (snapshot) resolve(snapshot);
    };
    const timeout = setTimeout(
      () =>
        finish(
          new Error("Codex antwortet nicht. Bitte später erneut versuchen."),
        ),
      timeoutMs,
    );
    const send = (message: unknown) =>
      child.stdin.write(`${JSON.stringify(message)}\n`);
    child.on("error", () =>
      finish(
        new Error(
          "Codex CLI fehlt. Installiere Codex oder setze MOSAIC_CODEX_BIN.",
        ),
      ),
    );
    child.stdin.on("error", () =>
      finish(new Error("Die Verbindung zu Codex wurde unterbrochen.")),
    );
    child.on("exit", () =>
      finish(new Error("Codex wurde vor der Antwort beendet.")),
    );
    lines.on("line", (line) => {
      try {
        const message = JSON.parse(line) as {
          id?: number;
          error?: unknown;
          result?: unknown;
        };
        if (message.id !== 1 && message.id !== 2) return;
        if (message.error) {
          finish(
            new Error(
              "Limits nicht verfügbar. Melde dich in Codex mit deinem ChatGPT-Abo an (codex login).",
            ),
          );
          return;
        }
        if (message.id === 1) {
          send({ method: "initialized", params: {} });
          send({ id: 2, method: "account/rateLimits/read" });
        } else {
          finish(undefined, normalizeRateLimits(message.result));
        }
      } catch {
        finish(new Error("Codex lieferte ungültige Limitdaten."));
      }
    });
    send({
      id: 1,
      method: "initialize",
      params: {
        clientInfo: {
          name: "mosaic_openai",
          title: "Mosaic OpenAI",
          version: "1.0.0",
        },
      },
    });
  });
}
