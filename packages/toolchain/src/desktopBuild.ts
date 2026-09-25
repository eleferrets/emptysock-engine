/**
 * Real desktop export: bundles the game's entry point with Rolldown, drops
 * the result into a scaffolded Tauri v2 "game shell" project (see
 * gameShellTemplates.ts), and runs `cargo tauri build` against it — the
 * same thing the IDE's `export_game` Tauri command does
 * (apps/ide/src-tauri/src/lib.rs), so the CLI and the IDE produce build
 * output the same way instead of two divergent implementations.
 *
 * The bundler here is Rolldown (the real Node package `rolldown`), not
 * `@rolldown/browser` — this is the toolchain CLI's Node-side build, which
 * ENGINE_DESIGN.md §16.3/§17 migrates first and separately from the IDE's
 * in-browser `esbuild-wasm`/`GameBuildService` path (apps/ide's live
 * preview build). That path is untouched: it needs a WASM-compiled bundler
 * that runs inside the browser preview iframe, which is exactly what
 * `@rolldown/browser` would be for if/when that migration happens — a
 * separate spike per §17, not part of this one.
 *

 * What this does NOT do, and cannot do from one machine:
 *   - Cross-compile a macOS .dmg from Windows/Linux, or a Windows installer
 *     from macOS/Linux. Tauri needs the target OS's own toolchain, and a
 *     signed/notarised macOS build additionally needs real Apple hardware.
 *     Requesting a platform that doesn't match the host OS fails immediately
 *     with an explanation — never after a long build that was doomed from
 *     the start.
 *   - Produce a build without the Rust toolchain and `cargo tauri`
 *     installed locally. That is unavoidable: compiling a native binary
 *     requires a native compiler. `detect()` in ToolchainDetector.ts already
 *     surfaces whether these are present; this module checks again right
 *     before building and fails with install instructions if not.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";
import { rolldown } from "rolldown";
import {
  CARGO_TOML_TEMPLATE,
  TAURI_CONF_TEMPLATE,
  BUILD_RS,
  MAIN_RS,
  slugify,
} from "./gameShellTemplates.js";
import {
  loadIncludedFilesManifest,
  resolveIncludedFilesForPlatform,
  copyIncludedFiles,
} from "./includedFiles.js";

const exec = promisify(execFile);

export type DesktopPlatform = "windows" | "mac" | "linux";

export interface DesktopBuildOptions {
  platform: DesktopPlatform;
  /** Comma-separated Tauri bundle targets, e.g. "nsis,msi" or "appimage,deb". */
  format: string;
  entry: string;
  out: string;
  projectName?: string;
  minify?: boolean;
  dropConsole?: boolean;
  sourcemap?: boolean;
  aggressive?: boolean;
  /**
   * The project directory Included Files paths (in `build-included-files.json`)
   * are resolved against. Defaults to the entry file's own directory —
   * right for the common case of a project whose entry lives at the
   * project root, and overridable for anything else.
   */
  projectDir?: string;
  /** Explicit path to an included-files manifest, overriding the default `<projectDir>/build-included-files.json` lookup. */
  includedFilesManifest?: string;
}

export interface DesktopBuildResult {
  success: boolean;
  /** The real `src-tauri/target/release/bundle/` directory Tauri wrote to. */
  bundleDir?: string;
  /** Every artifact file found under bundleDir, copied into `out`. */
  artifacts?: string[];
  /** Every Included Files entry actually copied into the packaged app for this platform. */
  includedFiles?: string[];
  /** Non-fatal problems from copying Included Files (a missing source path, etc.) — never aborts the build. */
  includedFileWarnings?: string[];
  error?: string;
}

/** Maps our `--platform` values to the Rust target_os family Tauri builds for. */
function hostPlatform(): DesktopPlatform {
  switch (process.platform) {
    case "win32":
      return "windows";
    case "darwin":
      return "mac";
    default:
      return "linux";
  }
}

async function commandExists(cmd: string, args: string[]): Promise<boolean> {
  try {
    await exec(cmd, args);
    return true;
  } catch {
    return false;
  }
}

