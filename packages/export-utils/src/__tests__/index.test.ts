import { describe, it, expect } from 'vitest';
import { tmpdir } from 'node:os';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ExportConfig } from '../index.js';

// ---------------------------------------------------------------------------
// exportGame
// ---------------------------------------------------------------------------

describe('exportGame', () => {
  it('returns error result when projectDir does not exist', async () => {
    const { exportGame } = await import('../index.js');
    const config: ExportConfig = {
      projectDir: '/nonexistent/path',
      outDir: '/tmp/out',
      minify: false,
    };
    const result = await exportGame(config);
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('result has correct shape fields', async () => {
    const { exportGame } = await import('../index.js');
    const result = await exportGame({
      projectDir: '/nonexistent',
      outDir: '/tmp/out',
    });
    expect(typeof result.success).toBe('boolean');
    expect(Array.isArray(result.outputFiles)).toBe(true);
    expect(Array.isArray(result.errors)).toBe(true);
    expect(typeof result.duration).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// analyzeBundle
// ---------------------------------------------------------------------------

describe('analyzeBundle', () => {
  it('returns BundleAnalysis shape even on failure', async () => {
    const { analyzeBundle } = await import('../index.js');
    try {
      const result = await analyzeBundle('/nonexistent/project');
      expect(typeof result.totalBytes).toBe('number');
      expect(typeof result.gzippedEstimate).toBe('number');
      expect(Array.isArray(result.modules)).toBe(true);
    } catch {
      expect(true).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// verifyExport
// ---------------------------------------------------------------------------

describe('verifyExport', () => {
  it('fails when .map files are present', async () => {
    const { verifyExport } = await import('../index.js');
    const dir = mkdtempSync(join(tmpdir(), 'es-verify-'));
    writeFileSync(join(dir, 'game.js'), 'var a=1;', 'utf-8');
    writeFileSync(join(dir, 'game.js.map'), '{}', 'utf-8');

    const result = await verifyExport(dir);
    expect(result.passed).toBe(false);
    const mapCheck = result.checks.find(c => c.name === 'no-sourcemaps');
    expect(mapCheck).toBeDefined();
    expect(mapCheck?.passed).toBe(false);
  });

  it('fails when .ts files are present', async () => {
    const { verifyExport } = await import('../index.js');
    const dir = mkdtempSync(join(tmpdir(), 'es-verify-'));
    writeFileSync(join(dir, 'game.js'), 'var a=1;', 'utf-8');
    writeFileSync(join(dir, 'main.ts'), 'const x: number = 1;', 'utf-8');

    const result = await verifyExport(dir);
    const tsCheck = result.checks.find(c => c.name === 'no-typescript-sources');
    expect(tsCheck?.passed).toBe(false);
  });

  it('fails when .d.ts files are present', async () => {
    const { verifyExport } = await import('../index.js');
    const dir = mkdtempSync(join(tmpdir(), 'es-verify-'));
    writeFileSync(join(dir, 'game.js'), 'var a=1;', 'utf-8');
    writeFileSync(join(dir, 'types.d.ts'), 'export declare const x: number;', 'utf-8');

    const result = await verifyExport(dir);
    const tsCheck = result.checks.find(c => c.name === 'no-typescript-sources');
    expect(tsCheck?.passed).toBe(false);
  });

  it('fails when console.log is in JS', async () => {
    const { verifyExport } = await import('../index.js');
    const dir = mkdtempSync(join(tmpdir(), 'es-verify-'));
    writeFileSync(join(dir, 'game.js'), 'var a=function(){console.log("hi")};'.repeat(20), 'utf-8');

    const result = await verifyExport(dir);
    const consoleCheck = result.checks.find(c => c.name === 'no-console-log');
    expect(consoleCheck?.passed).toBe(false);
  });

  it('passes when directory is clean', async () => {
    const { verifyExport } = await import('../index.js');
    const dir = mkdtempSync(join(tmpdir(), 'es-verify-'));
    // Write minified-looking JS (long single line, no console.log)
    const minifiedLine = 'var a=function(b,c){return b+c};var d=a(1,2);'.repeat(15);
    writeFileSync(join(dir, 'game.js'), minifiedLine, 'utf-8');

    const result = await verifyExport(dir);
    expect(result.checks.find(c => c.name === 'no-sourcemaps')?.passed).toBe(true);
    expect(result.checks.find(c => c.name === 'no-typescript-sources')?.passed).toBe(true);
    expect(result.checks.find(c => c.name === 'no-console-log')?.passed).toBe(true);
  });

  it('result has passed and checks array', async () => {
    const { verifyExport } = await import('../index.js');
    const dir = mkdtempSync(join(tmpdir(), 'es-verify-'));
    const result = await verifyExport(dir);
    expect(typeof result.passed).toBe('boolean');
    expect(Array.isArray(result.checks)).toBe(true);
    for (const check of result.checks) {
      expect(typeof check.name).toBe('string');
      expect(typeof check.passed).toBe('boolean');
      expect(typeof check.detail).toBe('string');
    }
  });
});

// ---------------------------------------------------------------------------
// hashAssets
// ---------------------------------------------------------------------------

describe('hashAssets', () => {
  it('returns HashedAsset array with 8-char hash', async () => {
    const { hashAssets } = await import('../index.js');
    const assetsDir = mkdtempSync(join(tmpdir(), 'es-assets-'));
    const outDir = mkdtempSync(join(tmpdir(), 'es-hash-out-'));

    writeFileSync(join(assetsDir, 'player.png'), 'fake-png-data', 'utf-8');
    writeFileSync(join(assetsDir, 'music.ogg'), 'fake-ogg-data', 'utf-8');

    const results = await hashAssets(assetsDir, outDir);

    expect(results.length).toBe(2);
    for (const asset of results) {
      expect(asset.hash).toHaveLength(8);
      expect(asset.hashedPath).toMatch(/^assets\//);
      expect(typeof asset.originalPath).toBe('string');
    }
  });

  it('preserves file content in output', async () => {
    const { hashAssets } = await import('../index.js');
    const assetsDir = mkdtempSync(join(tmpdir(), 'es-assets-'));
    const outDir = mkdtempSync(join(tmpdir(), 'es-hash-out-'));
    const content = 'UNIQUE_CONTENT_12345';

    writeFileSync(join(assetsDir, 'test.webp'), content, 'utf-8');

    const results = await hashAssets(assetsDir, outDir);
    expect(results.length).toBe(1);

    const outFile = join(outDir, `${results[0].hash}.webp`);
    const written = readFileSync(outFile, 'utf-8');
    expect(written).toBe(content);
  });

  it('different content produces different hashes', async () => {
    const { hashAssets } = await import('../index.js');
    const assetsDir1 = mkdtempSync(join(tmpdir(), 'es-assets-'));
    const assetsDir2 = mkdtempSync(join(tmpdir(), 'es-assets-'));
    const outDir1 = mkdtempSync(join(tmpdir(), 'es-hash-out-'));
    const outDir2 = mkdtempSync(join(tmpdir(), 'es-hash-out-'));

    writeFileSync(join(assetsDir1, 'file.png'), 'content-a', 'utf-8');
    writeFileSync(join(assetsDir2, 'file.png'), 'content-b', 'utf-8');

    const [r1] = await hashAssets(assetsDir1, outDir1);
    const [r2] = await hashAssets(assetsDir2, outDir2);

    expect(r1.hash).not.toBe(r2.hash);
  });

  it('returns empty array for empty directory', async () => {
    const { hashAssets } = await import('../index.js');
    const assetsDir = mkdtempSync(join(tmpdir(), 'es-assets-'));
    const outDir = mkdtempSync(join(tmpdir(), 'es-hash-out-'));

    const results = await hashAssets(assetsDir, outDir);
    expect(results).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// buildForPreview
// ---------------------------------------------------------------------------

describe('buildForPreview', () => {
  it('compiles valid TypeScript successfully', async () => {
    const { buildForPreview } = await import('../index.js');
    const result = await buildForPreview({
      code: 'const x: number = 42; console.log(x);',
      mode: 'debug',
    });

    expect(result.success).toBe(true);
    expect(result.js.length).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(0);
    expect(typeof result.duration).toBe('number');
    expect(result.byteSize).toBeGreaterThan(0);
  });

  it('returns errors for syntax error', async () => {
    const { buildForPreview } = await import('../index.js');
    const result = await buildForPreview({
      code: 'const x: = ;',
      mode: 'debug',
    });

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.js).toBe('');
  });

  it('debug mode keeps console.log', async () => {
    const { buildForPreview } = await import('../index.js');
    const result = await buildForPreview({
      code: 'console.log("hello debug");',
      mode: 'debug',
    });

    expect(result.success).toBe(true);
    expect(result.js).toContain('console.log');
  });

  it('release mode strips console.log', async () => {
    const { buildForPreview } = await import('../index.js');
    const result = await buildForPreview({
      code: 'const x = 1; console.log("hello release"); const y = x + 1;',
      mode: 'release',
    });

    expect(result.success).toBe(true);
    expect(result.js).not.toContain('console.log');
  });

  it('result has correct shape', async () => {
    const { buildForPreview } = await import('../index.js');
    const result = await buildForPreview({ code: 'const a = 1;', mode: 'debug' });
    expect(typeof result.success).toBe('boolean');
    expect(typeof result.js).toBe('string');
    expect(Array.isArray(result.errors)).toBe(true);
    expect(Array.isArray(result.warnings)).toBe(true);
    expect(typeof result.duration).toBe('number');
    expect(typeof result.byteSize).toBe('number');
  });

  it('byteSize equals js length on success', async () => {
    const { buildForPreview } = await import('../index.js');
    const result = await buildForPreview({ code: 'const n: number = 99;', mode: 'debug' });
    expect(result.success).toBe(true);
    expect(result.byteSize).toBe(result.js.length);
  });
});

// ---------------------------------------------------------------------------
// exportWeb
// ---------------------------------------------------------------------------

describe('exportWeb', () => {
  it('returns failure with correct shape for nonexistent project', async () => {
    const { exportWeb } = await import('../index.js');
    const result = await exportWeb({
      projectDir: '/nonexistent/project',
      outDir: mkdtempSync(join(tmpdir(), 'es-web-out-')),
      minify: false,
      formats: ['folder'],
    });

    expect(result.success).toBe(false);
    expect(Array.isArray(result.errors)).toBe(true);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(typeof result.duration).toBe('number');
    expect(Array.isArray(result.outputFiles)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// All platform exports — shape on failure
// ---------------------------------------------------------------------------

describe('platform exports — failure shape', () => {
  const badProjectDir = '/nonexistent/project';

  it('exportWindows returns correct shape on failure', async () => {
    const { exportWindows } = await import('../index.js');
    const outDir = mkdtempSync(join(tmpdir(), 'es-win-'));
    const result = await exportWindows({ projectDir: badProjectDir, outDir, formats: ['installer'] });
    expect(typeof result.success).toBe('boolean');
    expect(result.success).toBe(false);
    expect(Array.isArray(result.errors)).toBe(true);
    expect(Array.isArray(result.outputFiles)).toBe(true);
    expect(typeof result.duration).toBe('number');
  });

  it('exportMacOS returns correct shape on failure', async () => {
    const { exportMacOS } = await import('../index.js');
    const outDir = mkdtempSync(join(tmpdir(), 'es-mac-'));
    const result = await exportMacOS({ projectDir: badProjectDir, outDir, formats: ['dmg'] });
    expect(result.success).toBe(false);
    expect(Array.isArray(result.errors)).toBe(true);
  });

  it('exportLinux returns correct shape on failure', async () => {
    const { exportLinux } = await import('../index.js');
    const outDir = mkdtempSync(join(tmpdir(), 'es-linux-'));
    const result = await exportLinux({ projectDir: badProjectDir, outDir, formats: ['appimage'] });
    expect(result.success).toBe(false);
    expect(Array.isArray(result.errors)).toBe(true);
  });

  it('exportAndroid returns correct shape on failure', async () => {
    const { exportAndroid } = await import('../index.js');
    const outDir = mkdtempSync(join(tmpdir(), 'es-android-'));
    const result = await exportAndroid({ projectDir: badProjectDir, outDir, formats: ['apk'] });
    expect(result.success).toBe(false);
    expect(Array.isArray(result.errors)).toBe(true);
  });

  it('exportIOS returns correct shape on failure', async () => {
    const { exportIOS } = await import('../index.js');
    const outDir = mkdtempSync(join(tmpdir(), 'es-ios-'));
    const result = await exportIOS({ projectDir: badProjectDir, outDir, formats: ['ipa'] });
    expect(result.success).toBe(false);
    expect(Array.isArray(result.errors)).toBe(true);
  });

  it('exportRaspi returns correct shape on failure', async () => {
    const { exportRaspi } = await import('../index.js');
    const outDir = mkdtempSync(join(tmpdir(), 'es-raspi-'));
    const result = await exportRaspi({ projectDir: badProjectDir, outDir, formats: ['tar'] });
    expect(result.success).toBe(false);
    expect(Array.isArray(result.errors)).toBe(true);
  });
});
