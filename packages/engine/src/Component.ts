import type { SerializableRecord } from "./Serializable.js";

/**
 * Per-field inspector schema entry (ENGINE_DESIGN.md §10.1: "co-located
 * optional schema, not decorators"). Describes how the IDE's Inspector
 * should render one field of a component's defaults object — enough to
 * pick a typed control (number input, text input, checkbox, dropdown), not
 * a full validation system. `options` is only meaningful for `"enum"` and
 * lists the literal values the dropdown offers.
 */
export type ComponentFieldSchema =
  | { readonly kind: "number" }
  | { readonly kind: "string" }
  | { readonly kind: "boolean" }
  | { readonly kind: "enum"; readonly options: readonly string[] }
  /**
   * The field holds an `EntityRef` (`{ $ref: number }`, `NO_REF` when
   * empty). Scene load, save/load and room carry-over remap exactly the
   * fields declared this way (`remapRefs`). `relation`, when set, names a
   * `RelationDef` the pointed-at entity is expected to be linked through
   * (Inspector hint only; not enforced).
   */
  | { readonly kind: "entityRef"; readonly relation?: string };

/**
 * A component's schema maps each field name in its defaults object to a
 * `ComponentFieldSchema`. It is optional and purely additive — a component
 * with no `.schema` still works everywhere; the Inspector falls back to a
 * raw per-field editor for it. A schema does not need to cover every field
 * (e.g. `PhysicsBody`'s `bodyHandle`/`colliderHandle` are engine-managed and
 * usually omitted); an unlisted field also falls back to the raw editor.
 */
export type ComponentSchema<T extends SerializableRecord> = {
  readonly [K in keyof T]?: ComponentFieldSchema;
};

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
  /**
   * Schema version for this component's shape, defaulting to `1` when not
   * given to `defineComponent`. `SaveSystem` (`ecs/systems/SaveSystem.ts`)
   * stamps every saved component instance with this number; on load, a
   * mismatch against the currently-registered def's version triggers that
   * component's registered `migrate()` hook, or a warn+drop of just that
   * component's data if none is registered (ENGINE_DESIGN.md §19.3).
   */
  readonly version: number;
  /**
   * See `ComponentSchema`. `undefined` when `defineComponent` was called
   * without a `schema` option — the IDE Inspector treats that as "no
   * schema" and falls back to its raw per-field editor for this component,
   * not as an error.
   */
  readonly schema?: ComponentSchema<T>;
}

/** Optional extra config for `defineComponent`. */
export interface DefineComponentOptions<
  T extends SerializableRecord = SerializableRecord,
> {
  /** See `ComponentDef.version`. Defaults to `1`. */
  readonly version?: number;
  /** See `ComponentSchema`. Omit for components with no Inspector schema. */
  readonly schema?: ComponentSchema<T>;
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
  options?: DefineComponentOptions<T>,
): ComponentDef<T> {
  return {
    componentName,
    createDefaults,
    version: options?.version ?? 1,
    ...(options?.schema !== undefined ? { schema: options.schema } : {}),
  };
}
