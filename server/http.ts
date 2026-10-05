import { createServer } from "node:http";
import type { UsageSnapshot } from "../src/domain/usage";

const DEFAULT_ORIGINS = ["http://127.0.0.1:4310", "http://localhost:4310"];

/** Loopback-only bridge. Share in-flight reads and cache successful snapshots for 60s. */
export function createUsageServer(
  read: () => Promise<UsageSnapshot>,
  origins = DEFAULT_ORIGINS,
) {
  let cached: UsageSnapshot | undefined;
  let cachedAt = 0;
  let pending: Promise<UsageSnapshot> | undefined;
  const load = () => {
    if (cached && Date.now() - cachedAt < 60000) return Promise.resolve(cached);
    if (!pending)
      pending = read()
        .then((snapshot) => {
          cached = snapshot;
          cachedAt = Date.now();
          return snapshot;
        })
        .finally(() => {
          pending = undefined;
        });
    return pending;
  };
  return createServer(async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("X-Content-Type-Options", "nosniff");
    // Restrict Host as well as Origin to prevent DNS rebinding of the local service.
    if (!/^127\.0\.0\.1:\d+$/.test(req.headers.host ?? "")) {
      res
        .writeHead(403)
        .end(JSON.stringify({ message: "Zugriff nicht erlaubt." }));
      return;
    }
    const origin = req.headers.origin;
    if (origin && !origins.includes(origin)) {
      res
        .writeHead(403)
        .end(JSON.stringify({ message: "Mosaic-Ursprung nicht erlaubt." }));
      return;
    }
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.setHeader("Access-Control-Allow-Private-Network", "true");
    }
    if (req.url !== "/usage") {
      res.writeHead(404).end(JSON.stringify({ message: "Nicht gefunden." }));
      return;
    }
    if (req.method === "OPTIONS") {
      res.writeHead(204).end();
      return;
    }
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET, OPTIONS");
      res
        .writeHead(405)
        .end(JSON.stringify({ message: "Methode nicht erlaubt." }));
      return;
    }
    try {
      res.end(JSON.stringify(await load()));
    } catch (error) {
      // Only adapter errors are user-facing; never send stderr, tokens or raw RPC payloads.
      res.writeHead(503).end(
        JSON.stringify({
          message:
            error instanceof Error
              ? error.message
              : "Limits konnten nicht geladen werden.",
        }),
      );
    }
  });
}
