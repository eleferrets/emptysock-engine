/**
 * Tiny shared helper for the "WeakMap-per-World (or per-Scene) get-or-create
 * nested map" pattern that recurs across `ComponentRegistry.ts`,
 * `components/PhysicsBody.ts`, and `systems/RenderPipeline.ts`'s overlay
 * tracking — each scopes some per-entity (or per-scene) state under a
 * `WeakMap<K, V>` keyed by the owning `World`/`Scene`, and each used to
 * hand-roll the same "get, or create-and-set" null check. Centralizing it
 * here means a future fifth side-table reuses this instead of writing a
 * sixth copy of the same four lines.
 */
export declare function getOrCreate<K extends object, V>(
  map: WeakMap<K, V>,
  key: K,
  create: () => V,
): V;
/** Same idea, for a plain `Map` rather than a `WeakMap` (e.g. a `Map<number, X>` keyed by eid). */
export declare function getOrCreateMapEntry<K, V>(
  map: Map<K, V>,
  key: K,
  create: () => V,
): V;
