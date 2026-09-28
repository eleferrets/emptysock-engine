#!/usr/bin/env node
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import fs from "node:fs";
import { program } from "commander";
import { detectToolchain, formatToolchainReport } from "./ToolchainDetector.js";
import {
  loadToolchainSettings,
  saveToolchainSettings,
} from "./ToolchainSettings.js";
import { importGMS2Project } from "./gms2-import.js";
import { buildDesktopApp } from "./desktopBuild.js";
import { stageIncludedFilesForPlatform } from "./includedFiles.js";
import { runCodegenPrefabs } from "./prefabCodegenCli.js";

const exec = promisify(execFile);

program
  .name("emptysock-toolchain")
  .description("EmptySock Engine toolchain CLI")
  .version("0.1.0");

program
  .command("detect")
  .description("Detect installed toolchain tools")
  .action(() => {
    const settings = loadToolchainSettings(process.cwd());
    const report = detectToolchain(settings);
    console.log(formatToolchainReport(report));
  });

program
  .command("export")
  .description("Export a game build")
  .requiredOption(
    "--platform <platform>",
    "Target platform (web|linux|windows|mac)",
  )
  .option(
    "--format <format>",
    "Output format (zip|appimage|installer|deb|flatpak)",
  )
  .requiredOption("--entry <path>", "Entry file path")
  .requiredOption("--out <path>", "Output directory")
  .option("--minify", "Minify output", false)
  .option("--drop-console", "Remove console calls", false)
  .option("--sourcemap", "Emit sourcemaps", false)
  .option(
    "--aggressive",
    "Aggressive minification (tree-shaking + identifier minification)",
    false,
  )
  .option("--arch <arch>", "Target architecture (x86_64|aarch64)", "x86_64")
  .option(
    "--included-files <path>",
    "Path to a build-included-files.json manifest (default: <project-dir>/build-included-files.json, resolved next to --entry)",
  )
  .action(
    async (opts: {
      platform: string;
      format: string;
      entry: string;
      out: string;
      minify: boolean;
      dropConsole: boolean;
      sourcemap: boolean;
      aggressive: boolean;
      arch: string;
      includedFiles?: string;
    }) => {
      console.log(
        `Exporting for ${opts.platform} (${opts.arch}) — format: ${opts.format}`,
      );

      if (opts.platform === "web") {
        // Web export has no native binary to compile — it's just the
        // pre-built dist/ output plus an index.html, optionally zipped
        // (it doesn't invoke a bundler itself; see exportZip below).
        const webStaged = stageIncludedFilesForPlatform(
          path.dirname(path.resolve(opts.entry)),
          "web",
          path.join(opts.out, "dist", "included"),
          opts.includedFiles,
        );
        if (webStaged) {
          for (const w of webStaged.warnings)
            console.warn(`[included-files] ${w}`);
          console.log(`Included ${webStaged.copied.length} file(s) for web.`);
        }
        if (opts.format === "zip") {
          await exportZip({ platform: "web", arch: opts.arch, out: opts.out });
          return;
        }
        console.log(
          `Entry: ${opts.entry}\nOutput: ${opts.out}\n` +
            `Note: web builds aren't packaged unless --format zip is given.`,
        );
        return;
      }

      if (
        opts.platform === "windows" ||
        opts.platform === "mac" ||
        opts.platform === "linux"
      ) {
        // Real desktop builds: bundles the entry with Rolldown, scaffolds a
        // minimal Tauri v2 shell around it, and runs `cargo tauri build`.
        // See desktopBuild.ts for exactly what this can and can't do
        // (notably: no cross-compiling a different OS's installer).
        const wantsZipWrapper = opts.format.toLowerCase() === "zip";
        const format = mapLegacyFormat(opts.platform, opts.format);
        const result = await buildDesktopApp({
          platform: opts.platform,
          format,
          entry: opts.entry,
          out: opts.out,
          minify: opts.minify,
          dropConsole: opts.dropConsole,
          sourcemap: opts.sourcemap,
          aggressive: opts.aggressive,
          ...(opts.includedFiles !== undefined
            ? { includedFilesManifest: opts.includedFiles }
            : {}),
        });

        if (!result.success) {
          console.error(result.error);
          process.exitCode = 1;
          return;
        }

        console.log(`Built ${result.artifacts?.length ?? 0} artifact(s):`);
        for (const a of result.artifacts ?? []) console.log(`  ${a}`);
        if (result.includedFiles && result.includedFiles.length > 0) {
          console.log(
            `Included ${result.includedFiles.length} file(s) for ${opts.platform}.`,
          );
        }

        if (wantsZipWrapper) {
          // "--format zip" is not itself a tauri-bundler target (Tauri only
          // produces installers, not bare portable archives) — we build the
          // platform's normal bundle target above, then zip whatever came
          // out of it, so the caller gets one file to hand around.
          await zipDirectory(
            opts.out,
            `game-${opts.platform}-${opts.arch}.zip`,
          );
        }

        console.log(`\nDone. Output: ${opts.out}`);
        return;
      }

      console.error(`Unknown --platform "${opts.platform}"`);
      process.exitCode = 1;
    },
  );

