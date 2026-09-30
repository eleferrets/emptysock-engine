// Guard: the committed dist-types must equal a fresh `build:types` run after
// prettier. Lives in scripts/ (plain JS) because src/ has no node typings.
// @vitest-environment node
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { format, resolveConfig } from "prettier";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const pkgRoot = fileURLToPath(new URL("..", import.meta.url));

function listDts(dir) {
  return readdirSync(dir, { recursive: true, encoding: "utf-8" })
    .filter((f) => f.endsWith(".d.ts"))
    .sort();
}

describe("dist-types", () => {
  it("matches a fresh, prettier-formatted build:types run", async () => {
    const scratch = mkdtempSync(join(tmpdir(), "engine-dist-types-"));
    try {
      // Same flags as the package's `build:types` script, into a scratch dir.
      execFileSync(
        "node",
        [
          require.resolve("typescript/bin/tsc"),
          "-p",
          "tsconfig.types.json",
          "--emitDeclarationOnly",
          "--outDir",
          scratch,
          "--declaration",
          "--declarationMap",
          "false",
          "--skipLibCheck",
        ],
        { cwd: pkgRoot, stdio: "pipe" },
      );
      const committedDir = join(pkgRoot, "dist-types");
      const fresh = listDts(scratch);
      expect(fresh).toEqual(listDts(committedDir));
      const stale = [];
      for (const f of fresh) {
        const target = join(committedDir, f);
        const want = await format(readFileSync(join(scratch, f), "utf-8"), {
          ...(await resolveConfig(target)),
          filepath: target,
        });
        if (want !== readFileSync(target, "utf-8")) {
          stale.push(relative(pkgRoot, target));
        }
      }
      expect(
        stale,
        "dist-types is stale: run `pnpm --filter @emptysock/engine build:types`, `prettier --write packages/engine/dist-types`, and commit",
      ).toEqual([]);
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  }, 120_000);
});
