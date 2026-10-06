import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveCodexCommand } from "../server/codex-command";

test("explicit paths take priority without silently replacing invalid paths", async () => {
  const env = { MOSAIC_CODEX_BIN: "/custom/codex", PATH: "" };
  assert.equal(
    await resolveCodexCommand("/configured/codex", { env }),
    "/configured/codex",
  );
  assert.equal(await resolveCodexCommand(undefined, { env }), "/custom/codex");
});

test("macOS discovers the app bundle, preferring an executable on PATH", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mosaic-codex-command-"));
  try {
    const bundled = join(
      directory,
      "ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex",
    );
    await mkdir(join(bundled, ".."), { recursive: true });
    await writeFile(bundled, "#!/bin/sh\n", { mode: 0o700 });
    const options = {
      env: { PATH: directory },
      platform: "darwin" as const,
      applicationDirectories: [directory],
    };
    assert.equal(await resolveCodexCommand(undefined, options), bundled);
    const cli = join(directory, "codex");
    await writeFile(cli, "#!/bin/sh\n", { mode: 0o600 });
    assert.equal(await resolveCodexCommand(undefined, options), bundled);
    await rm(cli);
    await writeFile(cli, "#!/bin/sh\n", { mode: 0o700 });
    assert.equal(await resolveCodexCommand(undefined, options), cli);
    assert.equal(
      await resolveCodexCommand(undefined, {
        ...options,
        env: { PATH: "" },
        platform: "linux",
      }),
      "codex",
    );
    await rm(bundled);
    assert.equal(
      await resolveCodexCommand(undefined, { ...options, env: { PATH: "" } }),
      "codex",
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
