import fs from "fs/promises";
import path from "path";
import { scanEntityRefFieldsInText } from "./gml/project-symbols.js";
import { scanGmlImplicitVars } from "./gms2-transpile.js";

/**
 * Real, project-wide detection of GameMaker's "hand the spawned/iterated
 * instance a back-reference to me" idiom:
 *
 * ```gml
 * my_gun = instance_create_layer(x, y, "Gun", obj_Egun)
 * with (my_gun)
 * {
 *     owner = other.id;
 * }
 * ```
 *
 * Confirmed real in a real project: `objects/obj_enemy/Create_0.gml` spawns
 * `obj_Egun` this exact way and reaches back into the spawned instance to
 * give it a live reference to its creator — a common, idiomatic GameMaker
 * pattern (spawn something, then immediately tell it who spawned it), not
 * a one-off. `obj_Egun`'s own event files later read `owner.x`/
 * `owner.image_xscale` — a genuine cross-*file* dotted reference this
 * transpiler's existing same-function `localEntityRefs` scan
 * (`gms2-transpile.ts`) cannot see, because the assignment that makes
 * `owner` hold a live Entity happens in a *different* object's Create
 * event, not anywhere in `obj_Egun`'s own source text.
 *
 * This scanner closes that gap for real, project-wide, the same "walk
 * every `.gml` file once, before any per-file transpile" shape
 * `scanGmlEnums`/`scanGmlMacros` already establish for their own
 * project-wide symbols — but it deliberately does *not* attempt full
 * cross-file dataflow analysis. It recognises exactly one concrete,
 * checkable pattern, now recognised on the parsed AST (`gml/`) rather than by
 * regex:
 *
 *   `with (<targetExpr>) { ... <fieldName> = other.id; ... }` — brace form,
 *   the assignment at any nesting depth inside the body
 *   `with (<targetExpr>) <fieldName> = other.id;` — single-statement form
 *
 * where `<fieldName>` is a bare name, a dotted property (`inst.f = ...`) or
 * a `var` declarator assigned the literal `other.id` expression —
 * GameMaker's real, idiomatic "the instance that entered this `with` block
 * hands me its own instance reference" shape. The old regex form only saw a
 * body with no nested braces, a target with no nested parens and a
 * `;`-terminated assignment, and it also matched inside comments and
 * strings; the AST form has none of those limits (a superset of the old
 * result apart from those comment/string matches). A field assigned via any other cross-file
 * mechanism (a struct property, a different back-reference idiom, a value
 * threaded through a ds_map/global)
 * is a real, different case this scanner does not claim to cover — see
 * this function's own return value's use site in `gms2-transpile.ts` for
 * the honest, stated scope.
 *
 * `<targetExpr>` itself is not required to resolve to anything in
 * particular — a bare local variable (`my_gun`, the real project
 * shape) or a real object-type name are both accepted, since either way
 * the *field name* being populated with a live Entity reference is the
 * only fact this scanner needs to record. Whether `<targetExpr>` itself
 * can be resolved to a concrete Entity at the *call site* is a separate,
 * already-solved concern (`_objectNames`/`localEntityRefs` in
 * `gms2-transpile.ts`) — this scanner's only job is telling every *other*
 * object's transpile pass "a dotted read of `.owner` (or whichever field
 * name) is a live Entity reference, resolve it through the same
 * `getGmlRefVar`/`setGmlRefVar` mechanism a same-function local ref uses."
 */
export async function scanGmlCrossFileEntityRefFields(
  projectRoot: string,
): Promise<Set<string>> {
  const fields = new Set<string>();

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
        // AST-backed: any `with` body at any nesting depth, block or
        // single-statement form, target expression of any shape; text in
        // comments and strings is never a match.
        for (const name of scanEntityRefFieldsInText(content)) fields.add(name);
      }
    }
  }

  await walk(projectRoot);
  return fields;
}

/**
 * Real, project-wide per-object implicit-instance-variable name sets —
 * closes a real, confirmed gap distinct from `scanGmlCrossFileEntityRefFields`
 * above: a *script* (not tied to any one object) that reads another
 * object's own fields via `with (objName) { field = ...; }`, where `field`
 * is a real, plain instance variable of `objName` — set (via ordinary
 * assignment, not the `other.id` back-reference idiom above) *only* inside
 * `objName`'s own event files, never anywhere inside the script itself.
 *
 * Confirmed real in a real project: `scripts/scr_save_game/scr_save_game.gml`
 * does `with (obj_player_stats) { save_data.set("x", player_xstart); ...
 * save_data.set("hp", hp); ... }` — `player_xstart`/`hp`/`maxhp`/`stamina`/
 * `maxstamina`/`expr`/`maxexpr`/`level`/`attack` are all real, plain
 * `name = expr;` assignments inside `objects/obj_player_stats/Create_0.gml`
 * (confirmed by reading that file directly — `obj_player_stats` has an
 * empty real `.yy` `"properties"` array and a `null` `parentObjectId`, so
 * this is *not* a GMS2.3+ Variable Definition and *not* real GameMaker
 * object inheritance; it's a plain same-object implicit instance variable,
 * the ordinary case `scanGmlImplicitVars` already handles perfectly *within
 * `obj_player_stats`'s own generated behavior module* — the gap is only
 * that `scr_save_game.ts`, a wholly separate generated file, has no way to
 * know these names are instance fields of `obj_player_stats` at all, since
 * it never assigns them itself).
 *
 * This scanner walks every real `objects/<name>/` directory once,
 * project-wide, and unions `scanGmlImplicitVars` across that object's own
 * sibling `.gml` event files — literally the same per-object scan
 * `gms2-codegen.ts`'s `objectImplicitVars` already performs for that
 * object's *own* generated behavior module, just also captured here so a
 * *different* generated file's `with (objName) { ... }` block can be seeded
 * with the same knowledge. `gms2-transpile.ts`'s `transpileGML` merges the
 * named object's field set into its own `knownImplicitVars` handling
 * whenever the body being transpiled contains a literal `with (objName)`
 * naming a real, known project object — the same "seed the whole body,
 * don't attempt a real per-block scope" precedent
 * `scanGmlCrossFileEntityRefFields`'s own use site already establishes, and
 * safe for the same reason: a name that's genuinely `objName`'s own
 * instance field is vanishingly unlikely to also be an unrelated local
 * variable of the same name inside the very script that reaches into it.
 */
export async function scanGmlObjectFieldNames(
  projectRoot: string,
): Promise<Map<string, Set<string>>> {
  const result = new Map<string, Set<string>>();
  const objectsDir = path.join(projectRoot, "objects");
  let objectDirs: string[];
  try {
    objectDirs = await fs.readdir(objectsDir);
  } catch {
    return result;
  }
  for (const objName of objectDirs) {
    const objDir = path.join(objectsDir, objName);
    const stat = await fs.stat(objDir).catch(() => null);
    if (stat === null || !stat.isDirectory()) continue;
    let files: string[];
    try {
      files = await fs.readdir(objDir);
    } catch {
      continue;
    }
    const fields = new Set<string>();
    for (const file of files) {
      if (!file.endsWith(".gml")) continue;
      const content = await fs
        .readFile(path.join(objDir, file), "utf-8")
        .catch(() => "");
      for (const name of scanGmlImplicitVars(content)) fields.add(name);
    }
    if (fields.size > 0) result.set(objName, fields);
  }
  return result;
}
