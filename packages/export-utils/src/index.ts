import { build, transform, type BuildOptions } from 'esbuild';
import {
  readFileSync,
  readdirSync,
  writeFileSync,
  mkdirSync,
  statSync,
} from 'node:fs';
import { join, extname, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { ProjectManifestSchema } from '../../types/dist/index.js';

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
    // Would invoke: zip -r game.zip outDir (Tauri backend call in production)
    console.info('[exportWeb] Would create game.zip via Tauri backend');
  }

  return { success: true, outputFiles, errors: [], duration: Date.now() - start };
}

// Windows export

export async function exportWindows(
  config: ExportConfig & { formats: Array<'installer' | 'zip'> }
): Promise<ExportResult> {
  const start = Date.now();
  const core = await runCoreExport(config);
  if (!core.success) return core;

  const verify = await runVerify(config.outDir);
  if (!verify.passed) {
    return { success: false, outputFiles: core.outputFiles, errors: verify.errors, duration: Date.now() - start };
  }

  const manifestPath = join(config.outDir, 'windows-manifest.json');
  writeFileSync(manifestPath, JSON.stringify({ platform: 'windows', formats: config.formats }, null, 2), 'utf-8');

  if (config.formats.includes('installer')) {
    // Would invoke: NSIS makensis script via Tauri backend
    console.info('[exportWindows] Would run NSIS installer generation via Tauri backend');
  }
  if (config.formats.includes('zip')) {
    console.info('[exportWindows] Would create Windows zip via Tauri backend');
  }

  return { success: true, outputFiles: [...core.outputFiles, manifestPath], errors: [], duration: Date.now() - start };
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

  if (config.formats.includes('app')) {
    console.info('[exportMacOS] Would build .app bundle via Tauri backend');
  }
  if (config.formats.includes('dmg')) {
    // Would invoke: create-dmg via Tauri backend
    console.info('[exportMacOS] Would run create-dmg via Tauri backend');
  }

  return { success: true, outputFiles: [...core.outputFiles, manifestPath], errors: [], duration: Date.now() - start };
}

// Linux export

export async function exportLinux(
  config: ExportConfig & { formats: Array<'appimage' | 'deb'> }
): Promise<ExportResult> {
  const start = Date.now();
  const core = await runCoreExport(config);
  if (!core.success) return core;

  const verify = await runVerify(config.outDir);
  if (!verify.passed) {
    return { success: false, outputFiles: core.outputFiles, errors: verify.errors, duration: Date.now() - start };
  }

  const manifestPath = join(config.outDir, 'linux-manifest.json');
  writeFileSync(manifestPath, JSON.stringify({ platform: 'linux', formats: config.formats }, null, 2), 'utf-8');

  if (config.formats.includes('appimage')) {
    console.info('[exportLinux] Would build AppImage via Tauri backend');
  }
  if (config.formats.includes('deb')) {
    console.info('[exportLinux] Would build .deb package via Tauri backend');
  }

  return { success: true, outputFiles: [...core.outputFiles, manifestPath], errors: [], duration: Date.now() - start };
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

  if (config.formats.includes('apk')) {
    console.info('[exportAndroid] Would build APK via Tauri backend (Gradle)');
  }
  if (config.formats.includes('aab')) {
    console.info('[exportAndroid] Would build AAB via Tauri backend (Gradle bundleRelease)');
  }

  return { success: true, outputFiles: [...core.outputFiles, manifestPath], errors: [], duration: Date.now() - start };
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

  if (config.formats.includes('ipa')) {
    // Would invoke: xcodebuild archive + exportArchive via Tauri backend
    console.info('[exportIOS] Would build IPA via Tauri backend (xcodebuild)');
  }

  return { success: true, outputFiles: [...core.outputFiles, manifestPath], errors: [], duration: Date.now() - start };
}

// Raspberry Pi export

export async function exportRaspi(
  config: ExportConfig & {
    formats: Array<'tar'>;
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

  if (config.formats.includes('tar')) {
    // Would invoke: tar -czf game.tar.gz outDir via Tauri backend
    console.info('[exportRaspi] Would create .tar.gz via Tauri backend');
  }

  return { success: true, outputFiles, errors: [], duration: Date.now() - start };
}
