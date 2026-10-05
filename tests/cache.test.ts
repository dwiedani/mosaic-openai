import assert from "node:assert/strict";
import test from "node:test";
import { UsageCache } from "../server/cache";
import type { UsageSnapshot } from "../src/domain/usage";

const snapshot: UsageSnapshot = {
  updatedAt: new Date().toISOString(),
  windows: [],
};
const signal = () => new AbortController().signal;

test("host cache shares concurrent reads, expires after 60s and never caches failures", async () => {
  let now = 0;
  let reads = 0;
  const cache = new UsageCache(
    async () => {
      reads++;
      if (reads === 2) throw new Error("failure");
      await new Promise((resolve) => setTimeout(resolve, 5));
      return snapshot;
    },
    () => now,
  );
  try {
    assert.deepEqual(
      await Promise.all([cache.load(signal()), cache.load(signal())]),
      [snapshot, snapshot],
    );
    now = 59999;
    assert.deepEqual(await cache.load(signal()), snapshot);
    assert.equal(reads, 1);
    now = 60000;
    await assert.rejects(cache.load(signal()), /failure/);
    assert.deepEqual(await cache.load(signal()), snapshot);
    assert.equal(reads, 3);
  } finally {
    await cache.close();
  }
});

test("caller cancellation is isolated; service stop aborts and waits for the integration", async () => {
  let finish: (value: UsageSnapshot) => void = () => {};
  let integrationSignal: AbortSignal | undefined;
  const cache = new UsageCache((signal) => {
    integrationSignal = signal;
    return new Promise<UsageSnapshot>((resolve, reject) => {
      finish = resolve;
      signal.addEventListener("abort", () => reject(signal.reason), {
        once: true,
      });
    });
  });
  const caller = new AbortController();
  const cancelled = cache.load(caller.signal);
  const active = cache.load(signal());
  caller.abort();
  await assert.rejects(cancelled);
  assert.equal(integrationSignal?.aborted, false);
  finish(snapshot);
  assert.deepEqual(await active, snapshot);
  await cache.close();
  await assert.rejects(cache.load(signal()));

  const pendingCache = new UsageCache(
    (signal) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), {
          once: true,
        });
      }),
  );
  const pending = pendingCache.load(signal());
  const rejection = assert.rejects(pending);
  await pendingCache.close();
  await rejection;
});
