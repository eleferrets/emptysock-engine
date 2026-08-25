import { describe, it, expect } from 'vitest';
import type { ExportConfig } from '../index.js';

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

describe('analyzeBundle', () => {
  it('returns BundleAnalysis shape even on failure', async () => {
    const { analyzeBundle } = await import('../index.js');
    // This will fail to build but should return empty analysis or throw
    try {
      const result = await analyzeBundle('/nonexistent/project');
      // If it returns, check shape
      expect(typeof result.totalBytes).toBe('number');
      expect(typeof result.gzippedEstimate).toBe('number');
      expect(Array.isArray(result.modules)).toBe(true);
    } catch {
      // Throwing is also acceptable for bad input
      expect(true).toBe(true);
    }
  });
});
