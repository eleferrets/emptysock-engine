/**
 * Shared "write field F at index I into store S, growing S[F] if absent"
 * primitive. `Entity.add()`'s defaults/overrides loops, `createComponentProxy`'s
 * setter trap, and `ComponentRegistry.ensure()`'s reset path each used to
 * reimplement this independently — one field write, one place.
 */
export declare function setField(
  store: Record<string, unknown[]>,
  field: string,
  index: number,
  value: unknown,
): void;
/** Writes every entry of `values` into `store` at `index`, via `setField`. */
export declare function setFields(
  store: Record<string, unknown[]>,
  index: number,
  values: Record<string, unknown>,
): void;
