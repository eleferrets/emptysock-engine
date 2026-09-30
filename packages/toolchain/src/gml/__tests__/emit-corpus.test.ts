import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseSync } from "rolldown/utils";
import { emitEvent, emitScript } from "../emit/index.js";
import { buildProjectSymbols, type SourceFile } from "../project-symbols.js";
import type { AssetKind } from "../symbols.js";
import { fixtureYyp, yypResources } from "../../__tests__/helpers/fixture.js";

/**
 * Emits every `.gml` file of the real project in `GMS_FIXTURE_DIR` with the
 * AST emitter and parses the result with the module loader's parser: no
 * file may throw, and every emitted body must be syntactically valid.
 * Skipped when the fixture is not available.
 */

const KIND_BY_DIR: Readonly<Record<string, AssetKind>> = {
  objects: "object",
  scripts: "script",
  sprites: "sprite",
  sounds: "sound",
  rooms: "room",
  fonts: "font",
  shaders: "shader",
  paths: "path",
  timelines: "timeline",
  tilesets: "tileset",
  sequences: "sequence",
};

function sourceFiles(root: string): SourceFile[] {
  const out: SourceFile[] = [];
  for (const dir of ["objects", "scripts"]) {
    let names: string[] = [];
    try {
      names = readdirSync(path.join(root, dir));
    } catch {
      continue;
    }
    for (const n of names) {
      const d = path.join(root, dir, n);
      if (!statSync(d).isDirectory()) continue;
      for (const f of readdirSync(d).filter((x) => x.endsWith(".gml"))) {
        out.push({
          path: `${dir}/${n}/${f}`,
          text: readFileSync(path.join(d, f), "utf8"),
          ...(dir === "objects"
            ? { object: n, kind: "object" as const }
            : { kind: "script" as const }),
        });
      }
    }
  }
  return out;
}

const YYP = fixtureYyp();

describe("gml emitter corpus (set GMS_FIXTURE_DIR to a real project)", () => {
  it.skipIf(YYP === "")(
    "emits every file without throwing and every output parses",
    () => {
      const root = path.dirname(YYP);
      const assets: Partial<Record<AssetKind, string[]>> = {};
      for (const [dir, names] of yypResources(YYP)) {
        const kind = KIND_BY_DIR[dir];
        if (kind) assets[kind] = [...names];
      }
      const files = sourceFiles(root);
      const project = buildProjectSymbols({ assets, files });
      const callables = new Map<string, string>();
      for (const s of assets.script ?? []) callables.set(s, s);
      for (const [name, sym] of project.functions()) {
        const module = sym.decl?.file.split("/")[1];
        if (module !== undefined) callables.set(name, module);
      }
      const failures: string[] = [];
      let diagnostics = 0;
      for (const f of files) {
        const opts = { project, callables, functionId: f.path };
        const bodies =
          f.kind === "script"
            ? emitScript(f.path.split("/")[1] ?? "", f, {
                ...opts,
                kind: "script",
              }).functions.map((fn) => fn.body)
            : [
                emitEvent(f, {
                  ...opts,
                  kind: f.path.includes("/Collision_") ? "collision" : "event",
                  ...(f.object ? { object: f.object } : {}),
                }).code,
              ];
        for (const body of bodies) {
          const errors = parseSync(
            "x.ts",
            `function f(_entity, _ctx, _other, ...args) {\n${body}\n}`,
          ).errors;
          if (errors.length > 0)
            failures.push(`${f.path}: ${errors[0]?.message ?? ""}`);
        }
        diagnostics += project.analyze(f).recovered;
      }
      console.info(
        `gml emitter corpus: ${files.length} files, ${failures.length} with syntax errors, ${diagnostics} recovered statements`,
      );
      expect(failures).toEqual([]);
    },
  );
});
