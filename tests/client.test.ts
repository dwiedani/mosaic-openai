import assert from "node:assert/strict";
import test from "node:test";
import type { ServiceAPI } from "@mosaic/sdk";
import { loadUsage } from "../src/services/usage";
import { parseUsageResult } from "../src/domain/usage";

function serviceWith(response: unknown, error?: { code: string }): ServiceAPI {
  return {
    async call<T>(
      app: string,
      method: string,
      input?: unknown,
      options?: { readonly signal?: AbortSignal },
    ) {
      assert.equal(app, "openai");
      assert.equal(method, "getUsage");
      assert.equal(input, undefined);
      assert.ok(options?.signal);
      if (error) throw error;
      return response as T;
    },
    async status() {
      throw new Error("unused");
    },
  };
}

test("browser reads usage via the app-scoped SDK service contract", async () => {
  const result = {
    status: "ready",
    data: { updatedAt: new Date().toISOString(), windows: [] },
  };
  assert.deepEqual(await loadUsage(serviceWith(result)), result);
  assert.deepEqual(
    await loadUsage(
      serviceWith({ status: "unavailable", reason: "codex-missing" }),
    ),
    { status: "unavailable", reason: "codex-missing" },
  );
});

test("missing runtime, transport failures and malformed output remain unavailable", async () => {
  for (const code of ["NOT_FOUND", "SERVICE_UNAVAILABLE", "SERVICE_FAILED"])
    assert.deepEqual(await loadUsage(serviceWith(null, { code })), {
      status: "unavailable",
      reason: "service-unavailable",
    });
  assert.deepEqual(await loadUsage(serviceWith(null, { code: "NETWORK" })), {
    status: "unavailable",
    reason: "network",
  });
  assert.deepEqual(
    await loadUsage(serviceWith(null, { code: "SERVICE_TIMEOUT" })),
    { status: "unavailable", reason: "timeout" },
  );
  assert.deepEqual(
    await loadUsage(serviceWith({ status: "ready", data: null })),
    { status: "unavailable", reason: "invalid-data" },
  );
  assert.throws(() =>
    parseUsageResult({ status: "unavailable", reason: "raw-secret" }),
  );
});
