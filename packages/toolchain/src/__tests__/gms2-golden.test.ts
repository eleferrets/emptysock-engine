import { describe, it, expect } from "vitest";
import fs from "fs/promises";
import path from "path";
import {
  diffSnapshots,
  goldenRun,
  readAllowList,
  readSnapshot,
  writeSnapshot,
} from "./helpers/golden.js";
import {
  baselineFor,
  readBaseline,
  writeBaseline,
} from "./helpers/baseline.js";
import { projectKey } from "./helpers/fixture.js";

/**
 * Golden check of the transpiler over real projects (see helpers/golden.ts).
 *
 * `GMS2_GOLDEN_ROOTS` (path-delimited) lists project directories, each
 * holding one `.yyp`. For every project: generated-module hashes must match
 * `golden/<label>.json` except for reviewed entries in
 * `golden/allow/<label>.json`, and the `tsc --noEmit` error-line count must
 * not exceed the committed baseline.
 *
 * `GMS2_GOLDEN_UPDATE=1` rewrites the snapshots and tsc baselines after a
 * diff has been reviewed; `GMS2_GOLDEN_OUT=<dir>` keeps each project's output
 * (and its tsc error list) under `<dir>/<label>` for reading diffs.
 */
async function yypIn(dir: string): Promise<string | undefined> {
  const names = await fs.readdir(dir).catch(() => [] as string[]);
  const yyp = names.find((n) => n.endsWith(".yyp"));
  return yyp ? path.join(dir, yyp) : undefined;
}

describe("GMS2 real projects: transpiler golden output", () => {
  it("matches the reviewed golden hashes and does not exceed the tsc baseline", async () => {
    const dirs = (process.env["GMS2_GOLDEN_ROOTS"] ?? "")
      .split(path.delimiter)
      .filter(Boolean);
    if (dirs.length === 0) return;
    const update = process.env["GMS2_GOLDEN_UPDATE"] === "1";
    const keep = process.env["GMS2_GOLDEN_OUT"];
    const failures: string[] = [];
    const summary: string[] = [];
    for (const dir of dirs) {
      const yyp = await yypIn(dir);
      if (yyp === undefined) continue;
      const { label } = baselineFor(yyp);
      const { snapshot, outDir, errors } = await goldenRun(yyp);
      if (keep) {
        const dest = path.join(keep, label);
        await fs.rm(dest, { recursive: true, force: true });
        await fs.mkdir(keep, { recursive: true });
        await fs.rename(outDir, dest);
        await fs.writeFile(
          path.join(keep, `${label}.tsc.txt`),
          errors.join("\n") + "\n",
          "utf8",
        );
      } else {
        await fs.rm(outDir, { recursive: true, force: true });
      }
      const before = readSnapshot(label);
      const diff = before
        ? diffSnapshots(before, snapshot, readAllowList(label))
        : undefined;
      const base = baselineFor(yyp);
      summary.push(
        `${label}: modules=${Object.keys(snapshot.files).length} tscErrorLines=${snapshot.tscErrorLines}/${base.tscErrorLines} changed=${diff?.changed.length ?? "n/a"} added=${diff?.added.length ?? "n/a"} removed=${diff?.removed.length ?? "n/a"}`,
      );
      if (update) {
        writeSnapshot(label, snapshot);
        const all = readBaseline();
        const key = projectKey(yyp);
        all.projects[key] = { ...base, tscErrorLines: snapshot.tscErrorLines };
        writeBaseline(all);
        continue;
      }
      if (!diff) {
        failures.push(
          `${label}: no golden snapshot (run with GMS2_GOLDEN_UPDATE=1)`,
        );
        continue;
      }
      const n = diff.changed.length + diff.added.length + diff.removed.length;
      if (n > 0)
        failures.push(
          `${label}: ${diff.changed.length} changed, ${diff.added.length} added, ${diff.removed.length} removed modules not in the reviewed allow-list`,
        );
      if (snapshot.tscErrorLines > base.tscErrorLines)
        failures.push(
          `${label}: tsc error lines ${snapshot.tscErrorLines} > baseline ${base.tscErrorLines}`,
        );
    }
    console.info(`golden:\n${summary.join("\n")}`);
    expect(failures).toEqual([]);
  }, 3_600_000);
});
