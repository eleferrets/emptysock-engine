import {
  AssetIndexSchema,
  type AssetIndex,
  type AssetIndexEntry,
  type AssetKind,
} from "@emptysock/types";

const SPRITE_PATH = /assets\/sprites\/([^/]+)\//;

/**
 * `Game`-scoped lookup of import-time asset facts (sprite size, font size,
 * which objects/rooms/... exist), loaded from the `asset-index.json` the GMS2
 * importer emits. Named `AssetRegistry`/`AssetIndex*` because `AssetManifest`
 * is the (unrelated) loader. Holds lookup facts only: `FontRegistry` still
 * owns rendering data. Storage is keyed `(kind, name)` so cross-kind name
 * collisions never overwrite each other; `resolve()` reports them.
 *
 * With nothing loaded (`isEmpty`), compat getters degrade to their documented
 * "no registry" answers instead of throwing.
 */
export class AssetRegistry {
  private readonly _byKind = new Map<AssetKind, Map<string, AssetIndexEntry>>();

  /** Replaces the whole registry. Throws a zod error on a malformed index. */
  load(index: unknown): void {
    const parsed: AssetIndex = AssetIndexSchema.parse(index);
    this.clear();
    for (const e of parsed.entries) this.register(e);
  }

  /** Adds or overwrites one entry (within its kind). Manual/test use. */
  register(entry: AssetIndexEntry): void {
    let m = this._byKind.get(entry.kind);
    if (m === undefined) {
      m = new Map();
      this._byKind.set(entry.kind, m);
    }
    m.set(entry.name, entry);
  }

  clear(): void {
    this._byKind.clear();
  }

  /** True when nothing has been loaded/registered. */
  get isEmpty(): boolean {
    for (const m of this._byKind.values()) if (m.size > 0) return false;
    return true;
  }

  /** Normalises a reference (name, id, or any sprite frame path) to a name. */
  private _nameOf(kind: AssetKind, ref: unknown): string | undefined {
    if (typeof ref !== "string") return undefined;
    if (kind === "sprite") {
      const m = SPRITE_PATH.exec(ref);
      if (m !== null) return m[1];
    }
    return ref;
  }

  get(kind: AssetKind, ref: unknown): AssetIndexEntry | undefined {
    const name = this._nameOf(kind, ref);
    if (name === undefined) return undefined;
    return this._byKind.get(kind)?.get(name);
  }

  exists(kind: AssetKind, ref: unknown): boolean {
    return this.get(kind, ref) !== undefined;
  }

  /** Every kind that has an asset matching `ref`; length > 1 is a collision. */
  resolve(ref: unknown): AssetIndexEntry[] {
    const out: AssetIndexEntry[] = [];
    for (const kind of this._byKind.keys()) {
      const e = this.get(kind, ref);
      if (e !== undefined) out.push(e);
    }
    return out;
  }

  spriteSize(ref: unknown): { width: number; height: number } | undefined {
    const e = this.get("sprite", ref);
    if (e === undefined) return undefined;
    return { width: e.width ?? 0, height: e.height ?? 0 };
  }

  frameCount(ref: unknown): number | undefined {
    return this.get("sprite", ref)?.frameCount;
  }

  names(kind: AssetKind): string[] {
    return [...(this._byKind.get(kind)?.keys() ?? [])];
  }
}

/**
 * The loaded registry reachable from a compat `ctx`, or `undefined` when none
 * is wired or nothing has been loaded (callers then keep their documented
 * "no registry" answer). Structural so `compat/` needs no `Game` import.
 */
export function assetRegistryOf(ctx: {
  readonly assets?: AssetRegistry | undefined;
  readonly game?: { readonly assets: AssetRegistry } | undefined;
}): AssetRegistry | undefined {
  const reg = ctx.assets ?? ctx.game?.assets;
  return reg !== undefined && !reg.isEmpty ? reg : undefined;
}
