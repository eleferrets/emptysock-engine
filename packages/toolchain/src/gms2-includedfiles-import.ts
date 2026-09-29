import fs from "fs/promises";
import path from "path";
import type { YYIncludedFile } from "./gms2-parse.js";

/**
 * One converted Included File — the physical copy already landed at
 * `<outDir>/included/<relPath>` by the time this is returned; the manifest
 * entry is just the bookkeeping record of that copy.
 */
export interface IncludedFileEntry {
  name: string;
  /** Path relative to the output directory root, e.g. "included/lang.txt". */
  outPath: string;
  /** The raw CopyToMask this file's .yyp entry carried, for a developer who
   * needs genuine per-platform exclusion — see this module's own doc
   * comment for why this importer doesn't try to decode it further. */
  copyToMask: number;
}

/**
 * GameMaker's "Included Files" feature bundles arbitrary real files
 * (config, licence text, data files — a real project's own real example is
 * `datafiles/lang.txt`, read at runtime via the `file_text_*` family this
 * importer already supports — see CLAUDE.md's GmlFileSystem entry) into the
 * build. This is a genuine, load-bearing feature in real GameMaker
 * projects, previously entirely unimplemented here.
 *
 * `CopyToMask` is GameMaker's real per-target-platform deploy bitmask.
 * `-1` is documented (community + GameMaker's own manual phrasing) to mean
 * "deploy to every target". Any other value's individual bit positions are
 * derived from the *specific target modules enabled in that one IDE
 * install* — GameMaker never publishes a stable, version-independent
 * platform→bit table, and the same non-`-1` value can mean different
 * platforms on two different installs. Rather than fabricate a decoding
 * that would silently exclude a file from a real platform on a guess, this
 * importer copies every included file for every build target
 * unconditionally (the safe default — a file that ships everywhere is
 * never "missing" the way a wrongly-excluded one would be) and records the
 * real, undecoded `copyToMask` value on each manifest entry, so a developer
 * who genuinely needs per-platform exclusion has the real source value to
 * work from instead of this importer's guess.
 */
export async function convertGms2IncludedFiles(
  includedFiles: readonly YYIncludedFile[] | undefined,
  projectRoot: string,
  outDir: string,
): Promise<{ entries: IncludedFileEntry[]; warnings: string[] }> {
  const entries: IncludedFileEntry[] = [];
  const warnings: string[] = [];
  if (!includedFiles || includedFiles.length === 0) {
    return { entries, warnings };
  }

  const destRoot = path.join(outDir, "included");
  await fs.mkdir(destRoot, { recursive: true });

  for (const file of includedFiles) {
    if (!file.name) continue;
    const srcPath = path.join(
      projectRoot,
      file.filePath ?? "datafiles",
      file.name,
    );
    const destPath = path.join(destRoot, file.name);
    try {
      await fs.mkdir(path.dirname(destPath), { recursive: true });
      await fs.copyFile(srcPath, destPath);
      entries.push({
        name: file.name,
        outPath: path.join("included", file.name).replace(/\\/g, "/"),
        copyToMask: file.CopyToMask ?? -1,
      });
    } catch (err) {
      warnings.push(
        `Included file "${file.name}" could not be copied from "${srcPath}" (${String(err)}) — skipped.`,
      );
    }
  }

  return { entries, warnings };
}

/**
 * A plain JSON manifest listing every included file this import copied —
 * the same "engine/game reads plain data, no registration step" shape
 * `projectManifestJSON` already uses. A game's own bootstrap (host-specific
 * — Node fs, browser fetch, or Tauri's fs plugin, per the engine's own
 * "engine defines the interface, host wires the concrete backend" rule)
 * reads each entry's `outPath`, loads its real text content, and calls
 * `GmlFileSystem.preload(entry.name, content)` before any generated GML
 * code that reads it via `file_text_open_read` runs.
 */
export function includedFilesManifestJSON(
  entries: IncludedFileEntry[],
): string {
  return JSON.stringify({ includedFiles: entries }, null, 2) + "\n";
}
