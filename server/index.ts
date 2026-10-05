import { readCodexUsage } from "./codex";
import { createUsageServer } from "./http";

const origins = process.env.MOSAIC_ALLOWED_ORIGINS?.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const server = createUsageServer(readCodexUsage, origins);
server.on("error", () => {
  console.error(
    "Verbrauchsdienst konnte nicht starten. Ist Port 4311 bereits belegt?",
  );
  process.exitCode = 1;
});
server.listen(4311, "127.0.0.1", () =>
  console.info("OpenAI-Verbrauchsdienst: http://127.0.0.1:4311/usage"),
);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => server.close());
