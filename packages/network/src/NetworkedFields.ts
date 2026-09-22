import type { ComponentDef, SerializableRecord } from "@emptysock/engine/v2";

/**
 * Which fields of a given component name are replicated over the network.
 * Keyed by `componentName` (the same stable string `ComponentRegistry`
 * keys on), *not* by the `ComponentDef` object's identity — a hot-reloaded
 * module produces a new `ComponentDef` reference for "the same" component
 * (ENGINE_DESIGN.md §23.1), and client/server are two separately-loaded
 * copies of the game's component definitions to begin with, so object
 * identity was never going to survive the trip. Name-keying this registry
 * is what makes it compose with `ComponentRegistry` rather than needing a
 * parallel identity scheme.
 */
const networkedFieldsByComponentName = new Map<string, ReadonlySet<string>>();

/**
 * Mark a subset of `def`'s fields as networked. Call this once per
 * component, on both client and server, right next to (or instead of) the
 * game's own `defineComponent` call:
 *
 * ```ts
 * const Position = defineComponent("Position", () => ({ x: 0, y: 0 }));
 * networked(Position, ["x", "y"]);
 * ```
 *
 * Returns `def` unchanged so it composes in a `defineComponent(...)` chain
 * without an extra local variable:
 *
 * ```ts
 * const Position = networked(
 *   defineComponent("Position", () => ({ x: 0, y: 0 })),
 *   ["x", "y"],
 * );
 * ```
 *
 * **Constraint: networked fields must be primitive-typed, or reassigned as
 * a whole new value on every change — never mutated in place.**
 * `NetworkSystem.sync()`'s outbound dirty-check (see its doc comment) uses
 * strict equality (`this._lastSent.get(key) !== value`) against the last
 * value it sent. For a primitive field this is exactly "did the value
 * change". For an object- or array-shaped field, mutating it in place
 * (`component.inventory.push(item)`, `component.pos.x = 5`) does not change
 * which reference is stored in the component, so the strict-equality check
 * never sees a difference and the mutation is silently never replicated.
 * If a networked field must hold an object/array, always assign a new one
 * (`component.inventory = [...component.inventory, item]`) so the
 * reference itself changes. This is a deliberate, documented limitation,
 * not a bug to work around locally — fixing it would mean deep-equality or
 * a different change-detection strategy entirely, a bigger design decision
 * than a single field-marking helper should make unilaterally.
 */
export function networked<T extends SerializableRecord>(
  def: ComponentDef<T>,
  fields: readonly (keyof T & string)[],
): ComponentDef<T> {
  networkedFieldsByComponentName.set(def.componentName, new Set(fields));
  return def;
}

/** The networked field names for `componentName`, or `undefined` if none were marked. */
export function getNetworkedFields(
  componentName: string,
): ReadonlySet<string> | undefined {
  return networkedFieldsByComponentName.get(componentName);
}

/** `true` if any field of `componentName` was marked networked. */
export function isNetworkedComponent(componentName: string): boolean {
  return networkedFieldsByComponentName.has(componentName);
}

/** Test/dev hook: forget every marked component. Mirrors `componentRegistry.clearAll()`. */
export function clearNetworkedFields(): void {
  networkedFieldsByComponentName.clear();
}
