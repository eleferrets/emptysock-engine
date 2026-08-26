import { describe, it, expect } from 'vitest';
import { detectToolchain, formatToolchainReport } from '../ToolchainDetector.js';
import { ToolchainSettingsSchema } from '../ToolchainSettings.js';
import { imageExists } from '../VMRunner.js';

describe('ToolchainSettings', () => {
  it('parses empty object with defaults', () => {
    const s = ToolchainSettingsSchema.parse({});
    expect(s.dockerLinuxImage).toBe('node:22-bookworm-slim');
    expect(s.dockerAndroidImage).toContain('android');
  });

  it('accepts custom paths', () => {
    const s = ToolchainSettingsSchema.parse({
      xcodePath: '/Applications/Xcode.app',
      androidSdkPath: '/Users/dev/Android/sdk',
      nsisPath: 'C:\\NSIS\\makensis.exe',
    });
    expect(s.xcodePath).toBe('/Applications/Xcode.app');
    expect(s.androidSdkPath).toBe('/Users/dev/Android/sdk');
  });
});

describe('detectToolchain', () => {
  it('returns a ToolchainReport with tools and blocking arrays', () => {
    const settings = ToolchainSettingsSchema.parse({});
    const report = detectToolchain(settings, []);
    expect(typeof report.platform).toBe('string');
    expect(Array.isArray(report.tools)).toBe(true);
    expect(Array.isArray(report.blocking)).toBe(true);
    expect(typeof report.ready).toBe('boolean');
  });

  it('blocking contains only required+missing tools', () => {
    const settings = ToolchainSettingsSchema.parse({});
    const report = detectToolchain(settings, []);
    for (const t of report.blocking) {
      expect(t.required).toBe(true);
      expect(t.status).toBe('missing');
    }
  });

  it('node is always checked', () => {
    const settings = ToolchainSettingsSchema.parse({});
    const report = detectToolchain(settings, []);
    const node = report.tools.find(t => t.name === 'node');
    expect(node).toBeDefined();
  });

  it('includes android tools when android target requested', () => {
    const settings = ToolchainSettingsSchema.parse({});
    const report = detectToolchain(settings, ['android']);
    const sdk = report.tools.find(t => t.name === 'Android SDK');
    expect(sdk).toBeDefined();
  });

  it('includes macos tools when ios target requested on non-mac host', () => {
    const settings = ToolchainSettingsSchema.parse({});
    const report = detectToolchain(settings, ['ios']);
    const xcode = report.tools.find(t => t.name === 'Xcode');
    expect(xcode).toBeDefined();
  });
});

describe('formatToolchainReport', () => {
  it('returns a non-empty string', () => {
    const settings = ToolchainSettingsSchema.parse({});
    const report = detectToolchain(settings, []);
    const text = formatToolchainReport(report);
    expect(typeof text).toBe('string');
    expect(text.length).toBeGreaterThan(0);
    expect(text).toContain('Platform:');
  });

  it('contains BLOCKING when tools are missing', () => {
    // Force a missing-tool scenario by requesting ios on non-mac
    const settings = ToolchainSettingsSchema.parse({});
    const report = detectToolchain(settings, ['ios']);
    if (!report.ready) {
      const text = formatToolchainReport(report);
      expect(text).toContain('BLOCKING');
    }
  });
});

describe('VMRunner', () => {
  it('imageExists returns a boolean', () => {
    const result = imageExists('nonexistent-image:xyz');
    expect(typeof result).toBe('boolean');
    expect(result).toBe(false);
  });
});
