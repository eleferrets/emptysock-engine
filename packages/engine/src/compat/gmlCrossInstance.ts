import type { Entity } from "../Entity.js";
import { Meta } from "../components/Meta.js";
import { Transform } from "../components/Transform.js";
import type { GmlActionContext } from "./gmlActions.js";
import { getGmlVar, setGmlVar } from "./gmlInstanceVars.js";

/**
 * Real runtime resolution for a GML cross-instance dotted reference —
 * `obj_x.field` where `obj_x` is a real object-*type* name (not a local
 * variable holding a specific instance reference). See CLAUDE.md's "Cross-
 * file symbol table + real cross-instance/cross-object reference
 * resolution" section for the full design rationale and how
 * `gms2-transpile.ts` decides a given dotted reference is genuinely this
 * shape (via the project-wide symbol table in `gms2-symbols.ts`) rather
 * than a local variable or an unrelated dotted access.
 *
 * GameMaker's own real semantic for `obj_x.field` (confirmed against
 * GameMaker's manual's "Accessing variables in other instances" reference
 * page) is: "the value of `field` on the *first active instance* of object
 * type `obj_x`" — a genuine runtime lookup, re-resolved every time the
 * expression is evaluated, never a compile-time constant the way an enum
 * member is. This is exactly why it needs a real compat function rather
 * than a transpile-time constant substitution the way `TRANS_MODE.FADE`
 * gets (see `gms2-transpile.ts`'s enum pass) — which specific instance
 * `obj_x` resolves to can change from frame to frame as instances spawn
 * and are destroyed.
 *
 * Object-type resolution reuses `systems/GmlCollision.ts`'s
 * `resolveGmlObjectType` (`Meta.name`-keyed) so this can never disagree
 * with `onCollideWith<Type>` dispatch, `place_meeting`, or
 * `stepGmlCameraFollow`'s own object-type matching about what an
 * object-name argument resolves to — the same reuse rule those three
 * already establish for each other. The found instance's own field value
 * is read/written through `getGmlVar`/`setGmlVar` — the same per-`(World,
 * eid)` instance-variable side-table every other transpiled bare
 * identifier read/write in this codebase already goes through (see
 * `gmlInstanceVars.ts`'s own doc comment) — so a value written via
 * `obj_x.field = v;` from one instance and later read as a plain bare
 * `field` from inside `obj_x`'s own event code sees the same value,
 * exactly matching GameMaker's own single, unified instance-variable
 * namespace per instance.
 */
export function getGmlObjectVar(
  entity: Entity,
  ctx: GmlActionContext,
  objectName: string,
  field: string,
): unknown {
  const target = findFirstInstanceOfType(ctx, objectName);
  if (target === undefined) return undefined;
  // `x`/`y` are GameMaker's own real built-in position variables, not an
  // ordinary implicit instance variable — see CLAUDE.md's "x/y built-in
  // position variables" section for why a same-instance bare `x`/`y`
  // already routes to `Transform.x`/`.y` rather than the generic
  // `getGmlVar`/`setGmlVar` side-table. A cross-instance `obj_x.x`/`.y`
  // reference (real, confirmed usage — Freedom Backup's own
  // `obj_player.x`/`obj_player.y`, 11+12 occurrences) must resolve
  // consistently with that, not silently read `undefined` from a
  // side-table `x`/`y` never actually populates.
  if (field === "x" || field === "y") {
    return target.get(Transform)?.[field] ?? 0;
  }
  return getGmlVar(target, ctx, field);
}

export function setGmlObjectVar(
  entity: Entity,
  ctx: GmlActionContext,
  objectName: string,
  field: string,
  value: unknown,
): unknown {
  const target = findFirstInstanceOfType(ctx, objectName);
  if (target === undefined) {
    console.warn(
      `[GmlCrossInstance] setGmlObjectVar: no live instance of object type "${objectName}" found — write to "${field}" dropped (GameMaker's own real behaviour for a nonexistent instance target throws; this compat layer instead honestly no-ops, matching this codebase's "no live instance to even ask" convention rather than crashing).`,
    );
    return value;
  }
  if (field === "x" || field === "y") {
    const t = target.get(Transform);
    if (t !== undefined) t[field] = value as number;
    return value;
  }
  return setGmlVar(target, ctx, field, value);
}

function findFirstInstanceOfType(
  ctx: GmlActionContext,
  objectName: string,
): Entity | undefined {
  let found: Entity | undefined;
  ctx.scene.each(Meta, (meta, e) => {
    if (found !== undefined) return;
    if (meta.name === objectName) found = e;
  });
  return found;
}
