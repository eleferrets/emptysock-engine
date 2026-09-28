import fs from "fs/promises";
import path from "path";

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
 * Confirmed real in Freedom Backup: `objects/obj_enemy/Create_0.gml` spawns
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
 * checkable textual pattern:
 *
 *   `with (<targetExpr>) { <fieldName> = other.id; ... }` — brace form
 *   `with (<targetExpr>) <fieldName> = other.id;` — single-statement form
 *
 * (both forms mirroring `rewriteWithStatements`'s own existing dual-form
 * with-body handling), where `<fieldName>` is assigned the literal `other.
 * id` expression — GameMaker's real, idiomatic "the instance that entered
 * this `with` block hands me its own instance reference" shape. A field
 * assigned via any other cross-file mechanism (a struct property, a
 * different back-reference idiom, a value threaded through a ds_map/global)
 * is a real, different case this scanner does not claim to cover — see
 * this function's own return value's use site in `gms2-transpile.ts` for
 * the honest, stated scope.
 *
 * `<targetExpr>` itself is not required to resolve to anything in
 * particular — a bare local variable (`my_gun`, the real Freedom Backup
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

  // Brace form: `with (target) { ... field = other.id; ... }`. The body is
  // captured non-greedily up to the first `}` at the same nesting level —
  // real GameMaker back-reference with-blocks in this idiom are short and
  // don't nest further `{`/`}` (confirmed against Freedom Backup's own real
  // occurrence), so a simple non-nested capture is sufficient and matches
  // this codebase's existing enum-body-scanning precedent (`scanGmlEnums`'s
  // own `ENUM_RE` doc comment makes the identical non-nesting assumption
  // for the same reason).
  const WITH_BRACE_RE = /\bwith\s*\([^()]*\)\s*\{([^{}]*)\}/g;
  // Single-statement form: `with (target) field = other.id;` — no braces at
  // all, matching `rewriteWithStatements`'s own dual-form handling.
  const WITH_STMT_RE =
    /\bwith\s*\([^()]*\)\s*([A-Za-z_]\w*)\s*=\s*other\.id\s*;/g;
  const FIELD_ASSIGN_RE = /\b([A-Za-z_]\w*)\s*=\s*other\.id\s*;/g;

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
        for (const m of content.matchAll(WITH_BRACE_RE)) {
          const body = m[1] ?? "";
          for (const fm of body.matchAll(FIELD_ASSIGN_RE)) {
            const name = fm[1];
            if (name !== undefined) fields.add(name);
          }
        }
        for (const m of content.matchAll(WITH_STMT_RE)) {
          const name = m[1];
          if (name !== undefined) fields.add(name);
        }
      }
    }
  }

  await walk(projectRoot);
  return fields;
}
