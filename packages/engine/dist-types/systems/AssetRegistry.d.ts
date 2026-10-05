import { type AssetIndexEntry, type AssetKind } from "@emptysock/types";
/**
 * `Game`-scoped lookup of build-time asset facts (sprite size, font size,
 * which objects/rooms/... exist), loaded from the `asset-index.json` the asset
 * asset pipeline emits. Named `AssetRegistry`/`AssetIndex*` because `AssetManifest`
 * is the (unrelated) loader. Holds lookup facts only: `FontRegistry` still
 * owns rendering data. Storage is keyed `(kind, name)` so cross-kind name
 * collisions never overwrite each other; `resolve()` reports them.
 *
 * With nothing loaded (`isEmpty`), compat getters degrade to their documented
 * "no registry" answers instead of throwing.
 */
export declare class AssetRegistry {
  private readonly _byKind;
  /** Replaces the whole registry. Throws a zod error on a malformed index. */
  load(index: unknown): void;
  /** Adds or overwrites one entry (within its kind). Manual/test use. */
  register(entry: AssetIndexEntry): void;
  clear(): void;
  /** True when nothing has been loaded/registered. */
  get isEmpty(): boolean;
  /** Normalises a reference (name, id, or any sprite frame path) to a name. */
  private _nameOf;
  get(kind: AssetKind, ref: unknown): AssetIndexEntry | undefined;
  exists(kind: AssetKind, ref: unknown): boolean;
  /** Every kind that has an asset matching `ref`; length > 1 is a collision. */
  resolve(ref: unknown): AssetIndexEntry[];
  spriteSize(ref: unknown):
    | {
        width: number;
        height: number;
      }
    | undefined;
  frameCount(ref: unknown): number | undefined;
  names(kind: AssetKind): string[];
}
/**
 * The loaded registry reachable from a compat `ctx`, or `undefined` when none
 * is wired or nothing has been loaded (callers then keep their documented
 * "no registry" answer). Structural so `compat/` needs no `Game` import.
 */
export declare function assetRegistryOf(ctx: {
  readonly assets?: AssetRegistry | undefined;
  readonly game?:
    | {
        readonly assets: AssetRegistry;
      }
    | undefined;
}): AssetRegistry | undefined;