/**
 * Translates the CLI's legacy per-platform format flags (kept for backward
 * compatibility with existing scripts) into the Tauri bundle target names
 * `cargo tauri build --bundles <list>` (and our tauri.conf.json `targets`)
 * actually understand.
 */
function mapLegacyFormat(
  platform: "windows" | "mac" | "linux",
  format: string | undefined,
): string {
  const f = (format ?? "").toLowerCase();
  if (platform === "windows") {
    if (f === "" || f === "zip" || f === "installer") return "nsis,msi";
    if (f === "msi") return "msi";
    if (f === "nsis") return "nsis";
    return f;
  }
  if (platform === "mac") {
    if (f === "" || f === "zip") return "dmg,app";
    return f;
  }
  // linux
  if (f === "" || f === "zip" || f === "appimage") return "appimage";
  if (f === "deb") return "deb";
  if (f === "flatpak") {
    console.warn(
      "Flatpak is not a tauri-bundler target — falling back to appimage,deb. " +
        "Build a Flatpak manifest around the resulting binary separately.",
    );
    return "appimage,deb";
  }
  return f;
}

program
  .command("import")
  .description("Import a project from another engine")
  .requiredOption("--from <engine>", "Source engine (currently only: gms2)")
  .requiredOption(
    "--project <path>",
    "Path to the source project file (e.g. game.yyp)",
  )
  .option(
    "--out <dir>",
    "Output directory (default: ./imported-<projectName>/)",
  )
  .option(
    "--dry-run",
    "Print what would be generated without writing files",
    false,
  )
  .option("--verbose", "Log each asset as it is processed", false)
  .option(
    "--compress-audio",
    "Re-encode uncompressed .wav sounds to Ogg/Vorbis at import time (requires ffmpeg on PATH; falls back to copying the original file, with a warning, if ffmpeg is unavailable)",
    false,
  )
  .action(
    async (opts: {
      from: string;
      project: string;
      out?: string;
      dryRun: boolean;
      verbose: boolean;
      compressAudio: boolean;
    }) => {
      if (opts.from !== "gms2") {
        console.error(
          `Unsupported --from value: "${opts.from}". Currently only "gms2" is supported.`,
        );
        console.error(
          "Example: emptysock-toolchain import --from gms2 --project game.yyp",
        );
        process.exit(1);
      }

      const yypPath = path.resolve(opts.project);

      // Derive default project name for output directory
      const projectName = path.basename(yypPath, ".yyp");
      const outDir = opts.out
        ? path.resolve(opts.out)
        : path.resolve(`./imported-${projectName}`);

      console.log(`Importing GMS2 project: ${yypPath}`);
      if (opts.dryRun) console.log("[dry-run mode — no files will be written]");
      console.log(`Output directory: ${outDir}`);

      const result = await importGMS2Project(yypPath, outDir, {
        dryRun: opts.dryRun,
        verbose: opts.verbose,
        compressAudio: opts.compressAudio,
      });

      console.log(`\nDone. Converted: ${result.converted} asset(s).`);
      if (result.skipped.length > 0) {
        console.log(
          `Skipped (manual work required): ${result.skipped.length} asset(s).`,
        );
      }
      if (result.warnings.length > 0) {
        console.log("\nWarnings:");
        for (const w of result.warnings) {
          console.warn(`  [warn] ${w}`);
        }
      }
      if (!opts.dryRun) {
        console.log(
          `\nSee ${path.join(outDir, "migration-report.md")} for next steps.`,
        );
      }
    },
  );

