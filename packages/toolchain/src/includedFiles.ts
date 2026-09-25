/**
 * Project-level "Included Files" — GameMaker's real Datafiles/Included
 * Files feature (arbitrary, non-code files bundled with the build, some
 * flagged for only certain platforms), for a project authored directly on
 * this engine rather than imported from GMS2. This is a distinct concept
 * from `gms2-includedfiles-import.ts`, which converts *that* GMS2-specific
 * resource kind during a one-time import; this module is the ongoing,
 * engine-native equivalent a game keeps authoring after import (or from
 * scratch), consumed by real build steps (`desktopBuild.ts` today).
 *
 * The manifest lives at `<projectDir>/build-included-files.json` by default
 * (a plain, hand-editable JSON file — no IDE authoring surface yet, the
 * same "toolchain emits/reads data, wiring an editor UI is a separate
 * follow-up" split this codebase already draws elsewhere, e.g. Prefab
 * `.d.ts` codegen). Deliberately NOT named `included-files.json` — that
 * name is already taken by `gms2-includedfiles-import.ts`'s own generated
 * output file in a GMS2 import's output directory, which uses a different,
 * incompatible shape (`{ includedFiles: [{ name, outPath, copyToMask }] }`,
 * one entry per already-copied GameMaker Included File, vs. this module's
 * `{ files: [{ path, platforms? }] }`, entries the *build* step still has
 * to resolve and copy). Reusing that filename for a different schema would
 * make a GMS2-imported project's own generated file collide with this
 * one's default lookup path.
 */
import * as fs from "node:fs";
import * as path from "node:path";

export const INCLUDED_FILES_MANIFEST_NAME = "build-included-files.json";

/** Mirrors the platform vocabulary `cli.ts`'s `export --platform` and `desktopBuild.ts`'s `DesktopPlatform` already use, plus "all" as an explicit wildcard. */
export type IncludedFilePlatform =
  | "all"
  | "windows"
  | "mac"
  | "linux"
  | "web"
  | "android"
  | "ios";

export interface IncludedFileEntry {
  /** File or directory path, relative to the manifest's own directory (a directory copies recursively). */
  path: string;
  /** Which platform(s) this entry ships to. Omitted, or containing "all", means every platform. */
  platforms?: IncludedFilePlatform[];
}

export interface IncludedFilesManifest {
  files: IncludedFileEntry[];
}

export function includedFilesManifestPath(
  projectDir: string,
  manifestPath?: string,
): string {
  return manifestPath
    ? path.resolve(manifestPath)
    : path.join(projectDir, INCLUDED_FILES_MANIFEST_NAME);
}

/**
 * Reads and validates the manifest at `manifestPath` (or the default
 * `<projectDir>/included-files.json`). Returns `null` — not an error — when
 * the file simply doesn't exist, since most projects have no included
 * files at all; a genuinely malformed manifest throws a descriptive error
 * instead of silently producing an empty file list.
 */
export function loadIncludedFilesManifest(
  projectDir: string,
  manifestPath?: string,
): IncludedFilesManifest | null {
  const resolved = includedFilesManifestPath(projectDir, manifestPath);
  if (!fs.existsSync(resolved)) return null;

  let raw: string;
  try {
    raw = fs.readFileSync(resolved, "utf-8");
  } catch (err) {
    throw new Error(
      `Cannot read included-files manifest "${resolved}": ${String(err)}`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `Invalid JSON in included-files manifest "${resolved}": ${String(err)}`,
    );
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !Array.isArray((parsed as { files?: unknown }).files)
  ) {
    throw new Error(
      `Included-files manifest "${resolved}" must be a JSON object with a "files" array, ` +
        `e.g. { "files": [{ "path": "readme.txt" }, { "path": "windows-only.dll", "platforms": ["windows"] }] }.`,
    );
  }

  const rawFiles = (parsed as { files: unknown[] }).files;
  const files: IncludedFileEntry[] = rawFiles.map((entry, i) => {
    if (typeof entry === "string") {
      return { path: entry, platforms: ["all"] };
    }
    if (
      typeof entry !== "object" ||
      entry === null ||
      typeof (entry as { path?: unknown }).path !== "string"
    ) {
      throw new Error(
        `Included-files manifest "${resolved}": entry ${i} must be a string path, or an object ` +
          `{ "path": string, "platforms"?: string[] }.`,
      );
    }
    const e = entry as { path: string; platforms?: unknown };
    const platforms: IncludedFilePlatform[] =
      Array.isArray(e.platforms) &&
      e.platforms.every((p) => typeof p === "string")
        ? (e.platforms as IncludedFilePlatform[])
        : (["all"] as IncludedFilePlatform[]);
    return { path: e.path, platforms };
  });

  return { files };
}

/** Filters a manifest's entries down to the ones that ship to `platform` — "all" (explicit, or the default when `platforms` is omitted) always matches. */
export function resolveIncludedFilesForPlatform(
  manifest: IncludedFilesManifest,
  platform: IncludedFilePlatform,
): IncludedFileEntry[] {
  return manifest.files.filter((entry) => {
    const platforms = entry.platforms ?? ["all"];
    return platforms.includes("all") || platforms.includes(platform);
  });
}

export interface CopyIncludedFilesResult {
  copied: string[];
  warnings: string[];
}

function copyRecursive(src: string, dest: string): string[] {
  const copied: string[] = [];
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const child of fs.readdirSync(src)) {
      copied.push(
        ...copyRecursive(path.join(src, child), path.join(dest, child)),
      );
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    copied.push(dest);
  }
  return copied;
}

/**
 * Copies every entry (already filtered to one platform via
 * `resolveIncludedFilesForPlatform`) from `projectDir` into `destDir`,
 * preserving each entry's relative path. A missing source file is a real,
 * named warning — never a silent skip or a thrown error that aborts the
 * whole build over one missing asset.
 */
export function copyIncludedFiles(
  projectDir: string,
  entries: readonly IncludedFileEntry[],
  destDir: string,
): CopyIncludedFilesResult {
  const copied: string[] = [];
  const warnings: string[] = [];

  for (const entry of entries) {
    const srcPath = path.resolve(projectDir, entry.path);
    if (!fs.existsSync(srcPath)) {
      warnings.push(
        `Included file "${entry.path}" not found at "${srcPath}" — skipped.`,
      );
      continue;
    }
    const destPath = path.join(destDir, entry.path);
    try {
      copied.push(...copyRecursive(srcPath, destPath));
    } catch (err) {
      warnings.push(
        `Failed to copy included file "${entry.path}": ${String(err)}`,
      );
    }
  }

  return { copied, warnings };
}
