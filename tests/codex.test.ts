import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readCodexUsage } from "../server/codex";

async function fakeCli(
  source: string,
  run: (command: string) => Promise<void>,
) {
  const directory = await mkdtemp(join(tmpdir(), "mosaic-openai-test-"));
  const command = join(directory, "codex.mjs");
  await writeFile(command, `#!${process.execPath}\n${source}`, { mode: 0o700 });
  try {
    await run(command);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("adapter completes initialize handshake before reading and ignores notifications", async () => {
  await fakeCli(
    `
import { createInterface } from "node:readline";
let initialized = false;
const send = x => process.stdout.write(JSON.stringify(x) + "\\n");
createInterface({ input: process.stdin }).on("line", line => {
  const request = JSON.parse(line);
  if (request.method === "initialize") send({ id: request.id, result: {} });
  if (request.method === "initialized") initialized = true;
  if (request.method === "account/rateLimits/read") {
    if (!initialized) { send({ id: request.id, error: {} }); return; }
    send({ method: "account/updated", params: {} });
    send({ id: request.id, result: { rateLimits: { primary: { usedPercent: 42, windowDurationMins: 300 } } } });
  }
});`,
    async (command) => {
      const result = await readCodexUsage(command);
      assert.equal(result.windows[0]?.usedPercent, 42);
      assert.equal(result.windows[0]?.label, "Codex · 5-Stunden-Limit");
    },
  );
});

test("adapter handles missing CLI and timeout", async () => {
  await assert.rejects(
    readCodexUsage("/nonexistent/mosaic-codex"),
    /Codex CLI fehlt/,
  );
  await fakeCli("setInterval(() => {}, 1000);", async (command) => {
    await assert.rejects(readCodexUsage(command, 100), /antwortet nicht/);
  });
});

test("raw RPC errors are never exposed", async () => {
  await fakeCli(
    `import { createInterface } from "node:readline";
createInterface({ input: process.stdin }).on("line", line => {
  const request = JSON.parse(line);
  process.stdout.write(JSON.stringify({ id: request.id, error: { message: "secret-token" } }) + "\\n");
});`,
    async (command) => {
      await assert.rejects(
        readCodexUsage(command),
        (error) =>
          error instanceof Error &&
          !error.message.includes("secret-token") &&
          error.message.includes("codex login"),
      );
    },
  );
});
