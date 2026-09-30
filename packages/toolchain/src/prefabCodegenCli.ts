import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type {
  ComponentDef,
  ComponentLookup,
  PrefabFile,
  PrefabFileV1,
} from "@emptysock/engine";
import * as EngineComponents from "@emptysock/engine";
import { generatePrefabTypes } from "./prefabCodegen.js";

/**
 * The `emptysock-toolchain codegen-prefabs <project-dir>` build step
 * (`cli.ts`) — the follow-up `prefabCodegen.ts`'s own doc comment and
 * CLAUDE.md's "Prefab `.d.ts` codegen lives in toolchain, not the engine"
 * entry both used to flag as not-yet-wired. Split out of `cli.ts` itself so
 * it's testable without spawning the built `dist/cli.js` binary or
 * importing a module that calls `program.parseAsync(process.argv)` as a
 * side effect on import.
 *
 * Scans `projectDir` for every `*.prefab.json` file, builds a
 * `ComponentLookup` seeded from every `ComponentDef` `@emptysock/engine`
 * exports (its built-in components — `Transform`, `Sprite`, `PhysicsBody`,
 * …) merged with whatever `ComponentDef`s the caller's own
 * `componentModules` export, and writes `generatePrefabTypes`'s output to
 * disk. A real game's own custom components live in the game's own
 * compiled JS, which this CLI has no way to discover on its own — the
 * caller points at those modules explicitly via `componentModules`.
 */

export interface CodegenPrefabsOptions {
  /** Output `.d.ts` path. Defaults to `<projectDir>/prefabs.generated.d.ts`. */
  readonly out?: string;
  /** Extra compiled JS module paths whose `ComponentDef` exports register the project's own components. */
  readonly componentModules?: readonly string[];
}

export type CodegenPrefabsResult =
  | {
      readonly ok: true;
      readonly outPath: string;
      readonly prefabCount: number;
    }
  | { readonly ok: false; readonly error: string };

/** Recursively finds every `*.prefab.json` under `dir`, skipping `node_modules`/`dist`. */
export function findPrefabFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === "dist") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findPrefabFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".prefab.json")) {
      results.push(full);
    }
  }
  return results;
}

/** Structural check — a `ComponentDef` is any object with a string `componentName` and a function `createDefaults`, the same shape `Component.ts`'s `ComponentDef` interface declares. */
export function isComponentDef(value: unknown): value is ComponentDef {
  if (value === null || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v["componentName"] === "string" &&
    typeof v["createDefaults"] === "function"
  );
}

/** Builds a `Record<componentName, ComponentDef>` from every engine built-in plus every `componentModules` entry's exports. */
export async function buildComponentRegistry(
  componentModules: readonly string[] = [],
): Promise<Record<string, ComponentDef>> {
  const registry: Record<string, ComponentDef> = {};
  for (const value of Object.values(EngineComponents)) {
    if (isComponentDef(value)) registry[value.componentName] = value;
  }
  for (const modulePath of componentModules) {
    const resolved = path.resolve(modulePath);
    const mod: unknown = await import(pathToFileURL(resolved).href);
    for (const value of Object.values(mod as Record<string, unknown>)) {
      if (isComponentDef(value)) registry[value.componentName] = value;
    }
  }
  return registry;
}

/**
 * Runs the full codegen step against `projectDir`: finds every
 * `*.prefab.json`, resolves components, calls `generatePrefabTypes`, and
 * writes the result to disk. Returns `{ ok: true, prefabCount: 0 }` (no
 * file written) when the project has no `.prefab.json` files — that's not
 * an error, just nothing to generate.
 */
export async function runCodegenPrefabs(
  projectDir: string,
  options: CodegenPrefabsOptions = {},
): Promise<CodegenPrefabsResult> {
  const prefabPaths = findPrefabFiles(projectDir);
  if (prefabPaths.length === 0) {
    return {
      ok: true,
      outPath: options.out ?? path.join(projectDir, "prefabs.generated.d.ts"),
      prefabCount: 0,
    };
  }

  const files: (PrefabFile | PrefabFileV1)[] = prefabPaths.map(
    (p) => JSON.parse(fs.readFileSync(p, "utf8")) as PrefabFile | PrefabFileV1,
  );

  const registry = await buildComponentRegistry(options.componentModules);
  const lookup: ComponentLookup = (name) => registry[name];

  let dts: string;
  try {
    dts = generatePrefabTypes(files, lookup);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  const outPath =
    options.out ?? path.join(projectDir, "prefabs.generated.d.ts");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, dts, "utf8");

  return { ok: true, outPath, prefabCount: files.length };
}
