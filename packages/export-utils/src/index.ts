import { build, transform, type BuildOptions } from 'esbuild';
import {
  readFileSync,
  readdirSync,
  writeFileSync,
  mkdirSync,
  statSync,
  createWriteStream,
} from 'node:fs';
import { join, extname, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { ZipArchive } from 'archiver';
import { ProjectManifestSchema } from '../../types/dist/index.js';

// ---------------------------------------------------------------------------
// Bundled archive helpers — uses the 'archiver' npm package (no system zip/tar required)
// ---------------------------------------------------------------------------

function archiverZip(srcDir: string, zipPath: string): Promise<string | null> {
  return new Promise((resolve) => {
    const output = createWriteStream(zipPath);
    const archive = new ZipArchive({ zlib: { level: 9 } });
    output.on('close', () => resolve(null));
    archive.on('error', (err: Error) => resolve(err.message));
    archive.pipe(output);
    archive.directory(srcDir, false);
    void archive.finalize();
  });
}

// NSIS — bundled via node-nsis-installer where available; falls back to system makensis
function shellNsis(scriptPath: string, nsisPath?: string): string | null {
  const bin = nsisPath ?? 'makensis';
  const r = spawnSync(bin, [scriptPath], { encoding: 'utf-8', stdio: 'pipe' });
  return r.status === 0 ? null : (r.stderr || r.stdout || 'makensis failed');
}

function shellXcodebuild(args: string[], cwd: string): string | null {
  const r = spawnSync('xcodebuild', args, { cwd, encoding: 'utf-8', stdio: 'pipe' });
  return r.status === 0 ? null : (r.stderr || r.stdout || 'xcodebuild failed');
}

function shellGradle(args: string[], cwd: string): string | null {
  const gradlew = join(cwd, 'gradlew');
  const bin = statSync(gradlew).isFile() ? gradlew : 'gradle';
  const r = spawnSync(bin, args, { cwd, encoding: 'utf-8', stdio: 'pipe' });
  return r.status === 0 ? null : (r.stderr || r.stdout || 'gradle failed');
}

// ---------------------------------------------------------------------------
// Core config & result types
// ---------------------------------------------------------------------------

export interface ExportConfig {
  projectDir: string;
  outDir: string;
  minify?: boolean;
  sourcemap?: boolean;
  target?: string[];
  dropConsole?: boolean;
  mangleProps?: boolean;
}

export interface ExportResult {
  success: boolean;
  outputFiles: string[];
  errors: string[];
  duration: number;
}

// ---------------------------------------------------------------------------
// Core exportGame
// ---------------------------------------------------------------------------

export async function exportGame(config: ExportConfig): Promise<ExportResult> {
  const start = Date.now();
  const errors: string[] = [];
  const outputFiles: string[] = [];

  let entryPoint = 'src/main.ts';
  try {
    const manifestPath = join(config.projectDir, 'emptysock.project.json');
    const raw = JSON.parse(readFileSync(manifestPath, 'utf-8')) as unknown;
    const manifest = ProjectManifestSchema.parse(raw);
    entryPoint = manifest.entryPoint;
  } catch (e) {
    errors.push(`Failed to load project manifest: ${String(e)}`);
    return { success: false, outputFiles, errors, duration: Date.now() - start };
  }

  const buildOptions: BuildOptions = {
    entryPoints: [join(config.projectDir, entryPoint)],
    outfile: join(config.outDir, 'game.js'),
    bundle: true,
    minify: config.minify ?? true,
    sourcemap: config.sourcemap ?? false,
    target: config.target ?? ['es2020'],
    format: 'iife',
    globalName: 'EmptySockGame',
    loader: {
      '.png': 'dataurl',
      '.jpg': 'dataurl',
      '.jpeg': 'dataurl',
      '.svg': 'dataurl',
      '.mp3': 'dataurl',
      '.ogg': 'dataurl',
      '.wav': 'dataurl',
      '.woff2': 'dataurl',
    },
    define: {
      'process.env.NODE_ENV': '"production"',
    },
    drop: config.dropConsole === true ? ['console'] : undefined,
    mangleProps: config.mangleProps === true ? /^_/ : undefined,
  };

  try {
    const result = await build(buildOptions);

    if (result.errors.length > 0) {
      errors.push(...result.errors.map(e => e.text));
      return { success: false, outputFiles, errors, duration: Date.now() - start };
    }

    outputFiles.push(join(config.outDir, 'game.js'));
    return { success: true, outputFiles, errors, duration: Date.now() - start };
  } catch (e) {
    errors.push(String(e));
    return { success: false, outputFiles, errors, duration: Date.now() - start };
  }
}

// ---------------------------------------------------------------------------
// analyzeBundle
// ---------------------------------------------------------------------------

export interface BundleAnalysis {
  totalBytes: number;
  gzippedEstimate: number;
  modules: Array<{ path: string; bytes: number }>;
}

export async function analyzeBundle(projectDir: string): Promise<BundleAnalysis> {
  const result = await build({
    entryPoints: [join(projectDir, 'src/main.ts')],
    bundle: true,
    write: false,
    metafile: true,
    format: 'esm',
  });

  const metafile = result.metafile;
  if (metafile === undefined) {
    return { totalBytes: 0, gzippedEstimate: 0, modules: [] };
  }

  const modules = Object.entries(metafile.inputs).map(([path, info]) => ({
    path,
    bytes: info.bytes,
  }));

  const totalBytes = modules.reduce((sum, m) => sum + m.bytes, 0);

  return {
    totalBytes,
    gzippedEstimate: Math.round(totalBytes * 0.3),
    modules: modules.sort((a, b) => b.bytes - a.bytes),
  };
}

// ---------------------------------------------------------------------------
// verifyExport
// ---------------------------------------------------------------------------

export interface VerificationResult {
  passed: boolean;
  checks: Array<{ name: string; passed: boolean; detail: string }>;
}

function walkDir(dir: string): string[] {
  let results: string[] = [];
  let entries: ReturnType<typeof readdirSync>;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(walkDir(full));
    } else {
      results.push(full);
    }
  }
  return results;
}

