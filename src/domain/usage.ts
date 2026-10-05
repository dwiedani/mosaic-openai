export interface UsageWindow {
  readonly id: string;
  readonly label: string;
  readonly usedPercent: number;
  readonly windowDurationMins: number | null;
  readonly resetsAt: number | null;
}

export interface UsageSnapshot {
  readonly updatedAt: string;
  readonly windows: readonly UsageWindow[];
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function optionalNumber(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0)
    throw new Error("Ungültige Limitdaten.");
  return value;
}

/** Labels follow the actual window duration, never the primary/secondary slot. */
export function windowLabel(minutes: number | null): string {
  if (minutes === null) return "Nutzung";
  if (minutes === 10080) return "Wochenlimit";
  if (minutes >= 1440 && minutes % 1440 === 0)
    return `${minutes / 1440}-Tage-Limit`;
  if (minutes >= 60 && minutes % 60 === 0)
    return `${minutes / 60}-Stunden-Limit`;
  return `${minutes}-Minuten-Limit`;
}

/** Normalize documented Codex responses, preferring the multi-bucket view. */
export function normalizeRateLimits(
  input: unknown,
  now = new Date(),
): UsageSnapshot {
  const response = record(input);
  if (!response) throw new Error("Ungültige Limitdaten.");
  const byId = record(response.rateLimitsByLimitId);
  const legacy = record(response.rateLimits);
  const buckets =
    byId && Object.keys(byId).length
      ? Object.entries(byId)
      : legacy
        ? [
            [
              typeof legacy.limitId === "string" ? legacy.limitId : "codex",
              legacy,
            ] as const,
          ]
        : [];
  const windows: UsageWindow[] = [];
  for (const [bucketId, raw] of buckets) {
    const bucket = record(raw);
    if (!bucket) throw new Error("Ungültige Limitdaten.");
    const bucketName =
      typeof bucket.limitName === "string" && bucket.limitName
        ? bucket.limitName
        : bucketId === "codex"
          ? "Codex"
          : bucketId;
    for (const slot of ["primary", "secondary"] as const) {
      if (bucket[slot] == null) continue;
      const window = record(bucket[slot]);
      if (
        !window ||
        typeof window.usedPercent !== "number" ||
        !Number.isFinite(window.usedPercent) ||
        window.usedPercent < 0
      )
        throw new Error("Ungültige Limitdaten.");
      const minutes = optionalNumber(window.windowDurationMins);
      windows.push({
        id: `${bucketId}:${slot}`,
        label: `${bucketName} · ${windowLabel(minutes)}`,
        usedPercent: Math.min(100, window.usedPercent),
        windowDurationMins: minutes,
        resetsAt: optionalNumber(window.resetsAt),
      });
    }
  }
  return { updatedAt: now.toISOString(), windows };
}

/** Validate the local bridge response before it enters the shared query cache. */
export function parseSnapshot(input: unknown): UsageSnapshot {
  const data = record(input);
  if (
    !data ||
    typeof data.updatedAt !== "string" ||
    !Number.isFinite(Date.parse(data.updatedAt)) ||
    !Array.isArray(data.windows)
  )
    throw new Error("Ungültige Verbrauchsdaten.");
  const ids = new Set<string>();
  const windows = data.windows.map((raw): UsageWindow => {
    const window = record(raw);
    if (
      !window ||
      typeof window.id !== "string" ||
      ids.has(window.id) ||
      typeof window.label !== "string" ||
      typeof window.usedPercent !== "number" ||
      !Number.isFinite(window.usedPercent) ||
      window.usedPercent < 0 ||
      window.usedPercent > 100
    )
      throw new Error("Ungültige Verbrauchsdaten.");
    ids.add(window.id);
    return {
      id: window.id,
      label: window.label,
      usedPercent: window.usedPercent,
      windowDurationMins: optionalNumber(window.windowDurationMins),
      resetsAt: optionalNumber(window.resetsAt),
    };
  });
  return { updatedAt: data.updatedAt, windows };
}
