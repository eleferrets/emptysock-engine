/**
 * ENGINE_DESIGN.md §14.1 — the plain-data constraint every component field
 * must satisfy. This is the type used to constrain `defineComponent`'s
 * defaults object: no functions, no class instances (unless they implement
 * `SerializableHooks` themselves via a custom field type — out of scope for
 * Track 0, which only lands the constraint, not `SaveSystem`).
 *
 * A component that only ever holds `Serializable` fields can be saved/loaded
 * generically by a future `SaveSystem` with zero per-component code. The
 * `serialize`/`deserialize` escape hatch mentioned in ENGINE_DESIGN.md §12.1
 * belongs to that later system, not this type.
 */
export type Serializable =
  | string
  | number
  | boolean
  | null
  | undefined
  | readonly Serializable[]
  | {
      readonly [key: string]: Serializable;
    };
/** A component's field bag must be a plain, JSON-serializable record. */
export type SerializableRecord = Record<string, Serializable>;
/**
 * Compile-time check: `T` is only accepted if every property satisfies
 * `Serializable`. Passing a shape with a function or a class instance field
 * is a type error at the `defineComponent` call site, not a runtime surprise
 * discovered by `SaveSystem` later.
 */
export type AssertSerializable<T extends SerializableRecord> = T;
