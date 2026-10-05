import { DashboardError } from "@mosaic/sdk";
import { parseSnapshot, type UsageSnapshot } from "../domain/usage";

export const usageKey = ["usage", "v1"] as const;

export async function loadUsage(): Promise<UsageSnapshot> {
  let response: Response;
  try {
    response = await fetch("http://127.0.0.1:4311/usage", {
      signal: AbortSignal.timeout(25000),
      cache: "no-store",
      credentials: "omit",
    });
  } catch {
    throw new DashboardError(
      "NETWORK",
      "Verbrauchsdienst nicht erreichbar. Starte im mosaic-openai-Ordner npm start.",
    );
  }
  if (!response.ok) {
    throw new DashboardError(
      "NETWORK",
      response.status === 403
        ? "Dieser Mosaic-Ursprung ist nicht freigegeben. Prüfe MOSAIC_ALLOWED_ORIGINS."
        : "Codex-Limits nicht verfügbar. Prüfe die Codex-Anmeldung (codex login).",
    );
  }
  try {
    return parseSnapshot(await response.json());
  } catch {
    throw new DashboardError(
      "VALIDATION",
      "Die Verbrauchsdaten sind ungültig. Aktualisiere den lokalen Verbrauchsdienst.",
    );
  }
}