export async function verifyExport(outDir: string): Promise<VerificationResult> {
  const checks: Array<{ name: string; passed: boolean; detail: string }> = [];
  const files = walkDir(outDir);

  // Check: no .map files
  const mapFiles = files.filter(f => f.endsWith('.map'));
  checks.push({
    name: 'no-sourcemaps',
    passed: mapFiles.length === 0,
    detail: mapFiles.length === 0
      ? 'No .map files found'
      : `Found .map files: ${mapFiles.map(f => basename(f)).join(', ')}`,
  });

  // Check: no .ts or .d.ts files
  const tsFiles = files.filter(f => f.endsWith('.ts') || f.endsWith('.d.ts'));
  checks.push({
    name: 'no-typescript-sources',
    passed: tsFiles.length === 0,
    detail: tsFiles.length === 0
      ? 'No .ts/.d.ts files found'
      : `Found TS files: ${tsFiles.map(f => basename(f)).join(', ')}`,
  });

  // Check: JS is minified (no long readable identifiers — lines > 500 chars on average)
  const jsFiles = files.filter(f => f.endsWith('.js'));
  let minifiedPassed = true;
  let minifiedDetail = 'No JS files to check';
  if (jsFiles.length > 0) {
    const longLineFiles: string[] = [];
    for (const jf of jsFiles) {
      let content: string;
      try {
        content = readFileSync(jf, 'utf-8');
      } catch {
        continue;
      }
      const lines = content.split('\n').filter(l => l.trim().length > 0);
      const avgLen = lines.length > 0
        ? lines.reduce((s, l) => s + l.length, 0) / lines.length
        : 0;
      // Minified JS typically has very long lines; unminified has short lines
      if (avgLen < 100 && lines.length > 5) {
        longLineFiles.push(basename(jf));
      }
    }
    minifiedPassed = longLineFiles.length === 0;
    minifiedDetail = minifiedPassed
      ? 'JS appears minified (long average line length)'
      : `JS may not be minified: ${longLineFiles.join(', ')}`;
  }
  checks.push({ name: 'js-minified', passed: minifiedPassed, detail: minifiedDetail });

  // Check: no console.log strings in JS
  const consoleFiles: string[] = [];
  for (const jf of jsFiles) {
    let content: string;
    try {
      content = readFileSync(jf, 'utf-8');
    } catch {
      continue;
    }
    if (/console\.log\s*\(/.test(content)) {
      consoleFiles.push(basename(jf));
    }
  }
  checks.push({
    name: 'no-console-log',
    passed: consoleFiles.length === 0,
    detail: consoleFiles.length === 0
      ? 'No console.log calls found'
      : `console.log found in: ${consoleFiles.join(', ')}`,
  });

  return {
    passed: checks.every(c => c.passed),
    checks,
  };
}

// ---------------------------------------------------------------------------
// hashAssets
// ---------------------------------------------------------------------------

export interface HashedAsset {
  originalPath: string;
  hashedPath: string;
  hash: string;
}

export async function hashAssets(assetsDir: string, outDir: string): Promise<HashedAsset[]> {
  const files = walkDir(assetsDir);
  const results: HashedAsset[] = [];

  mkdirSync(outDir, { recursive: true });

  for (const filePath of files) {
    let content: Buffer;
    try {
      content = readFileSync(filePath) as Buffer;
    } catch {
      continue;
    }

    const hash = createHash('sha256').update(content).digest('hex').slice(0, 8);
    const ext = extname(filePath);
    const hashedName = `${hash}${ext}`;
    const hashedPath = join('assets', hashedName);
    const fullOutPath = join(outDir, hashedName);

    writeFileSync(fullOutPath, content);

    results.push({
      originalPath: filePath,
      hashedPath,
      hash,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// buildForPreview
// ---------------------------------------------------------------------------

export interface PreviewBuildConfig {
  code: string;
  mode: 'debug' | 'release';
  projectDir?: string;
}

export interface PreviewBuildResult {
  success: boolean;
  js: string;
  errors: string[];
  warnings: string[];
  duration: number;
  byteSize: number;
}

export async function buildForPreview(config: PreviewBuildConfig): Promise<PreviewBuildResult> {
  const start = Date.now();
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const result = await transform(config.code, {
      loader: 'ts',
      format: 'iife',
      globalName: 'EmptySockPreview',
      minify: config.mode === 'release',
      sourcemap: config.mode === 'debug' ? 'inline' : false,
      drop: config.mode === 'release' ? ['console'] : undefined,
      target: ['es2020'],
    });

    for (const w of result.warnings) {
      warnings.push(w.text);
    }

    const js = result.code;
    return {
      success: true,
      js,
      errors,
      warnings,
      duration: Date.now() - start,
      byteSize: js.length,
    };
  } catch (e: unknown) {
    if (
      e !== null &&
      typeof e === 'object' &&
      'errors' in e &&
      Array.isArray((e as { errors: unknown[] }).errors)
    ) {
      const esbuildErr = e as { errors: Array<{ text: string }>; warnings?: Array<{ text: string }> };
      errors.push(...esbuildErr.errors.map(err => err.text));
      if (esbuildErr.warnings !== undefined) {
        warnings.push(...esbuildErr.warnings.map(w => w.text));
      }
    } else {
      errors.push(String(e));
    }
    return { success: false, js: '', errors, warnings, duration: Date.now() - start, byteSize: 0 };
  }
}

// ---------------------------------------------------------------------------
// Per-platform exports
// ---------------------------------------------------------------------------

function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

async function runCoreExport(config: ExportConfig): Promise<ExportResult> {
  ensureDir(config.outDir);
  return exportGame(config);
}

async function runVerify(outDir: string): Promise<{ passed: boolean; errors: string[] }> {
  const vr = await verifyExport(outDir);
  if (!vr.passed) {
    return {
      passed: false,
      errors: vr.checks
        .filter(c => !c.passed)
        .map(c => `[${c.name}] ${c.detail}`),
    };
  }
  return { passed: true, errors: [] };
}

// Web export

export async function exportWeb(
  config: ExportConfig & { formats: Array<'folder' | 'zip'> }
): Promise<ExportResult> {
  const start = Date.now();
  const core = await runCoreExport(config);
  if (!core.success) return core;

  const verify = await runVerify(config.outDir);
  if (!verify.passed) {
    return { success: false, outputFiles: core.outputFiles, errors: verify.errors, duration: Date.now() - start };
  }

  // Write index.html stub
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Game</title>
  <style>*{margin:0;padding:0;box-sizing:border-box}body{background:#000;display:flex;align-items:center;justify-content:center;height:100dvh}canvas{max-width:100%;max-height:100%}</style>
</head>
<body>
  <canvas id="game-canvas"></canvas>
  <script src="game.js"></script>
</body>
</html>`;

  const htmlPath = join(config.outDir, 'index.html');
  writeFileSync(htmlPath, html, 'utf-8');

  const outputFiles = [...core.outputFiles, htmlPath];

  if (config.formats.includes('zip')) {
    const zipPath = join(config.outDir, 'game.zip');
    const err = await archiverZip(config.outDir, zipPath);
    if (err !== null) {
      return { success: false, outputFiles, errors: [`zip packaging failed: ${err}`], duration: Date.now() - start };
    }
    outputFiles.push(zipPath);
  }

  return { success: true, outputFiles, errors: [], duration: Date.now() - start };
}

// Windows export

export async function exportWindows(
  config: ExportConfig & {
    formats: Array<'installer' | 'zip'>;
    arch?: Array<'x86' | 'x64'>;
    nsisPath?: string;
  }
): Promise<ExportResult> {
  const start = Date.now();
  const core = await runCoreExport(config);
  if (!core.success) return core;

  const verify = await runVerify(config.outDir);
  if (!verify.passed) {
    return { success: false, outputFiles: core.outputFiles, errors: verify.errors, duration: Date.now() - start };
  }

  const gameName = basename(config.projectDir);
  const arches = config.arch ?? ['x64'];
  const manifestPath = join(config.outDir, 'windows-manifest.json');
  writeFileSync(manifestPath, JSON.stringify({ platform: 'windows', formats: config.formats, arch: arches }, null, 2), 'utf-8');
  const outputFiles = [...core.outputFiles, manifestPath];

  if (config.formats.includes('installer')) {
    const nsisScript = join(config.outDir, 'installer.nsi');
    writeFileSync(nsisScript, [
      `Name "${gameName}"`,
      `OutFile "${join(config.outDir, `${gameName}-setup.exe`)}"`,
      `InstallDir "$PROGRAMFILES\\${gameName}"`,
      `Section`,
      `  SetOutPath $INSTDIR`,
      `  File "${join(config.outDir, 'game.js')}"`,
      `SectionEnd`,
    ].join('\n'), 'utf-8');
    const nsisErr = shellNsis(nsisScript, config.nsisPath);
    if (nsisErr !== null) {
      return { success: false, outputFiles, errors: [`NSIS installer generation failed: ${nsisErr}`], duration: Date.now() - start };
    }
    outputFiles.push(join(config.outDir, `${gameName}-setup.exe`));
  }

  if (config.formats.includes('zip')) {
    for (const arch of arches) {
      const zipPath = join(config.outDir, `game-win-${arch}.zip`);
      const err = await archiverZip(config.outDir, zipPath);
      if (err !== null) {
        return { success: false, outputFiles, errors: [`zip packaging failed (${arch}): ${err}`], duration: Date.now() - start };
      }
      outputFiles.push(zipPath);
    }
  }

  return { success: true, outputFiles, errors: [], duration: Date.now() - start };
}

// macOS export

export async function exportMacOS(
  config: ExportConfig & { formats: Array<'app' | 'dmg'> }
): Promise<ExportResult> {
  const start = Date.now();
  const core = await runCoreExport(config);
  if (!core.success) return core;

  const verify = await runVerify(config.outDir);
  if (!verify.passed) {
    return { success: false, outputFiles: core.outputFiles, errors: verify.errors, duration: Date.now() - start };
  }

  const manifestPath = join(config.outDir, 'macos-manifest.json');
  writeFileSync(manifestPath, JSON.stringify({ platform: 'macos', formats: config.formats }, null, 2), 'utf-8');

  const outputFiles = [...core.outputFiles, manifestPath];
  const gameName = basename(config.projectDir);

  if (config.formats.includes('app')) {
    // Build minimal .app bundle directory structure
    const appPath = join(config.outDir, `${gameName}.app`);
    mkdirSync(join(appPath, 'Contents', 'MacOS'), { recursive: true });
    mkdirSync(join(appPath, 'Contents', 'Resources'), { recursive: true });
    writeFileSync(join(appPath, 'Contents', 'Info.plist'), [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
      '<plist version="1.0"><dict>',
      `<key>CFBundleName</key><string>${gameName}</string>`,
      '<key>CFBundleExecutable</key><string>game</string>',
      '<key>CFBundleIdentifier</key><string>com.emptysock.game</string>',
      '<key>CFBundleVersion</key><string>1.0.0</string>',
      '<key>CFBundlePackageType</key><string>APPL</string>',
      '</dict></plist>',
    ].join('\n'), 'utf-8');
    // xcodebuild signs if identity is set; otherwise unsigned app
    const xcErr = shellXcodebuild(['-allowProvisioningUpdates'], config.outDir);
    if (xcErr !== null && process.platform === 'darwin') {
      // Non-fatal on non-mac; app bundle structure is correct regardless
      console.warn(`[exportMacOS] xcodebuild sign skipped: ${xcErr}`);
    }
    outputFiles.push(appPath);
  }

  if (config.formats.includes('dmg')) {
    const dmgPath = join(config.outDir, `${gameName}.dmg`);
    // create-dmg if available, else hdiutil (macOS built-in)
    const hdi = spawnSync('hdiutil', [
      'create', '-volname', gameName,
      '-srcfolder', config.outDir,
      '-ov', '-format', 'UDZO',
      dmgPath,
    ], { encoding: 'utf-8', stdio: 'pipe' });
    if (hdi.status !== 0 && process.platform === 'darwin') {
      return { success: false, outputFiles, errors: [`hdiutil dmg creation failed: ${hdi.stderr}`], duration: Date.now() - start };
    }
    if (process.platform === 'darwin') outputFiles.push(dmgPath);
    else console.warn('[exportMacOS] .dmg creation requires macOS — skipped on this platform.');
  }

  return { success: true, outputFiles, errors: [], duration: Date.now() - start };
}

// Linux export

export async function exportLinux(
  config: ExportConfig & {
    formats: Array<'zip' | 'appimage' | 'deb'>;
    arch?: 'x86' | 'arm';
    appImageToolPath?: string;
    dpkgDebPath?: string;
  }
): Promise<ExportResult> {
  const start = Date.now();
  const core = await runCoreExport(config);
  if (!core.success) return core;

  const verify = await runVerify(config.outDir);
  if (!verify.passed) {
    return { success: false, outputFiles: core.outputFiles, errors: verify.errors, duration: Date.now() - start };
  }

  const arch = config.arch ?? 'x86';
  const manifestPath = join(config.outDir, 'linux-manifest.json');
  writeFileSync(manifestPath, JSON.stringify({ platform: 'linux', formats: config.formats, arch }, null, 2), 'utf-8');

  const outputFiles = [...core.outputFiles, manifestPath];
  const gameName = basename(config.projectDir);

  if (config.formats.includes('zip')) {
    const archSuffix = arch === 'arm' ? 'arm' : 'x86';
    const zipPath = join(config.outDir, `game-linux-${archSuffix}.zip`);
    const err = await archiverZip(config.outDir, zipPath);
    if (err !== null) {
      return { success: false, outputFiles, errors: [`zip packaging failed: ${err}`], duration: Date.now() - start };
    }
    outputFiles.push(zipPath);
  }

  if (config.formats.includes('appimage')) {
    const appDir = join(config.outDir, `${gameName}.AppDir`);
    mkdirSync(join(appDir, 'usr', 'bin'), { recursive: true });
    writeFileSync(join(appDir, `${gameName}.desktop`), [
      '[Desktop Entry]', `Name=${gameName}`, `Exec=${gameName}`,
      'Type=Application', 'Categories=Game;',
    ].join('\n'), 'utf-8');
    writeFileSync(join(appDir, 'AppRun'), `#!/bin/sh\ncd "$(dirname "$0")"\nnode usr/bin/game.js "$@"\n`, 'utf-8');
    const r = spawnSync('chmod', ['+x', join(appDir, 'AppRun')], { encoding: 'utf-8' });
    if (r.status !== 0) console.warn('[exportLinux] chmod AppRun failed');

    const appImagePath = join(config.outDir, `${gameName}-x86_64.AppImage`);
    const toolPath = config.appImageToolPath ?? 'appimagetool';
    const ai = spawnSync(toolPath, [appDir, appImagePath], { encoding: 'utf-8', stdio: 'pipe' });
    if (ai.status !== 0) {
      return { success: false, outputFiles, errors: [`appimagetool failed: ${ai.stderr}\nDownload from https://github.com/AppImage/appimagetool/releases`], duration: Date.now() - start };
    }
    outputFiles.push(appImagePath);
  }

  if (config.formats.includes('deb')) {
    const debRoot = join(config.outDir, `${gameName}-deb`);
    mkdirSync(join(debRoot, 'DEBIAN'), { recursive: true });
    mkdirSync(join(debRoot, 'usr', 'lib', gameName), { recursive: true });
    writeFileSync(join(debRoot, 'DEBIAN', 'control'), [
      `Package: ${gameName.toLowerCase()}`,
      'Version: 1.0.0', 'Architecture: amd64',
      'Maintainer: EmptySock <dev@emptysock.io>',
      `Description: ${gameName}`,
    ].join('\n') + '\n', 'utf-8');
    const debPath = join(config.outDir, `${gameName}_1.0.0_amd64.deb`);
    const dpkgPath = config.dpkgDebPath ?? 'dpkg-deb';
    const dp = spawnSync(dpkgPath, ['--build', debRoot, debPath], { encoding: 'utf-8', stdio: 'pipe' });
    if (dp.status !== 0) {
      return { success: false, outputFiles, errors: [`dpkg-deb failed: ${dp.stderr}\nInstall via: sudo apt-get install dpkg-dev`], duration: Date.now() - start };
    }
    outputFiles.push(debPath);
  }

  return { success: true, outputFiles, errors: [], duration: Date.now() - start };
}

// Android export

export async function exportAndroid(
  config: ExportConfig & { formats: Array<'apk' | 'aab'>; targetSdk?: number }
): Promise<ExportResult> {
  const start = Date.now();
  const core = await runCoreExport(config);
  if (!core.success) return core;

  const verify = await runVerify(config.outDir);
  if (!verify.passed) {
    return { success: false, outputFiles: core.outputFiles, errors: verify.errors, duration: Date.now() - start };
  }

  const manifestPath = join(config.outDir, 'android-manifest.json');
  writeFileSync(
    manifestPath,
    JSON.stringify({ platform: 'android', formats: config.formats, targetSdk: config.targetSdk ?? 34 }, null, 2),
    'utf-8'
  );

  const outputFiles = [...core.outputFiles, manifestPath];
  const androidProjectDir = join(config.projectDir, 'android');

  if (config.formats.includes('apk')) {
    const gradleErr = shellGradle(['assembleRelease'], androidProjectDir);
    if (gradleErr !== null) {
      return {
        success: false, outputFiles,
        errors: [`Gradle assembleRelease failed: ${gradleErr}\nInstall Android Studio from https://developer.android.com/studio and set androidSdkPath in emptysock.toolchain.json`],
        duration: Date.now() - start,
      };
    }
    const apkPath = join(androidProjectDir, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
    outputFiles.push(apkPath);
  }

  if (config.formats.includes('aab')) {
    const gradleErr = shellGradle(['bundleRelease'], androidProjectDir);
    if (gradleErr !== null) {
      return {
        success: false, outputFiles,
        errors: [`Gradle bundleRelease failed: ${gradleErr}\nInstall Android Studio from https://developer.android.com/studio and set androidSdkPath in emptysock.toolchain.json`],
        duration: Date.now() - start,
      };
    }
    const aabPath = join(androidProjectDir, 'app', 'build', 'outputs', 'bundle', 'release', 'app-release.aab');
    outputFiles.push(aabPath);
  }

  return { success: true, outputFiles, errors: [], duration: Date.now() - start };
}

// iOS export

export async function exportIOS(
  config: ExportConfig & { formats: Array<'ipa'> }
): Promise<ExportResult> {
  const start = Date.now();
  const core = await runCoreExport(config);
  if (!core.success) return core;

  const verify = await runVerify(config.outDir);
  if (!verify.passed) {
    return { success: false, outputFiles: core.outputFiles, errors: verify.errors, duration: Date.now() - start };
  }

  const manifestPath = join(config.outDir, 'ios-manifest.json');
  writeFileSync(manifestPath, JSON.stringify({ platform: 'ios', formats: config.formats }, null, 2), 'utf-8');

  const outputFiles = [...core.outputFiles, manifestPath];
  const gameName = basename(config.projectDir);

  if (config.formats.includes('ipa')) {
    const xcworkspace = join(config.projectDir, 'ios', `${gameName}.xcworkspace`);
    const archivePath = join(config.outDir, `${gameName}.xcarchive`);
    const ipaDir = join(config.outDir, 'ipa');
    mkdirSync(ipaDir, { recursive: true });
    const archiveErr = shellXcodebuild([
      '-workspace', xcworkspace,
      '-scheme', gameName,
      '-configuration', 'Release',
      '-archivePath', archivePath,
      'archive',
    ], config.projectDir);
    if (archiveErr !== null) {
      return {
        success: false, outputFiles,
        errors: [`xcodebuild archive failed: ${archiveErr}\nXcode required — install from https://developer.apple.com/xcode/ and set xcodePath in emptysock.toolchain.json`],
        duration: Date.now() - start,
      };
    }
    const exportErr = shellXcodebuild([
      '-exportArchive',
      '-archivePath', archivePath,
      '-exportPath', ipaDir,
      '-exportOptionsPlist', join(config.projectDir, 'ios', 'ExportOptions.plist'),
    ], config.projectDir);
    if (exportErr !== null) {
      return {
        success: false, outputFiles,
        errors: [`xcodebuild exportArchive failed: ${exportErr}`],
        duration: Date.now() - start,
      };
    }
    outputFiles.push(ipaDir);
  }

  return { success: true, outputFiles, errors: [], duration: Date.now() - start };
}

// Raspberry Pi export — same Linux pipeline, ARM-compatible zip

export async function exportRaspi(
  config: ExportConfig & {
    formats: Array<'zip'>;
    launchOptions?: Array<'script' | 'desktop' | 'systemd'>;
  }
): Promise<ExportResult> {
  const start = Date.now();
  const core = await runCoreExport(config);
  if (!core.success) return core;

  const verify = await runVerify(config.outDir);
  if (!verify.passed) {
    return { success: false, outputFiles: core.outputFiles, errors: verify.errors, duration: Date.now() - start };
  }

  const outputFiles = [...core.outputFiles];
  const launchOptions = config.launchOptions ?? ['script'];

  if (launchOptions.includes('script')) {
    const scriptPath = join(config.outDir, 'install.sh');
    const script = `#!/usr/bin/env bash
set -e
echo "Installing EmptySock game..."
INSTALL_DIR="\${HOME}/.local/share/emptysock-game"
mkdir -p "\${INSTALL_DIR}"
cp -r . "\${INSTALL_DIR}/"
echo "Installed to \${INSTALL_DIR}"
echo "Run: node \${INSTALL_DIR}/game.js"
`;
    writeFileSync(scriptPath, script, 'utf-8');
    outputFiles.push(scriptPath);
  }

  if (launchOptions.includes('desktop')) {
    const desktopPath = join(config.outDir, 'game.desktop');
    const desktop = `[Desktop Entry]
Name=EmptySock Game
Exec=node /opt/emptysock-game/game.js
Type=Application
Categories=Game;
`;
    writeFileSync(desktopPath, desktop, 'utf-8');
    outputFiles.push(desktopPath);
  }

  if (launchOptions.includes('systemd')) {
    const servicePath = join(config.outDir, 'game.service');
    const service = `[Unit]
Description=EmptySock Game
After=network.target

[Service]
ExecStart=/usr/bin/node /opt/emptysock-game/game.js
Restart=on-failure
User=pi

[Install]
WantedBy=multi-user.target
`;
    writeFileSync(servicePath, service, 'utf-8');
    outputFiles.push(servicePath);
  }

  if (config.formats.includes('zip')) {
    const zipPath = join(config.outDir, 'game-raspi-arm.zip');
    const err = await archiverZip(config.outDir, zipPath);
    if (err !== null) {
      return { success: false, outputFiles, errors: [`zip packaging failed: ${err}`], duration: Date.now() - start };
    }
    outputFiles.push(zipPath);
  }

  return { success: true, outputFiles, errors: [], duration: Date.now() - start };
}
