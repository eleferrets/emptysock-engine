import type { World } from "bitecs";
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
export declare const VisualScriptState: import("../Component.js").ComponentDef<{
  graphId: string;
}>;
/** Registers (or replaces) the graph data referenced by `graphId`. */
export declare function registerVisualScriptGraph(
  graphId: string,
  graph: VisualScriptGraph,
): void;
export declare function getVisualScriptGraph(
  graphId: string,
): VisualScriptGraph | undefined;
export declare function unregisterVisualScriptGraph(graphId: string): void;
export declare function getVisualScriptScope(
  world: World,
  eid: number,
): Map<string, number>;
/**
 * Called from `Scene.destroy()` for every destroyed entity, mirroring
 * `clearPhysicsBody` — a pooled entity's reused bitECS id must not inherit
 * the previous occupant's stale scope entries (see CLAUDE.md's "Shared
 * internal helpers" entry for why this can't just wait on `WeakMap` GC).
 */
export declare function clearVisualScriptScope(world: World, eid: number): void;
