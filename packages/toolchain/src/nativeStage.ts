import fs from "node:fs";
import path from "node:path";
import { bundleGameEntry } from "./desktopBuild.js";
import {
  stageIncludedFilesForPlatform,
  type IncludedFilePlatform,
} from "./includedFiles.js";

/** Platforms with no `buildDesktopApp` path: the CLI bundles + stages for them, native packaging stays with the platform's own tool. */
export type StagedNativePlatform = "android" | "ios" | "raspi";

/**
 * Where a platform's Included Files land under `<out>`, following each
 * platform's own "extra resources" convention: Android `assets/` (Gradle
 * `src/main/assets` source), iOS `Resources/` (an Xcode folder reference),
 * Raspberry Pi next to `game.js` (its `install.sh` copies the whole directory).
 */
export function includedFilesDestFor(
  platform: StagedNativePlatform,
  out: string,
): string {
  switch (platform) {
    case "android":
      return path.join(out, "assets", "included");
    case "ios":
      return path.join(out, "Resources", "included");
    case "raspi":
      return path.join(out, "included");
  }
}

export interface StageNativeOptions {
  platform: StagedNativePlatform;
  entry: string;
  out: string;
  minify?: boolean;
  dropConsole?: boolean;
  sourcemap?: boolean;
  aggressive?: boolean;
  /** Explicit `build-included-files.json` path; default resolves next to `entry`. */
  includedFilesManifest?: string | undefined;
}

export type StageNativeResult =
  | {
      success: true;
      /** Written files: the bundle, the export descriptor, then every staged Included File. */
      artifacts: string[];
      includedFiles: string[];
      warnings: string[];
    }
  | { success: false; error: string };

/**
 * The CLI's `export --platform android|ios|raspi` step: bundle the entry to
 * `<out>/game.js`, stage this platform's Included Files (`platforms`-filtered,
 * including `"raspi"` entries) at `includedFilesDestFor()`, and write
 * `<platform>-export.json` describing what was staged. It does not run
 * Gradle/Xcode or produce an apk/ipa: those need the platform's own SDK, which
 * `packages/export-utils` shells out to separately.
 */
export async function stageNativePlatform(
  opts: StageNativeOptions,
): Promise<StageNativeResult> {
  const bundle = await bundleGameEntry({
    entry: opts.entry,
    minify: opts.minify,
    dropConsole: opts.dropConsole,
    sourcemap: opts.sourcemap,
    aggressive: opts.aggressive,
  });
  if (!bundle.success) return { success: false, error: bundle.error };

  fs.mkdirSync(opts.out, { recursive: true });
  const gameJs = path.join(opts.out, "game.js");
  fs.writeFileSync(gameJs, bundle.code, "utf-8");

  const staged = stageIncludedFilesForPlatform(
    path.dirname(path.resolve(opts.entry)),
    opts.platform satisfies IncludedFilePlatform,
    includedFilesDestFor(opts.platform, opts.out),
    opts.includedFilesManifest,
  );
  const includedFiles = staged?.copied ?? [];

  const descriptor = path.join(opts.out, `${opts.platform}-export.json`);
  fs.writeFileSync(
    descriptor,
    JSON.stringify(
      {
        platform: opts.platform,
        entry: "game.js",
        includedDir: path.relative(
          opts.out,
          includedFilesDestFor(opts.platform, opts.out),
        ),
        includedFiles,
      },
      null,
      2,
    ),
    "utf-8",
  );

  return {
    success: true,
    artifacts: [gameJs, descriptor],
    includedFiles,
    warnings: staged?.warnings ?? [],
  };
}
