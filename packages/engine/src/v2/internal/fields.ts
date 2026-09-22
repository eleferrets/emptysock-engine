/**
 * Shared "write field F at index I into store S, growing S[F] if absent"
 * primitive. `Entity.add()`'s defaults/overrides loops, `createComponentProxy`'s
 * setter trap, and `ComponentRegistry.ensure()`'s reset path each used to
 * reimplement this independently — one field write, one place.
 */
export function setField(
  store: Record<string, unknown[]>,
  field: string,
  index: number,
  value: unknown,
): void {
  let arr = store[field];
  if (arr === undefined) {
    arr = [];
    store[field] = arr;
  }
  arr[index] = value;
}

/** Writes every entry of `values` into `store` at `index`, via `setField`. */
export function setFields(
  store: Record<string, unknown[]>,
  index: number,
  values: Record<string, unknown>,
): void {
  for (const [field, value] of Object.entries(values)) {
    setField(store, field, index, value);
  }
}