function walk(dir: string): string[] {
  let out: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out = out.concat(walk(full));
    else out.push(full);
  }
  return out;
}

export interface BundleGameEntryOptions {
  entry: string;
  minify?: boolean | undefined;
  dropConsole?: boolean | undefined;
  sourcemap?: boolean | undefined;
  aggressive?: boolean | undefined;
}

export type BundleGameEntryResult =
  | { success: true; code: string }
  | { success: false; error: string };

/**
 * Bundles a single game entry point into one IIFE string, in memory — the
 * Rolldown equivalent of esbuild's old `{ bundle: true, write: false,
 * format: "iife" }` call. Exported standalone (not just inlined in
 * `buildDesktopApp`) so it's testable without a Rust/`cargo tauri`
 * toolchain, which the rest of `buildDesktopApp` requires.
 */
export async function bundleGameEntry(
  opts: BundleGameEntryOptions,
): Promise<BundleGameEntryResult> {
  try {
    const bundle = await rolldown({
      input: path.resolve(opts.entry),
    });
    const minifyEnabled = opts.minify ?? true;
    const result = await bundle.generate({
      format: "iife",
      name: "EmptySockGame",
      sourcemap: opts.sourcemap === true ? "inline" : false,
      minify: minifyEnabled
        ? {
            compress: {
              // Rolldown/Oxc's minifier lowers syntax for a target itself
              // (unlike esbuild's separate `target` build option) — same
              // `es2020` ceiling as before.
              target: ["es2020"],
              dropConsole: opts.dropConsole === true,
            },
            ...(opts.aggressive === true
              ? { mangleProps: { include: /^_/ } }
              : {}),
          }
        : false,
    });
    await bundle.close();
    // Rolldown's own type ([OutputChunk, ...(OutputChunk | OutputAsset)[]])
    // guarantees output[0] exists and is a chunk — a single, un-code-split
    // entry always produces exactly that.
    return { success: true, code: result.output[0].code };
  } catch (e) {
    return {
      success: false,
      error: `Failed to bundle ${opts.entry}: ${String(e)}`,
    };
  }
}

