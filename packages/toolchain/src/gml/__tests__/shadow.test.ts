import { describe, expect, it } from "vitest";
import { scanGmlImplicitArrayVars, scanGmlImplicitVars } from "../../gms2-transpile.js";
import { isKnownBuiltinName } from "../builtins.js";
import { buildProjectSymbols } from "../project-symbols.js";

/**
 * Shadow mode: the symbol table's per-object instance fields against the
 * regex scans (`scanGmlImplicitVars` / `scanGmlImplicitArrayVars`) they are
 * meant to replace, over snippets covering each statement-boundary shape the
 * regex prefix was patched for. Any difference must be in `EXPECTED_DIFFS`
 * with a reason.
 */
const SNIPPETS: Record<string, string> = {
  plain: "hp = 10;\nmax_hp = hp;\nname_ = \"a\";",
  locals: "var a = 1, b = 2;\nvar c,\n  d = 4;\nhp = a + b;",
  multiLineVar: "var first = 1,\n    second = 2;\nthird = first;",
  bracelessIf: "if (a) mask_index = -1;\nif (b) foo = 1; else bar = 2;",
  caseLabel: "switch (t) { case 1: res = 5; break; default: res = 0; }",
  sameLineBlock: "if (z) { vsp = 0; grav = 0; }",
  compoundIsNotADeclaration: "counter += 1;\nother_counter++;",
  comparisonIsNotAssignment: "if (a == b) { ok = true; }",
  structAndDotted: "self.dot = 1;\nobj_other.field = 2;\nglobal.g = 3;\ns = { inner: 1 };",
  arrays: "grid[0] = 1;\nlist[| 0] = 2;\nmap[? \"k\"] = 3;\nlits = [1, 2];",
  functionBody: "function f(p) { var q = p; leak = q; }",
  builtinsAssigned: "speed = 4;\ndirection = 90;\nsprite_index = 3;\nmine = 1;",
  multiStatementLine: "{ global.pause = false; canDraw = false; canEdit = false; }",
  strings: 's = "fake = 1;";\n// commented = 2;\nreal = 3;',
};

/** Names the regex reports that the table classifies as built-ins (compat rewrites them earlier in the pipeline). */
const BUILTIN_DIFFS = new Set(["builtinsAssigned:speed", "builtinsAssigned:direction", "builtinsAssigned:sprite_index", "bracelessIf:mask_index"]);
/** Names only the table finds, each strictly more correct. */
const TABLE_ONLY_DIFFS: Record<string, string> = {
  "structAndDotted:dot": "`self.dot = 1` declares an instance field; the line-start regex cannot see a dotted target",
};
const isExpected = (k: string): boolean => BUILTIN_DIFFS.has(k) || k in TABLE_ONLY_DIFFS;

function fieldsFromTable(text: string): Set<string> {
  const p = buildProjectSymbols({ files: [{ path: "o/Create_0.gml", text, object: "o", kind: "object" }] });
  return new Set(p.object("o")?.instanceFields.keys() ?? []);
}

describe("shadow: symbol table vs regex implicit-var scan", () => {
  for (const [name, text] of Object.entries(SNIPPETS)) {
    it(`snippet '${name}'`, () => {
      const oldSet = new Set([...scanGmlImplicitVars(text), ...scanGmlImplicitArrayVars(text)]);
      const newSet = fieldsFromTable(text);
      const onlyOld = [...oldSet].filter((n) => !newSet.has(n) && !isExpected(`${name}:${n}`));
      const onlyNew = [...newSet].filter((n) => !oldSet.has(n) && !isExpected(`${name}:${n}`));
      // the table may only find MORE than the regex where the extra names are real fields;
      // a name the regex found and the table dropped must be justified above.
      expect(onlyOld, `regex-only names in '${name}'`).toEqual([]);
      expect(onlyNew, `table-only names in '${name}'`).toEqual([]);
    });
  }

  it("array-ness agrees with scanGmlImplicitArrayVars for indexed-assignment first use", () => {
    const text = SNIPPETS["arrays"]!;
    const p = buildProjectSymbols({ files: [{ path: "o/Create_0.gml", text, object: "o", kind: "object" }] });
    const arr = [...(p.object("o")?.instanceFields.values() ?? [])].filter((f) => f.isArray).map((f) => f.name);
    for (const n of scanGmlImplicitArrayVars(text)) expect(arr).toContain(n);
  });

  it("every expected diff is a real built-in (guards the allow-list)", () => {
    for (const k of BUILTIN_DIFFS) expect(isKnownBuiltinName(k.split(":")[1]!)).toBe(true);
  });
});
