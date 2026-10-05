import type { ServiceAPI } from "@mosaic/sdk";
import { parseUsageResult, type UsageResult } from "../domain/usage";

export const usageKey = ["usage", "v2"] as const;

export async function loadUsage(service: ServiceAPI): Promise<UsageResult> {
  if (!service || typeof service.call !== "function")
    return { status: "unavailable", reason: "service-unavailable" };
  let response: unknown;
  try {
    response = await service.call("openai", "getUsage", undefined, {
      signal: AbortSignal.timeout(12000),
    });
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error ? error.code : null;
    return {
      status: "unavailable",
      reason:
        code === "SERVICE_TIMEOUT"
          ? "timeout"
          : code === "NOT_FOUND" ||
              code === "SERVICE_UNAVAILABLE" ||
              code === "SERVICE_FAILED"
            ? "service-unavailable"
            : "network",
    };
  }
  try {
    return parseUsageResult(response);
  } catch {
    return { status: "unavailable", reason: "invalid-data" };
  }
}
