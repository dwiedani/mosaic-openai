import { access, constants } from "node:fs/promises";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";

/** Explicit configuration wins; otherwise prefer the CLI on PATH. */
export async function resolveCodexCommand(
  configured?: string,
  options: {
    env?: NodeJS.ProcessEnv;
    platform?: NodeJS.Platform;
    applicationDirectories?: readonly string[];
  } = {},
): Promise<string> {
  const env = options.env ?? process.env;
  if (configured !== undefined) return configured;
  if (env.MOSAIC_CODEX_BIN) return env.MOSAIC_CODEX_BIN;

  const platform = options.platform ?? process.platform;
  // On Windows, let spawn apply the native executable lookup rules.
  if (platform === "win32") return "codex";
  const candidates = (env.PATH ?? "")
    .split(delimiter)
    .filter(Boolean)
    .map((directory) => join(directory, "codex"));
  if (platform === "darwin") {
    for (const directory of options.applicationDirectories ?? [
      "/Applications",
      join(homedir(), "Applications"),
    ]) {
      candidates.push(
        join(
          directory,
          "ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex",
        ),
      );
    }
  }
  for (const candidate of candidates) {
    try {
      await access(candidate, constants.X_OK);
      return candidate;
    } catch {
      // Continue searching when a candidate is absent or not executable.
    }
  }
  return "codex";
}
