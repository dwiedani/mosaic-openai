import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile, readFile, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ServiceContext, AIProviderDefinition } from "@mosaic/sdk/service";
import service from "../server/service";
import {
  codexAIAvailable,
  createCodexAIProvider,
  codexProviderDefinition,
} from "../server/codex-ai";

async function fakeCodex(
  mode: string,
  run: (command: string, trace: string) => Promise<void>,
) {
  const directory = await mkdtemp(join(tmpdir(), "mosaic-codex-ai-test-"));
  const command = join(directory, "codex.mjs");
  const trace = join(directory, "trace.jsonl");
  await writeFile(
    command,
    `#!${process.execPath}
import { createInterface } from 'node:readline';
import { appendFileSync } from 'node:fs';
const mode = ${JSON.stringify(mode)};
const trace = ${JSON.stringify(trace)};
appendFileSync(trace, JSON.stringify({pid: process.pid, cwd: process.cwd(), args: process.argv.slice(2)})+'\\n');
if (mode === 'hang') process.on('SIGTERM', () => {});
const send = message => process.stdout.write(JSON.stringify(message)+'\\n');
let initialized = false;
createInterface({input:process.stdin}).on('line', line => {
 const request = JSON.parse(line);
 appendFileSync(trace, line+'\\n');
 if (mode === 'hang') return;
 if (mode === 'rpc-error') return send({id:request.id,error:{message:'secret-token'}});
 if (request.method === 'initialize') send({id:request.id,result:{}});
 if (request.method === 'initialized') initialized=true;
 if (request.method === 'account/read') send({id:request.id,result:{account:mode === 'logged-out'?null:{type:mode==='api-key'?'apiKey':'chatgpt'}}});
 if (request.method === 'config/read') send({id:request.id,result:{config:{mcp_servers:{private_tools:{}},plugins:{'my-plugin@example':{enabled:true}}}}});
 if (request.method === 'thread/start') {
  if (!initialized) return send({id:request.id,error:{}});
  send({id:request.id,result:{thread:{id:'thread-test'}}});
 }
 if (request.method === 'turn/start') {
  send({id:request.id,result:{turn:{id:'turn-test'}}});
  if (mode === 'approval') return send({id:10,method:'item/commandExecution/requestApproval',params:{}});
  if (mode === 'tool') return send({method:'item/started',params:{threadId:'thread-test',item:{type:'commandExecution',id:'unsafe'}}});
  send({method:'item/completed',params:{threadId:'different-thread',item:{type:'agentMessage',id:'other',text:'ignore me'}}});
  send({method:'item/completed',params:{threadId:'thread-test',item:{type:'agentMessage',id:'comment',phase:'commentary',text:'Thinking...'}}});
  if (mode !== 'empty') send({method:'item/completed',params:{threadId:'thread-test',item:{type:'agentMessage',id:'answer',phase:'final_answer',text:request.params.outputSchema?(mode==='bad-json'?'oops':mode==='bad-label'?'{"label":"invalid"}':'{"label":"invoice"}'):'MOSAIC_CODEX_OK'}}});
  send({method:'turn/completed',params:{threadId:'thread-test',turn:{id:'turn-test',status:mode==='failed'?'failed':'completed'}}});
 }
});
`,
    { mode: 0o700 },
  );
  try {
    await run(command, trace);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("Codex registration probe requires ChatGPT login and never starts inference", async () => {
  for (const mode of ["ready", "logged-out", "api-key", "rpc-error"]) {
    await fakeCodex(mode, async (command, trace) => {
      assert.equal(await codexAIAvailable(command), mode === "ready");
      assert.ok(!(await readFile(trace, "utf8")).includes("thread/start"));
    });
  }
  assert.equal(await codexAIAvailable("/nonexistent/mosaic-codex"), false);
});

test("Mosaic service registers Codex without API credentials and remains usable when logged out", async () => {
  for (const mode of ["ready", "logged-out"]) {
    await fakeCodex(mode, async (command) => {
      const providers: AIProviderDefinition[] = [];
      const ctx: ServiceContext = {
        app: { id: "openai", version: "0.0.4" },
        configuration: { codexBin: command },
        signal: new AbortController().signal,
        kind: "system",
        registerAIProvider: (definition) => {
          providers.push(definition);
          return () => {};
        },
        storage: {
          get: async () => null,
          set: async () => {},
          remove: async () => {},
        },
        logging: { info: () => {}, error: () => {} },
        events: { emit: async () => {}, subscribe: () => () => {} },
        dataBus: {
          publish: () => {
            throw new Error("Unexpected event");
          },
          subscribe: () => () => {},
          unsubscribe: (subscription) => subscription(),
        },
      };
      try {
        await service.start?.(ctx);
        assert.deepEqual(
          providers.map((provider) => provider.id),
          mode === "ready" ? ["codex"] : [],
        );
      } finally {
        await service.stop?.(ctx);
      }
    });
  }
});

test("Codex inference preserves scope and disables host tools in an ephemeral read-only thread", async () => {
  await fakeCodex("ready", async (command, trace) => {
    const provider = createCodexAIProvider(command, {
      model: "host-configured-model",
    });
    const entities = [{ appId: "mosaic-files", type: "file", id: "file_123" }];
    assert.equal(
      await provider("text-generation", {
        prompt: "hello",
        contextId: "context-test",
        entities,
      }),
      "MOSAIC_CODEX_OK",
    );
    const entries = (await readFile(trace, "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    const start = entries.find(
      (entry) => entry.method === "thread/start",
    ).params;
    assert.equal(start.ephemeral, true);
    assert.equal(start.sandbox, "read-only");
    assert.equal(start.approvalPolicy, "untrusted");
    assert.equal(start.model, "host-configured-model");
    assert.equal(start.config["features.shell_tool"], false);
    assert.equal(start.config["features.apps"], false);
    assert.equal(start.config["features.hooks"], false);
    assert.equal(start.config["mcp_servers.private_tools.enabled"], false);
    assert.equal(start.config["plugins.my-plugin@example.enabled"], false);
    assert.equal(start.config["agents.enabled"], false);
    const turn = entries.find((entry) => entry.method === "turn/start").params;
    assert.deepEqual(JSON.parse(turn.input[0].text), {
      prompt: "hello",
      contextId: "context-test",
      entities,
    });
    assert.equal(start.cwd, entries[0].cwd);
    await assert.rejects(access(start.cwd));
    assert.throws(() => process.kill(entries[0].pid, 0));
  });
});

test("Codex handles structured output and classification but never advertises embeddings", async () => {
  await fakeCodex("ready", async (command) => {
    const provider = createCodexAIProvider(command);
    const schema = {
      type: "object",
      properties: { label: { type: "string" } },
      required: ["label"],
      additionalProperties: false,
    };
    assert.deepEqual(
      await provider("structured-output", { prompt: "classify", schema }),
      { label: "invoice" },
    );
    assert.equal(
      await provider("classification", {
        prompt: "classify",
        labels: ["invoice", "other"],
      }),
      "invoice",
    );
    assert.ok(!codexProviderDefinition.capabilities.includes("embeddings"));
    await assert.rejects(
      provider("embeddings", { prompt: "embed" }),
      /Capability/,
    );
    await assert.rejects(
      provider("structured-output", { prompt: "missing schema" }),
      /schema/,
    );
    await assert.rejects(
      provider("classification", { prompt: "missing labels" }),
      /schema/,
    );
  });
});

test("Codex rejects tool requests, failed turns, empty results and invalid structured output without exposing RPC details", async () => {
  for (const mode of [
    "approval",
    "tool",
    "failed",
    "empty",
    "rpc-error",
    "bad-json",
    "bad-label",
  ]) {
    await fakeCodex(mode, async (command) => {
      await assert.rejects(
        createCodexAIProvider(command)("classification", {
          prompt: "classify",
          labels: ["invoice"],
        }),
        (error) =>
          error instanceof Error && !error.message.includes("secret-token"),
      );
    });
  }
});

test("Codex times out and cancellation reaps even an uncooperative child", async () => {
  await fakeCodex("hang", async (command, trace) => {
    await assert.rejects(
      createCodexAIProvider(command, { timeoutMs: 1000 })("text-generation", {
        prompt: "hello",
      }),
      /rechtzeitig/,
    );
    const entries = (await readFile(trace, "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    assert.throws(() => process.kill(entries[0].pid, 0));
    await assert.rejects(access(entries[0].cwd));
  });
  await fakeCodex("hang", async (command, trace) => {
    const controller = new AbortController();
    const pending = createCodexAIProvider(command, {
      signal: controller.signal,
    })("text-generation", { prompt: "hello" });
    const rejected = assert.rejects(pending, /abgebrochen/);
    let pid = 0;
    for (let attempt = 0; attempt < 100; attempt++) {
      try {
        pid = JSON.parse(
          (await readFile(trace, "utf8")).split("\n")[0] ?? "",
        ).pid;
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }
    assert.ok(pid);
    controller.abort();
    await rejected;
    assert.throws(() => process.kill(pid, 0));
  });
});
