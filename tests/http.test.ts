import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import { request } from "node:http";
import { createUsageServer } from "../server/http";

test("bridge coalesces requests, caches reads and restricts origins, hosts and methods", async () => {
  let reads = 0;
  const snapshot = { updatedAt: new Date().toISOString(), windows: [] };
  const server = createUsageServer(async () => {
    reads++;
    await new Promise((resolve) => setTimeout(resolve, 20));
    return snapshot;
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/usage`;
  try {
    const responses = await Promise.all([fetch(url), fetch(url)]);
    for (const response of responses)
      assert.deepEqual(await response.json(), snapshot);
    assert.equal(reads, 1);
    const response = await fetch(url, {
      headers: { Origin: "http://localhost:4310" },
    });
    assert.equal(
      response.headers.get("Access-Control-Allow-Origin"),
      "http://localhost:4310",
    );
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(reads, 1);
    assert.equal(
      (await fetch(url, { headers: { Origin: "https://example.com" } })).status,
      403,
    );
    assert.equal(
      await new Promise<number | undefined>((resolve, reject) => {
        request(url, { headers: { Host: "example.com:4311" } }, (response) => {
          response.resume();
          resolve(response.statusCode);
        })
          .on("error", reject)
          .end();
      }),
      403,
    );
    assert.equal((await fetch(url, { method: "POST" })).status, 405);
    assert.equal((await fetch(url.replace("/usage", "/other"))).status, 404);
    assert.equal(
      (
        await fetch(url, {
          method: "OPTIONS",
          headers: { Origin: "http://localhost:4310" },
        })
      ).status,
      204,
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("failed reads remain errors and can be retried", async () => {
  let attempts = 0;
  const server = createUsageServer(async () => {
    attempts++;
    if (attempts === 1) throw new Error("Bitte in Codex anmelden.");
    return { updatedAt: new Date().toISOString(), windows: [] };
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/usage`;
  try {
    assert.equal((await fetch(url)).status, 503);
    assert.equal((await fetch(url)).status, 200);
    assert.equal(attempts, 2);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
