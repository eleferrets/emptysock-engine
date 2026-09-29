import {
  AssetIndexSchema,
  type AssetIndex,
  type AssetIndexEntry,
  type AssetKind,
} from "@emptysock/types";
import type { SpriteAsset } from "./gms2-sprite-import.js";
import type { FontAsset } from "./gms2-font-import.js";

/** Report/entry kinds that are also `AssetKind`s (others: extension, enum, ...). */
const ASSET_KINDS: ReadonlySet<string> = new Set<AssetKind>([
  "sprite",
  "font",
  "sound",
  "object",
  "room",
  "script",
  "shader",
  "tileset",
  "path",
  "timeline",
  "sequence",
  "note",
]);

export function isAssetKind(kind: string): kind is AssetKind {
  return ASSET_KINDS.has(kind);
}

/** The transpiled runtime id of a sprite (the same string a bare sprite name is rewritten to). */
export function spriteAssetId(name: string): string {
  return `./assets/sprites/${name}/frame_0.png`;
}

/** Pure: the index entry for a converted sprite. */
export function spriteIndexEntry(sprite: SpriteAsset): AssetIndexEntry {
  return {
    kind: "sprite",
    name: sprite.name,
    id: spriteAssetId(sprite.name),
    width: sprite.width,
    height: sprite.height,
    frameCount: Math.max(1, sprite.frameCount),
    ...(sprite.originX !== undefined ? { originX: sprite.originX } : {}),
    ...(sprite.originY !== undefined ? { originY: sprite.originY } : {}),
    path: `assets/sprites/${sprite.name}/`,
  };
}

/** Pure: the index entry for a converted font. */
export function fontIndexEntry(font: FontAsset): AssetIndexEntry {
  return {
    kind: "font",
    name: font.name,
    id: font.name,
    size: font.size,
    bold: font.bold,
    italic: font.italic,
  };
}

/** Pure: a plain name-only entry (object, room, sound, script, shader, ...). */
export function nameIndexEntry(kind: AssetKind, name: string): AssetIndexEntry {
  return { kind, name, id: name };
}

/**
 * Builds a validated, deterministically ordered (kind, name) `AssetIndex`.
 * Cross-kind name collisions are listed in `collisions` (GameMaker's own
 * resource namespace is flat, so these mean a stale/hand-edited project).
 * Case-insensitive duplicates within a kind's namespace are reported by
 * `assetIndexWarnings`, not stored as collisions (lookups are case-sensitive).
 */
export function buildAssetIndex(
  entries: readonly AssetIndexEntry[],
): AssetIndex {
  const sorted = [...entries].sort((a, b) =>
    a.kind !== b.kind
      ? a.kind < b.kind
        ? -1
        : 1
      : a.name < b.name
        ? -1
        : a.name > b.name
          ? 1
          : 0,
  );
  const kindsByName = new Map<string, Set<AssetKind>>();
  for (const e of sorted) {
    let s = kindsByName.get(e.name);
    if (s === undefined) kindsByName.set(e.name, (s = new Set()));
    s.add(e.kind);
  }
  const collisions = [...kindsByName]
    .filter(([, kinds]) => kinds.size > 1)
    .map(([name, kinds]) => ({ name, kinds: [...kinds].sort() }))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return AssetIndexSchema.parse({ version: 1, entries: sorted, collisions });
}

/** Warnings for the migration report: cross-kind and case-insensitive name clashes. */
export function assetIndexWarnings(index: AssetIndex): string[] {
  const out: string[] = [];
  for (const c of index.collisions) {
    out.push(
      `Asset name "${c.name}" is used by more than one asset kind (${c.kinds.join(", ")}); the transpiler leaves a bare "${c.name}" reference unresolved.`,
    );
  }
  const lower = new Map<string, Set<string>>();
  for (const e of index.entries) {
    const k = e.name.toLowerCase();
    let s = lower.get(k);
    if (s === undefined) lower.set(k, (s = new Set()));
    s.add(e.name);
  }
  for (const names of lower.values()) {
    if (names.size > 1) {
      out.push(
        `Asset names differ only by case (${[...names].sort().join(", ")}); GML is case-sensitive but a case-insensitive filesystem will merge them.`,
      );
    }
  }
  return out;
}

export function assetIndexJSON(index: AssetIndex): string {
  return JSON.stringify(index, null, 2) + "\n";
}
