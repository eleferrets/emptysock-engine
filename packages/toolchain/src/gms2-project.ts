/**
 * Loads a GameMaker project's GML into one immutable `ProjectSymbols`: every
 * object event and script file, with asset membership taken from the
 * project's resource list (the `.yyp`, or the `objects/`/`scripts/`
 * directories when a caller has no `.yyp`). Built once per import and
 * passed to every code generator; no module-level state.
 */

import fs from "fs/promises";
import path from "path";
import {
  buildProjectSymbols,
  type ProjectInput,
  type ProjectSymbols,
  type SourceFile,
} from "./gml/project-symbols.js";
import type { AssetKind } from "./gml/symbols.js";

export type AssetLists = Partial<Record<AssetKind, readonly string[]>>;

export interface GmlProject {
  symbols: ProjectSymbols;
  /** Callable function name -> the script module (`./<module>.js`) that exports it. */
  callables: ReadonlyMap<string, string>;
  /** Frame count per sprite, so multi-frame sprite values use the `frame_{n}.png` path. */
  spriteFrames: ReadonlyMap<string, number>;
  /** Names each object reads that nothing in the project defines (source bugs), for the module header. */
  unsetVarsByObject: ReadonlyMap<string, ReadonlySet<string>>;
}

export interface LoadOptions {
  /** Asset lists from the `.yyp`; missing kinds fall back to directory listings. */
  assets?: AssetLists;
  missing?: ProjectInput["missing"];
  spriteFrames?: ReadonlyMap<string, number>;
  unsetVarsByObject?: ReadonlyMap<string, ReadonlySet<string>>;
}

async function listDirs(dir: string): Promise<string[]> {
  const entries = await fs
    .readdir(dir, { withFileTypes: true })
    .catch(() => []);
  return entries.filter((e) => e.isDirectory()).map((e) => e.name);
}

async function gmlFilesOf(dir: string): Promise<string[]> {
  const names = await fs.readdir(dir).catch(() => [] as string[]);
  return names.filter((n) => n.endsWith(".gml")).sort();
}

/** Every object event and script `.gml` of the project, as analyzer input. */
async function readSources(
  projectRoot: string,
  objects: readonly string[],
  scripts: readonly string[],
): Promise<SourceFile[]> {
  const out: SourceFile[] = [];
  for (const o of objects) {
    const dir = path.join(projectRoot, "objects", o);
    for (const f of await gmlFilesOf(dir)) {
      const text = await fs
        .readFile(path.join(dir, f), "utf8")
        .catch(() => undefined);
      if (text !== undefined)
        out.push({
          path: `objects/${o}/${f}`,
          text,
          object: o,
          kind: "object",
        });
    }
  }
  for (const s of scripts) {
    const file = path.join(projectRoot, "scripts", s, `${s}.gml`);
    const text = await fs.readFile(file, "utf8").catch(() => undefined);
    if (text !== undefined)
      out.push({ path: `scripts/${s}/${s}.gml`, text, kind: "script" });
  }
  return out;
}

/**
 * Callable project functions: a script file's top-level `function`
 * declarations, each exported by that script's module; a legacy script (no
 * `function` at all) is itself one callable named after the script.
 */
function callablesOf(
  symbols: ProjectSymbols,
  scripts: readonly string[],
): Map<string, string> {
  const out = new Map<string, string>();
  const declaring = new Set<string>();
  for (const [name, sym] of symbols.functions()) {
    const module = sym.decl?.file.split("/")[1];
    if (module === undefined) continue;
    out.set(name, module);
    declaring.add(module);
  }
  for (const s of scripts) if (!declaring.has(s)) out.set(s, s);
  return out;
}

export async function loadGmlProject(
  projectRoot: string,
  opts: LoadOptions = {},
): Promise<GmlProject> {
  const assets: Partial<Record<AssetKind, readonly string[]>> = {
    ...opts.assets,
  };
  assets.object ??= await listDirs(path.join(projectRoot, "objects"));
  assets.script ??= await listDirs(path.join(projectRoot, "scripts"));
  const objects = assets.object;
  const scripts = assets.script;
  const files = await readSources(projectRoot, objects, scripts);
  const symbols = buildProjectSymbols({
    assets,
    files,
    ...(opts.missing ? { missing: opts.missing } : {}),
  });
  return {
    symbols,
    callables: callablesOf(symbols, scripts),
    spriteFrames: opts.spriteFrames ?? new Map(),
    unsetVarsByObject: opts.unsetVarsByObject ?? new Map(),
  };
}
