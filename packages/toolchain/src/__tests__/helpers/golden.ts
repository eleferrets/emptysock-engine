import { execFile } from "child_process";
import { createHash } from "crypto";
import fs from "fs/promises";
import { existsSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { promisify } from "util";
import { importGMS2Project } from "../../gms2-import.js";

/**
 * Golden harness for the GML transpiler: imports a real project, hashes
 * every generated TypeScript module and runs `tsc --noEmit` over the
 * output. Only hashes and counts are committed (`golden/<label>.json`), never
 * project text; readable diffs come from keeping two runs' output in a
 * scratch directory (`GMS2_GOLDEN_OUT`) and diffing them there.
 */

export interface GoldenSnapshot {
  /** sha256(relative path) -> sha256(content), generated `.ts` modules only. */
  files: Record<string, string>;
  tscErrorLines: number;
  /** Error count per TypeScript diagnostic code. */
  tscCodes: Record<string, number>;
}

/** A reviewed change: file `path` may now hash to `to` (both hashed). */
export interface GoldenAllowEntry {
  path: string;
  to: string;
  reason: string;
}

export interface GoldenDiff {
  changed: string[];
  added: string[];
  removed: string[];
}

const GOLDEN_DIR = path.join(__dirname, "..", "golden");

export function sha(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

export function snapshotPath(label: string): string {
  return path.join(GOLDEN_DIR, `${label}.json`);
}

export function allowPath(label: string): string {
  return path.join(GOLDEN_DIR, "allow", `${label}.json`);
}

export function readSnapshot(label: string): GoldenSnapshot | undefined {
  const p = snapshotPath(label);
  return existsSync(p)
    ? (JSON.parse(readFileSync(p, "utf8")) as GoldenSnapshot)
    : undefined;
}

export function writeSnapshot(label: string, s: GoldenSnapshot): void {
  const sorted = Object.fromEntries(
    Object.entries(s.files).sort(([a], [b]) => a.localeCompare(b)),
  );
  const codes = Object.fromEntries(
    Object.entries(s.tscCodes).sort(([a], [b]) => a.localeCompare(b)),
  );
  writeFileSync(
    snapshotPath(label),
    JSON.stringify({ ...s, files: sorted, tscCodes: codes }, null, 2) + "\n",
    "utf8",
  );
}

export function readAllowList(label: string): GoldenAllowEntry[] {
  const p = allowPath(label);
  return existsSync(p)
    ? (JSON.parse(readFileSync(p, "utf8")) as GoldenAllowEntry[])
    : [];
}

/** Every generated `.ts` module under `outDir`, keyed by relative path. */
async function collectModules(outDir: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  async function walk(dir: string): Promise<void> {
    for (const e of await fs.readdir(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) await walk(p);
      else if (e.name.endsWith(".ts"))
        out.set(path.relative(outDir, p), await fs.readFile(p, "utf8"));
    }
  }
  await walk(outDir);
  return out;
}

const TSCONFIG = {
  compilerOptions: {
    target: "ES2022",
    lib: ["ES2023", "DOM"],
    module: "ESNext",
    moduleResolution: "Bundler",
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    types: [],
  },
  include: ["**/*.ts"],
};

/** Runs `tsc --noEmit` over an import output directory; returns the error lines. */
export async function tscErrors(outDir: string): Promise<string[]> {
  await fs.writeFile(
    path.join(outDir, "tsconfig.json"),
    JSON.stringify(TSCONFIG),
    "utf8",
  );
  const tsc = path.join(
    __dirname,
    "..",
    "..",
    "..",
    "node_modules",
    ".bin",
    "tsc",
  );
  const run = promisify(execFile);
  const text = await run(tsc, ["-p", outDir, "--pretty", "false"], {
    maxBuffer: 256 * 1024 * 1024,
  }).then(
    (r) => r.stdout,
    (err: { stdout?: string }) => err.stdout ?? "",
  );
  return text.split("\n").filter((l) => /error TS\d+/.test(l));
}

/**
 * Imports `yyp` into a fresh directory under the package's scratch root
 * (so the generated modules resolve `@emptysock/engine`), then snapshots it.
 * The output directory is returned for the caller to keep or delete.
 */
export async function goldenRun(
  yyp: string,
): Promise<{ snapshot: GoldenSnapshot; outDir: string; errors: string[] }> {
  const scratchRoot = path.join(__dirname, "..", "..", "..", ".gms2-smoke-tmp");
  await fs.mkdir(scratchRoot, { recursive: true });
  const outDir = await fs.mkdtemp(path.join(scratchRoot, "gms2-golden-"));
  await importGMS2Project(yyp, outDir);
  const modules = await collectModules(outDir);
  const files: Record<string, string> = {};
  for (const [rel, text] of modules) files[sha(rel)] = sha(text);
  const errors = await tscErrors(outDir);
  const tscCodes: Record<string, number> = {};
  for (const l of errors) {
    const code = /error (TS\d+)/.exec(l)?.[1] ?? "TS?";
    tscCodes[code] = (tscCodes[code] ?? 0) + 1;
  }
  return {
    snapshot: { files, tscErrorLines: errors.length, tscCodes },
    outDir,
    errors,
  };
}

/** File-level differences not covered by the reviewed allow-list. */
export function diffSnapshots(
  before: GoldenSnapshot,
  after: GoldenSnapshot,
  allow: readonly GoldenAllowEntry[],
): GoldenDiff {
  const allowed = new Set(allow.map((a) => `${a.path}:${a.to}`));
  const changed: string[] = [];
  const added: string[] = [];
  for (const [p, h] of Object.entries(after.files)) {
    const old = before.files[p];
    if (old === undefined) {
      if (!allowed.has(`${p}:${h}`)) added.push(p);
    } else if (old !== h && !allowed.has(`${p}:${h}`)) changed.push(p);
  }
  const removed = Object.keys(before.files).filter(
    (p) => after.files[p] === undefined && !allowed.has(`${p}:removed`),
  );
  return { changed, added, removed };
}
