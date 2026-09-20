/**
 * AssetCollector — walks a project's source files for asset path references
 * (Sprite/Tilemap textures, AudioSystem sounds, fonts, JSON data assets such
 * as tilemap data, dialogue trees and save schemas) and reads the referenced
 * bytes from a FileStore so they can be bundled into a web export.
 *
 * Kept dependency-free (no DOM, no JSZip) so `collectReferencedAssetPaths`
 * is unit-testable directly under Node/Vitest.
 */

import type { FileStore } from "./AssetStore";
import type { AssetItem } from "../store/ideStore";

// Extensions the engine can load as an asset. Anything else referenced in a
// string literal is almost certainly not an asset path (e.g. a module
// specifier) and is ignored.
const ASSET_EXTENSIONS = [
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
  "ogg",
  "mp3",
  "wav",
  "flac",
  "ttf",
  "otf",
  "woff",
  "woff2",
  "json",
] as const;

const ASSET_LITERAL_RE = new RegExp(
  `['"\`]([^'"\`]+\\.(?:${ASSET_EXTENSIONS.join("|")}))['"\`]`,
  "gi",
);

/**
 * Scans every source file's text for quoted string literals ending in a
 * known asset extension (e.g. `texturePath: "assets/hero.png"`,
 * `audio.play("assets/sfx/jump.wav")`, `NavMeshSystem.load("levels/1.json")`).
 * Returns the deduplicated, normalised (leading "./" stripped) set of paths.
 */
export function collectReferencedAssetPaths(
  sourceFiles: Record<string, string>,
): string[] {
  const found = new Set<string>();
  for (const content of Object.values(sourceFiles)) {
    ASSET_LITERAL_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = ASSET_LITERAL_RE.exec(content)) !== null) {
      const raw = match[1];
      if (raw === undefined) continue;
      // Skip bare module-style specifiers ("@scope/pkg/data.json") and
      // anything that still looks like an import specifier rather than an
      // asset path is intentionally still included — the export step below
      // reports it as missing rather than guessing, which surfaces the
      // problem to the developer instead of silently dropping it.
      const normalised = raw.replace(/^\.\//, "");
      found.add(normalised);
    }
  }
  return [...found].sort();
}

export interface CollectedAsset {
  path: string;
  blob: Blob;
  bytes: number;
}

export interface AssetCollectionResult {
  assets: CollectedAsset[];
  missing: string[];
  totalBytes: number;
}

/**
 * Reads every referenced asset path's real bytes from the given store. Also
 * always includes any asset registered in the project's asset registry
 * (ideStore's `assets` list) that is not already covered by a source-code
 * reference, so JSON/tilemap/dialogue data that is loaded indirectly (e.g.
 * by name/id rather than a literal path in the entry script) is still
 * bundled when it is a known project asset. Paths that cannot be read are
 * reported in `missing` instead of throwing, so one broken reference does
 * not abort the whole export.
 */
export async function collectProjectAssets(
  referencedPaths: string[],
  registryAssets: AssetItem[],
  store: FileStore,
  onProgress?: (done: number, total: number, bytes: number) => void,
): Promise<AssetCollectionResult> {
  const allPaths = new Set<string>(referencedPaths);
  for (const asset of registryAssets) {
    if (asset.type !== "script" && asset.type !== "scene") {
      allPaths.add(asset.path);
    }
  }

  const paths = [...allPaths];
  const assets: CollectedAsset[] = [];
  const missing: string[] = [];
  let totalBytes = 0;

  for (let i = 0; i < paths.length; i++) {
    const path = paths[i];
    if (path === undefined) continue;
    try {
      const blob = await store.read(path);
      assets.push({ path, blob, bytes: blob.size });
      totalBytes += blob.size;
    } catch {
      missing.push(path);
    }
    onProgress?.(i + 1, paths.length, totalBytes);
  }

  return { assets, missing, totalBytes };
}
