import assert from "node:assert/strict";
import test from "node:test";
import { normalizeRateLimits, parseSnapshot } from "../src/domain/usage";

const now = new Date("2026-10-05T20:00:00Z");
const weekly = {
  usedPercent: 31,
  windowDurationMins: 10080,
  resetsAt: 1791600000,
};

test("uses real duration even when primary is weekly and secondary is absent", () => {
  const result = normalizeRateLimits(
    { rateLimits: { primary: weekly, secondary: null } },
    now,
  );
  assert.equal(result.windows.length, 1);
  assert.equal(result.windows[0]?.label, "Codex · Wochenlimit");
  assert.equal(result.windows[0]?.usedPercent, 31);
  assert.equal(result.updatedAt, now.toISOString());
});

test("prefers multi-bucket data without duplicating the legacy bucket", () => {
  const result = normalizeRateLimits(
    {
      rateLimits: { primary: weekly },
      rateLimitsByLimitId: {
        codex: {
          primary: { ...weekly, windowDurationMins: 300, usedPercent: 0 },
          secondary: weekly,
        },
        other: {
          limitName: "Anderes Modell",
          primary: { usedPercent: 120, resetsAt: null },
        },
      },
    },
    now,
  );
  assert.equal(result.windows.length, 3);
  assert.equal(result.windows[0]?.label, "Codex · 5-Stunden-Limit");
  assert.equal(result.windows[0]?.usedPercent, 0);
  assert.equal(result.windows[2]?.usedPercent, 100);
  assert.equal(result.windows[2]?.resetsAt, null);
});

test("missing limits are unavailable, never invented zero percent", () => {
  assert.deepEqual(normalizeRateLimits({ rateLimits: null }, now).windows, []);
  assert.throws(() =>
    normalizeRateLimits({ rateLimits: { primary: { usedPercent: null } } }),
  );
  assert.throws(() =>
    normalizeRateLimits({ rateLimits: { primary: { usedPercent: NaN } } }),
  );
  assert.throws(() =>
    normalizeRateLimits({
      rateLimits: { primary: { ...weekly, usedPercent: -1 } },
    }),
  );
});

test("validates service snapshots and rejects invalid dates, percentages and duplicate IDs", () => {
  const good = normalizeRateLimits({ rateLimits: { primary: weekly } }, now);
  assert.deepEqual(parseSnapshot(good), good);
  assert.throws(() => parseSnapshot({ ...good, updatedAt: "invalid" }));
  assert.throws(() =>
    parseSnapshot({ ...good, windows: [...good.windows, ...good.windows] }),
  );
  assert.throws(() =>
    parseSnapshot({
      ...good,
      windows: [{ ...good.windows[0], usedPercent: 101 }],
    }),
  );
});
