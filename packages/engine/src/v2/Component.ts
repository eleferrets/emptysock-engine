import type { SerializableRecord } from "./Serializable.js";

/**
 * A registered component definition. ENGINE_DESIGN.md §23.1: component
 * identity for bitECS's purposes is a plain object reference, which breaks
 * under hot-reload (a re-evaluated module produces a *new* reference for
 * what should be "the same" component). We fix that by keying identity on
 * `componentName` (a stable string the developer chooses once) rather than
 * on this object's own identity — see `ComponentRegistry`.
 */
export interface ComponentDef<
  T extends SerializableRecord = SerializableRecord,
> {
  readonly componentName: string;
  /** Produces a fresh defaults object for a newly-added component instance. */
  readonly createDefaults: () => T;
}

/**
 * Define a component by name and a defaults factory.
 *
 * ```ts
 * const Position = defineComponent("Position", () => ({ x: 0, y: 0 }));
 * player.add(Position, { x: 100 });
 * player.get(Position).x; // 100
 * ```
 *
 * The name is load-bearing (ENGINE_DESIGN.md §23.1) — hot-reloading the
 * module that calls `defineComponent("Position", ...)` produces a new JS
 * object every time, but the engine's component registry treats two defs
 * with the same `componentName` as the *same* component, replacing the old
 * definition's entry rather than creating a second, unrelated one.
 */
export function defineComponent<T extends SerializableRecord>(
  componentName: string,
  createDefaults: () => T,
): ComponentDef<T> {
  return { componentName, createDefaults };
}
