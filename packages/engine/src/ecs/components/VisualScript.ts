import type { World } from "bitecs";
import { defineComponent } from "../Component.js";
import { getOrCreate, getOrCreateMapEntry } from "../internal/scoped.js";
import type { VisualScriptGraph } from "../../components/VisualScriptComponent.js";

/**
 * ECS port of the classic `VisualScriptComponent` (RELEASE_PASS.md's
 * "Visual Script Editor" gap — see CLAUDE.md for why the classic version
 * couldn't just be re-exported: it `extends` the classic `Component` base
 * class directly, which is structurally incompatible with `defineComponent`'s
 * `SerializableRecord` constraint).
 *
 * Per the research that informed this design (production ECS engines —
 * Unity DOTS's `EntitiesBT`/`DOTS-BehaviorTree`, Bevy's `bevy_behavior` —
 * all converge on the same shape): the graph itself is treated as shared,
 * immutable data, not per-entity component state. Two entities running the
 * same authored graph reference the same `graphId`, never a duplicated copy
 * of `nodes`/`connections` sitting in bitECS's own parallel arrays (which
 * would also violate `Serializable`'s "no functions, no arbitrary nested
 * object graphs" spirit for anything non-trivial). `VisualScriptState` is
 * intentionally the small per-entity part only: which graph this entity is
 * running. `registerVisualScriptGraph`/`getVisualScriptGraph` hold the
 * actual graph data in a plain module-level registry, the same "shared
 * static data keyed by id" pattern `@emptysock/network`'s `NetworkedFields`
 * side-map and `TilemapSystem`'s tilemap registry both already use.
 */
export const VisualScriptState = defineComponent(
  "VisualScriptState",
  () => ({
    graphId: "",
  }),
  {
    schema: {
      graphId: { kind: "string" },
    },
  },
);

const graphRegistry = new Map<string, VisualScriptGraph>();

/** Registers (or replaces) the graph data referenced by `graphId`. */
export function registerVisualScriptGraph(
  graphId: string,
  graph: VisualScriptGraph,
): void {
  graphRegistry.set(graphId, graph);
}

export function getVisualScriptGraph(
  graphId: string,
): VisualScriptGraph | undefined {
  return graphRegistry.get(graphId);
}

export function unregisterVisualScriptGraph(graphId: string): void {
  graphRegistry.delete(graphId);
}

/**
 * Per-entity evaluation scope (a graph run's transient
 * outputKey -> number bindings — see `VisualScriptComponent`'s `_scope`).
 * This is genuinely per-entity, mutable, non-serializable runtime state, so
 * it lives in a side-table scoped by `World` + eid — the same shape
 * `PhysicsBody`'s callback side-table uses — rather than on the component
 * itself, which must stay `Serializable`.
 */
const scopesByWorld = new WeakMap<World, Map<number, Map<string, number>>>();

export function getVisualScriptScope(
  world: World,
  eid: number,
): Map<string, number> {
  const scopes = getOrCreate(scopesByWorld, world, () => new Map());
  return getOrCreateMapEntry(scopes, eid, () => new Map());
}

/**
 * Called from `Scene.destroy()` for every destroyed entity, mirroring
 * `clearPhysicsBody` — a pooled entity's reused bitECS id must not inherit
 * the previous occupant's stale scope entries (see CLAUDE.md's "Shared
 * internal helpers" entry for why this can't just wait on `WeakMap` GC).
 */
export function clearVisualScriptScope(world: World, eid: number): void {
  scopesByWorld.get(world)?.delete(eid);
}