export async function buildDesktopApp(
  opts: DesktopBuildOptions,
): Promise<DesktopBuildResult> {
  const host = hostPlatform();
  if (opts.platform !== host) {
    return {
      success: false,
      error:
        `Cannot build a ${opts.platform} package on this machine — this machine is ${host}. ` +
        `Cross-compiling a native desktop installer for a different OS is not supported from ` +
        `a single machine (Tauri needs the target OS's own toolchain, and macOS builds ` +
        `additionally need real Apple hardware for signing). Build ${opts.platform} targets on ` +
        `a ${opts.platform} machine, or set up a CI matrix build (one job per OS) instead.`,
    };
  }

  if (!(await commandExists("cargo", ["--version"]))) {
    return {
      success: false,
      error:
        "cargo (the Rust toolchain) is not installed. Desktop export compiles a real native " +
        "binary, which is unavoidable for producing a native installer. Install Rust from " +
        "https://rustup.rs, then re-run this command.",
    };
  }
  if (!(await commandExists("cargo", ["tauri", "--version"]))) {
    return {
      success: false,
      error:
        'The `cargo tauri` subcommand is not installed. Install with:\n\n  cargo install tauri-cli --version "^2"\n\n' +
        "(and, on Linux, the Tauri system dependencies: https://v2.tauri.app/start/prerequisites/)",
    };
  }

  // 1. Bundle the game's entry point with Rolldown, in memory.
  const bundled = await bundleGameEntry({
    entry: opts.entry,
    minify: opts.minify,
    dropConsole: opts.dropConsole,
    sourcemap: opts.sourcemap,
    aggressive: opts.aggressive,
  });
  if (!bundled.success) {
    return { success: false, error: bundled.error };
  }
  const gameJs = bundled.code;

  const projectName =
    opts.projectName ?? path.basename(opts.entry, path.extname(opts.entry));
  const slug = slugify(projectName);
  const tmpRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), `emptysock-export-${slug}-`),
  );
  const srcTauri = path.join(tmpRoot, "src-tauri");
  const dist = path.join(tmpRoot, "dist");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${projectName}</title>
  <style>*{margin:0;padding:0;box-sizing:border-box}body{background:#000;display:flex;align-items:center;justify-content:center;height:100dvh;overflow:hidden}canvas{display:block;max-width:100%;max-height:100%}</style>
</head>
<body>
  <canvas id="game-canvas"></canvas>
  <script src="game.js"></script>
</body>
</html>`;

  fs.mkdirSync(dist, { recursive: true });
  fs.writeFileSync(path.join(dist, "index.html"), html, "utf-8");
  fs.writeFileSync(path.join(dist, "game.js"), gameJs, "utf-8");

  // Included Files: copy this platform's subset of the project's
  // build-included-files.json manifest into the packaged app's own resource dir
  // (dist/included/), which tauri.conf.json's frontendDist ("../dist")
  // bundles alongside game.js/index.html — see includedFiles.ts's own doc
  // comment. No manifest at all (the common case) is a silent no-op, not a
  // warning — most projects have nothing to include.
  const projectDir = opts.projectDir ?? path.dirname(path.resolve(opts.entry));
  let includedFiles: string[] | undefined;
  let includedFileWarnings: string[] | undefined;
  try {
    const manifest = loadIncludedFilesManifest(
      projectDir,
      opts.includedFilesManifest,
    );
    if (manifest !== null) {
      const entries = resolveIncludedFilesForPlatform(manifest, opts.platform);
      const result = copyIncludedFiles(
        projectDir,
        entries,
        path.join(dist, "included"),
      );
      includedFiles = result.copied;
      includedFileWarnings = result.warnings;
      for (const w of result.warnings) {
        console.warn(`[included-files] ${w}`);
      }
    }
  } catch (err) {
    return { success: false, error: String(err) };
  }

  const identifier = `io.emptysock.game.${slug}`;
  const bundleTargets =
    opts.format.trim() === ""
      ? '"all"'
      : `[${opts.format
          .split(",")
          .map((f) => `"${f.trim()}"`)
          .join(",")}]`;

  fs.mkdirSync(path.join(srcTauri, "src"), { recursive: true });
  fs.writeFileSync(
    path.join(srcTauri, "Cargo.toml"),
    CARGO_TOML_TEMPLATE.replace(/{{package_name}}/g, slug),
    "utf-8",
  );
  fs.writeFileSync(
    path.join(srcTauri, "tauri.conf.json"),
    TAURI_CONF_TEMPLATE.replace(/{{product_name}}/g, projectName)
      .replace("{{identifier}}", identifier)
      .replace("{{bundle_targets}}", bundleTargets),
    "utf-8",
  );
  fs.writeFileSync(path.join(srcTauri, "build.rs"), BUILD_RS, "utf-8");
  fs.writeFileSync(path.join(srcTauri, "src", "main.rs"), MAIN_RS, "utf-8");

  try {
    await exec("cargo", ["tauri", "build"], {
      cwd: srcTauri,
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (e: unknown) {
    const stderr =
      e !== null && typeof e === "object" && "stderr" in e
        ? String((e as { stderr: unknown }).stderr)
        : String(e);
    return { success: false, error: `cargo tauri build failed:\n${stderr}` };
  }

  const bundleDir = path.join(srcTauri, "target", "release", "bundle");
  const artifacts = walk(bundleDir);

  fs.mkdirSync(opts.out, { recursive: true });
  const copied: string[] = [];
  for (const file of artifacts) {
    const rel = path.relative(bundleDir, file);
    const dest = path.join(opts.out, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(file, dest);
    copied.push(dest);
  }

  return {
    success: true,
    bundleDir,
    artifacts: copied,
    ...(includedFiles !== undefined ? { includedFiles } : {}),
    ...(includedFileWarnings !== undefined ? { includedFileWarnings } : {}),
  };
}