program
  .command("settings")
  .description("Manage toolchain settings")
  .option("--show", "Print current settings")
  .option("--set <key=value>", "Set a key=value pair")
  .action((opts: { show?: boolean; set?: string }) => {
    const settings = loadToolchainSettings(process.cwd());
    if (opts.show) {
      console.log(JSON.stringify(settings, null, 2));
    } else if (opts.set) {
      const eqIdx = opts.set.indexOf("=");
      if (eqIdx < 1) {
        console.error("--set requires key=value");
        process.exit(1);
      }
      const key = opts.set.slice(0, eqIdx);
      const val = opts.set.slice(eqIdx + 1);
      (settings as Record<string, unknown>)[key] = val;
      saveToolchainSettings(process.cwd(), settings);
      console.log(`Set ${key} = ${val}`);
    } else {
      console.log(JSON.stringify(settings, null, 2));
    }
  });

/**
 * Zips the web `dist/` build. Nothing native to compile here, so this stays
 * a plain archiving step — unlike the desktop platforms, it never assumed a
 * prebuilt binary already existed.
 */
async function exportZip(opts: {
  platform: "web";
  arch: string;
  out: string;
}): Promise<void> {
  if (!fs.existsSync(opts.out)) fs.mkdirSync(opts.out, { recursive: true });

  const zipName = `game-web-${opts.arch}-portable.zip`;
  const zipOut = path.join(opts.out, zipName);
  const distDir = path.join(opts.out, "dist");
  if (!fs.existsSync(distDir)) {
    console.error(`Web dist/ not found at ${distDir}. Run "pnpm build" first.`);
    process.exit(1);
  }
  console.log(`Zipping web build → ${zipName}`);
  await exec("zip", ["-r", zipOut, "dist"], { cwd: opts.out });
  console.log(`Portable web zip: ${zipOut}`);
  console.log(
    "To serve: unzip and run: npx serve dist  (or: python3 -m http.server --directory dist)",
  );
}

/**
 * Zips the full contents of a directory that `buildDesktopApp` already
 * populated with real `cargo tauri build` output — never a directory we
 * merely hope has a prebuilt binary sitting in it.
 */
async function zipDirectory(dir: string, zipName: string): Promise<void> {
  const zipOut = path.join(dir, zipName);
  console.log(`Zipping build output → ${zipName}`);
  try {
    if (process.platform === "win32") {
      const psCmd = `Compress-Archive -Path '${path.resolve(dir)}\\*' -DestinationPath '${zipOut}' -Force`;
      await exec("powershell", ["-NonInteractive", "-Command", psCmd]);
    } else {
      await exec("zip", ["-r", zipOut, "."], { cwd: dir });
    }
    console.log(`Zip: ${zipOut}`);
  } catch (e) {
    console.error(`Failed to zip build output: ${String(e)}`);
  }
}

program
  .command("codegen-prefabs")
  .description(
    "Generate a .d.ts file of PrefabDef declarations from a project's .prefab.json files",
  )
  .argument("<project-dir>", "Project directory to scan for .prefab.json files")
  .option(
    "--out <path>",
    "Output .d.ts path (default: <project-dir>/prefabs.generated.d.ts)",
  )
  .option(
    "--components <modules...>",
    "Extra compiled JS module(s) (e.g. dist/components.js) whose ComponentDef exports register the project's own components, in addition to @emptysock/engine's built-ins",
  )
  .action(
    async (
      projectDir: string,
      opts: { out?: string; components?: string[] },
    ) => {
      const dir = path.resolve(projectDir);
      if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
        console.error(`Not a directory: ${dir}`);
        process.exitCode = 1;
        return;
      }

      const result = await runCodegenPrefabs(dir, {
        ...(opts.out ? { out: path.resolve(opts.out) } : {}),
        componentModules: opts.components ?? [],
      });

      if (!result.ok) {
        console.error(result.error);
        process.exitCode = 1;
        return;
      }

      if (result.prefabCount === 0) {
        console.log(`No *.prefab.json files found under ${dir}.`);
        return;
      }

      console.log(
        `Generated ${result.prefabCount} prefab declaration(s) → ${result.outPath}`,
      );
    },
  );

program.parseAsync(process.argv).catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
