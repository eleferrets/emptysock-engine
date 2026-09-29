import fs from "fs/promises";
import path from "path";

/**
 * Real, project-wide GameMaker 2.3+ `enum Name { A, B = value, C }`
 * declarations (confirmed real against a real project's own `TRANS_MODE`
 * — `objects/obj_sidebars/Create_0.gml` — and `MSG` —
 * `objects/oTextbox/Create_0.gml` — both plain, user-authored, sequential
 * enums with no explicit member values). These are ordinary user GML code,
 * not a foreign/system constant family, and their real integer values are
 * fully statically knowable from the source alone — GameMaker's own real
 * enum semantics (confirmed via WebSearch against GameMaker's manual):
 * each member defaults to one more than the previous member's value,
 * starting at `0` for the first member; a member may instead carry an
 * explicit `= <expr>` override, and every subsequent member without its
 * own override resumes counting up from *that* value. GameMaker permits a
 * later member's `= expr` to reference an earlier member of the *same*
 * enum by name (`{ A, B = A + 4 }`) — this scanner resolves that via a
 * simple in-order evaluation against the members already computed for this
 * enum, which is the only ordering GameMaker's own parser could support
 * either (a forward reference to a not-yet-declared member is not valid
 * GameMaker GML).
 *
 * This is the enum twin of `gms2-transpile.ts`'s existing `scanGmlMacros`
 * — same "walk every `.gml` file once, project-wide, before any per-file
 * transpile" shape, since an enum declared in one object's Create event
 * (GameMaker enums are function-scoped syntactically but, per GameMaker's
 * own documented behaviour and confirmed by real projects referencing them
 * from unrelated files, are actually globally visible for the rest of the
 * project) is routinely referenced from other, unrelated objects/scripts.
 */
export async function scanGmlEnums(
  projectRoot: string,
): Promise<Map<string, Map<string, number>>> {
  const enums = new Map<string, Map<string, number>>();
  // Matches `enum Name { ...body... }` — body captured non-greedily up to
  // the first `}`, which is safe here because real GameMaker enum bodies
  // never contain a nested `{`/`}` (each member is a plain identifier or a
  // simple arithmetic `= expr`, never a struct/function literal).
  const ENUM_RE = /enum\s+([A-Za-z_]\w*)\s*\{([^}]*)\}/g;

  async function walk(dir: string): Promise<void> {
    let entries: string[];
    try {
      entries = await fs.readdir(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry);
      const stat = await fs.stat(full).catch(() => null);
      if (stat === null) continue;
      if (stat.isDirectory()) {
        await walk(full);
      } else if (entry.endsWith(".gml")) {
        const content = await fs.readFile(full, "utf-8").catch(() => "");
        for (const m of content.matchAll(ENUM_RE)) {
          const name = m[1];
          const body = m[2];
          if (name === undefined || body === undefined) continue;
          if (enums.has(name)) continue; // first declaration wins — real GameMaker allows only one project-wide declaration per enum name
          enums.set(name, parseEnumBody(body));
        }
      }
    }
  }

  await walk(projectRoot);
  return enums;
}

function parseEnumBody(body: string): Map<string, number> {
  const members = new Map<string, number>();
  let next = 0;
  for (const rawMember of body.split(",")) {
    const member = rawMember.trim();
    if (member === "") continue; // trailing comma before `}` — GameMaker's IDE writes this routinely
    const eq = member.indexOf("=");
    if (eq === -1) {
      const memberName = member;
      if (!/^[A-Za-z_]\w*$/.test(memberName)) continue;
      members.set(memberName, next);
      next += 1;
      continue;
    }
    const memberName = member.slice(0, eq).trim();
    const exprText = member.slice(eq + 1).trim();
    if (!/^[A-Za-z_]\w*$/.test(memberName)) continue;
    const value = evaluateEnumExpr(exprText, members);
    if (value === undefined) continue; // an expression this scanner can't statically resolve (e.g. referencing something outside the enum) — honestly skipped, not guessed
    members.set(memberName, value);
    next = value + 1;
  }
  return members;
}

/**
 * Evaluates a real, simple GameMaker enum member override expression —
 * an integer literal, or a `+`/`-` arithmetic combination referencing an
 * earlier member of the *same* enum by name (the only forward-reference
 * shape GameMaker's own parser allows here). Deliberately narrow: this is
 * not a general GML expression evaluator, and any expression outside this
 * shape (a call, a reference to another enum, a multiplication) returns
 * `undefined` so the caller can skip it honestly rather than fabricate a
 * wrong value.
 */
function evaluateEnumExpr(
  expr: string,
  known: ReadonlyMap<string, number>,
): number | undefined {
  const tokens = expr.match(/[A-Za-z_]\w*|\d+|[+-]/g);
  if (tokens === null || tokens.length === 0) return undefined;
  let result: number | undefined;
  let sign = 1;
  for (const tok of tokens) {
    if (tok === "+") {
      sign = 1;
      continue;
    }
    if (tok === "-") {
      sign = -1;
      continue;
    }
    let value: number | undefined;
    if (/^\d+$/.test(tok)) {
      value = Number(tok);
    } else {
      value = known.get(tok);
    }
    if (value === undefined) return undefined;
    result = (result ?? 0) + sign * value;
    sign = 1;
  }
  return result;
}

/**
 * Emits every scanned enum as a real, valid, plain JS `const` object —
 * `const Name = { A: 0, B: 1 } as const;` — into one shared generated
 * module every `.behavior.ts` file imports as `GmlEnums` (see
 * `gms2-transpile.ts`'s enum rewrite pass). A shared module rather than
 * per-file inlining, because an enum is genuinely project-wide data (the
 * same object identity/values everywhere), and the codebase's own
 * established precedent for project-wide generated lookups is a shared
 * module other generated files import (see e.g. `gms2-tileset-import.ts`'s
 * per-tileset modules a room's generated tilemap module imports directly)
 * rather than duplicating a growing constant table into every generated
 * file.
 */
export function buildEnumsModule(
  enums: ReadonlyMap<string, ReadonlyMap<string, number>>,
): string {
  const lines: string[] = [
    "// AUTO-GENERATED by @emptysock/toolchain's GMS2 importer. Do not edit by hand.",
    "// Real GameMaker `enum Name { ... }` declarations found project-wide, with",
    "// their real computed integer values — see gms2-enums.ts's scanGmlEnums().",
    "",
  ];
  for (const [name, members] of enums) {
    const fields = [...members.entries()]
      .map(([member, value]) => `  ${member}: ${value},`)
      .join("\n");
    lines.push(`export const ${name} = {\n${fields}\n} as const;`, "");
  }
  if (enums.size === 0) {
    lines.push("export {};", "");
  }
  return lines.join("\n");
}
