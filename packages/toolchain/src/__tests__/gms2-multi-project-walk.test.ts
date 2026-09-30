import { describe, it, expect } from "vitest";
import fs from "fs/promises";
import path from "path";
import { walkProject, formatWalk, walkCounts } from "./helpers/walkProject.js";
import { baselineFor } from "./helpers/baseline.js";

/**
 * Data-driven walk over every real GameMaker project found on disk.
 * `GMS2_WALK_ROOTS` (path-delimited) lists directories searched (depth <= 3)
 * for `.yyp` files; `GMS2_WALK_ONLY` optionally filters by substring.
 * `GMS2_WALK_FRAMES` overrides the 600-frame default and
 * `GMS2_WALK_OUT` is a directory that receives one report per project
 * (plus the kept importer output when `GMS2_WALK_KEEP=1`, for a tsc sweep).
 * Skips honestly when no roots are configured or present.
 *
 * Fails when a project has more module load failures, handler errors or
 * room throws than its committed baseline (`golden/baseline.json`, target
 * zero); an unknown project must be clean. Per-project counts are printed.
 */
async function findYyps(root: string, depth = 0): Promise<string[]> {
  const out: string[] = [];
  const entries = await fs
    .readdir(root, { withFileTypes: true })
    .catch(() => []);
  for (const e of entries) {
    const p = path.join(root, e.name);
    if (e.isFile() && e.name.endsWith(".yyp")) out.push(p);
    else if (e.isDirectory() && depth < 3 && !e.name.startsWith("_"))
      out.push(...(await findYyps(p, depth + 1)));
  }
  return out;
}

describe("GMS2 real projects: multi-project room walk", () => {
  it("imports every project, loads every module and runs every room within its baseline", async () => {
    const roots = (process.env["GMS2_WALK_ROOTS"] ?? "")
      .split(path.delimiter)
      .filter(Boolean);
    const only = process.env["GMS2_WALK_ONLY"];
    const yyps: string[] = [];
    for (const r of roots) yyps.push(...(await findYyps(r)));
    const chosen = yyps.filter((y) => only === undefined || y.includes(only));
    if (chosen.length === 0) return;
    const frames = Number(process.env["GMS2_WALK_FRAMES"] ?? "600");
    const outRoot = process.env["GMS2_WALK_OUT"];
    if (outRoot) await fs.mkdir(outRoot, { recursive: true });

    const failures: string[] = [];
    const summary: string[] = [];
    for (const yyp of chosen) {
      const w = await walkProject(yyp, {
        frames,
        keepOutDir: process.env["GMS2_WALK_KEEP"] === "1" && !!outRoot,
      });
      const base = baselineFor(yyp);
      const counts = walkCounts(w);
      const label = base.label;
      summary.push(
        `${label}: rooms=${w.results.length} loadFailures=${counts.loadFailures}/${base.loadFailures} handlerErrors=${counts.handlerErrors}/${base.handlerErrors} thrown=${counts.thrown} importError=${w.importError === null ? "no" : "YES"}`,
      );
      const report = `# ${yyp}\nimportError=${w.importError ?? "none"} warnings=${w.importWarnings.length} skipped=${w.skipped} rooms=${w.results.length}\n${w.importWarnings.map((x) => `  warn: ${x}`).join("\n")}\n${formatWalk(w)}\n`;
      if (outRoot) {
        const tag = path.relative(path.dirname(path.dirname(yyp)), yyp);
        const file = tag.replace(/[^\w.-]+/g, "_");
        await fs.writeFile(path.join(outRoot, `${file}.txt`), report, "utf8");
        if (process.env["GMS2_WALK_KEEP"] === "1")
          await fs
            .rename(w.outDir, path.join(outRoot, `${file}.out`))
            .catch(() => undefined);
      }
      if (w.importError !== null)
        failures.push(`${label}: import: ${w.importError}`);
      for (const r of w.results) {
        if (r.thrown !== null)
          failures.push(`${label}/${r.room}: ${r.thrown.split("\n")[0]}`);
      }
      if (counts.loadFailures > base.loadFailures)
        failures.push(
          `${label}: ${counts.loadFailures} module load failures (baseline ${base.loadFailures}): ${w.loadFailures.join(" | ")}`,
        );
      if (counts.handlerErrors > base.handlerErrors)
        failures.push(
          `${label}: ${counts.handlerErrors} handler errors (baseline ${base.handlerErrors}): ${w.results
            .flatMap((r) => Object.keys(r.handlerErrors))
            .join(" | ")}`,
        );
    }
    console.info(`multi-project walk:\n${summary.join("\n")}`);
    expect(failures).toEqual([]);
  }, 3_600_000);
});
