import type { Entity } from "../Entity.js";
import { Transform } from "../components/Transform.js";
import { Meta } from "../components/Meta.js";
import {
  spriteHalfExtents,
  type GmlActionContext,
} from "../compat/gmlActions.js";
import {
  GmlBehaviorState,
  getGmlBehavior,
  getGmlBehaviorHandler,
} from "../components/GmlBehavior.js";

/**
 * Shared matching logic for GameMaker's per-other-object Collision event
 * (`onCollideWith<Other>`, generated per-object by `gms2-codegen.ts` from
 * `Collision_<other object name>.gml`). Two independent call sites need the
 * exact same "resolve the other entity's object-type name, look up a
 * matching handler, call it" logic — `GmlBehaviorSystem`'s own step-based
 * AABB sweep (the general, non-physics case: GameMaker's real default
 * collision model is bounding-box overlap checked every step) and
 * `PhysicsSystem`'s Rapier contact-event dispatch (for GML fidelity on a
 * `physicsObject: true` GMS2 object, which still has a real Collision
 * event in GameMaker even though it also has a `PhysicsBody`). This module
 * exists so neither duplicates the other's matching rules — CLAUDE.md's own
 * rule for shared cross-cutting helpers (see "Shared internal helpers"
 * entry) applies here just as much as it does to `internal/scoped.ts`.
 *
 * "Object type" resolution reuses `Meta.name` rather than inventing a
 * second identity concept — `Meta` is already the engine's one "this entity
 * has an editor/tooling-visible name" component (see CLAUDE.md's
 * `QueryChannel`/`Meta.name`/`Meta.tags` note), and `SceneFile.ts`'s
 * `loadSceneFile()` now stamps a spawned prefab instance's `Meta.name` with
 * its `PrefabDef.prefabName` (when nothing already set one) specifically so
 * a GMS2-imported room's prefab instances resolve back to their GameMaker
 * object name here. An entity with no `Meta`, or an empty `Meta.name`, has
 * no resolvable object type and can never be the *target* of a
 * `onCollideWith<Type>` match — it can still be the *source* of one, since
 * that only depends on its own `GmlBehaviorState`/module exports.
 */

/** The other entity's resolvable GameMaker object-type name, or `undefined` if it has none. */
export function resolveGmlObjectType(entity: Entity): string | undefined {
  const meta = entity.get(Meta);
  if (meta === undefined || meta.name === "") return undefined;
  return meta.name;
}

/**
 * Plain `Transform`-position + `Sprite`-implied-extents AABB overlap check —
 * the same shape `compat/gmlActions.ts`'s `action_if_collision` already
 * uses (and the same `spriteHalfExtents` fallback), reused here rather than
 * reimplemented so the two "is GML-A touching GML-B" checks in this engine
 * can never quietly disagree.
 */
export function checkGmlAabbOverlap(a: Entity, b: Entity): boolean {
  const ta = a.get(Transform);
  const tb = b.get(Transform);
  if (ta === undefined || tb === undefined) return false;
  const ea = spriteHalfExtents(a);
  const eb = spriteHalfExtents(b);
  return (
    Math.abs(ta.x + ea.ox - (tb.x + eb.ox)) < ea.x + eb.x &&
    Math.abs(ta.y + ea.oy - (tb.y + eb.oy)) < ea.y + eb.y
  );
}

/**
 * If `source` carries `GmlBehaviorState` and its compiled module exports a
 * handler matching `other`'s resolved object-type name
 * (`onCollideWith<Type>`), calls it (`source`, `other`, `ctx`). A no-op,
 * not an error, whenever `source` has no behavior, no matching handler, or
 * `other` has no resolvable type — this is the "does this pairing fire
 * anything" primitive; callers are responsible for having already decided
 * the pairing is worth checking (an AABB overlap, or a real physics
 * contact).
 */
export function dispatchGmlCollision(
  source: Entity,
  other: Entity,
  ctx: GmlActionContext,
): void {
  const state = source.get(GmlBehaviorState);
  if (state === undefined) return;
  const module = getGmlBehavior(state.behaviorId);
  if (module === undefined) return;
  const typeName = resolveGmlObjectType(other);
  if (typeName === undefined) return;
  const handler = getGmlBehaviorHandler(module, `onCollideWith${typeName}`);
  if (handler === undefined) return;
  handler(source, other, ctx);
}
