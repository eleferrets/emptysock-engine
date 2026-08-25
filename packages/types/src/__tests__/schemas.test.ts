import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  ProjectManifestSchema,
  SaveSlotSchema,
  GPUTierSchema,
  EngineConfigSchema,
  AssetEntrySchema,
  SceneSchema,
} from '../index.js';

describe('ProjectManifestSchema', () => {
  const base = {
    name: 'MyGame',
    version: '1.0.0',
    engineVersion: '0.1.0',
  };

  it('parses valid data with defaults', () => {
    const result = ProjectManifestSchema.parse(base);
    expect(result.name).toBe('MyGame');
    expect(result.entryPoint).toBe('src/main.ts');
    expect(result.targetResolution).toEqual({ width: 1280, height: 720 });
  });

  it('throws ZodError on missing name', () => {
    expect(() =>
      ProjectManifestSchema.parse({ version: '1.0.0', engineVersion: '0.1.0' })
    ).toThrow(z.ZodError);
  });

  it('throws ZodError on invalid version format', () => {
    expect(() =>
      ProjectManifestSchema.parse({ ...base, version: 'not-semver' })
    ).toThrow(z.ZodError);
  });

  it('strips extra fields (strict passthrough)', () => {
    const result = ProjectManifestSchema.parse({ ...base, unknownField: 'ignored' });
    expect((result as Record<string, unknown>)['unknownField']).toBeUndefined();
  });

  it('accepts custom resolution', () => {
    const result = ProjectManifestSchema.parse({
      ...base,
      targetResolution: { width: 1920, height: 1080 },
    });
    expect(result.targetResolution.width).toBe(1920);
  });
});

describe('SaveSlotSchema', () => {
  const valid = {
    slotId: 0,
    timestamp: Date.now(),
    playtime: 120,
    currentScene: 'GameScene',
    data: { hp: 100 },
  };

  it('parses valid save slot', () => {
    const result = SaveSlotSchema.parse(valid);
    expect(result.slotId).toBe(0);
    expect(result.currentScene).toBe('GameScene');
  });

  it('throws on slotId out of range', () => {
    expect(() => SaveSlotSchema.parse({ ...valid, slotId: 10 })).toThrow(z.ZodError);
  });

  it('throws on negative playtime', () => {
    expect(() => SaveSlotSchema.parse({ ...valid, playtime: -1 })).toThrow(z.ZodError);
  });

  it('throws on missing currentScene', () => {
    const { currentScene: _, ...rest } = valid;
    expect(() => SaveSlotSchema.parse(rest)).toThrow(z.ZodError);
  });
});

describe('GPUTierSchema', () => {
  it('accepts valid tiers', () => {
    for (const tier of ['potato', 'low', 'mid', 'high', 'ultra'] as const) {
      expect(GPUTierSchema.parse(tier)).toBe(tier);
    }
  });

  it('rejects invalid tier', () => {
    expect(() => GPUTierSchema.parse('extreme')).toThrow(z.ZodError);
  });

  it('rejects number', () => {
    expect(() => GPUTierSchema.parse(3)).toThrow(z.ZodError);
  });
});

describe('EngineConfigSchema', () => {
  it('parses empty object with defaults', () => {
    const result = EngineConfigSchema.parse({});
    expect(result.width).toBe(1280);
    expect(result.height).toBe(720);
    expect(result.antialias).toBe(true);
  });

  it('throws on negative width', () => {
    expect(() => EngineConfigSchema.parse({ width: -1 })).toThrow(z.ZodError);
  });

  it('accepts partial config', () => {
    const result = EngineConfigSchema.parse({ width: 800, height: 600 });
    expect(result.width).toBe(800);
    expect(result.resolution).toBe(1);
  });
});

describe('AssetEntrySchema', () => {
  const valid = {
    id: 'ast-1',
    name: 'player.png',
    type: 'image' as const,
    path: 'assets/player.png',
  };

  it('parses valid entry', () => {
    const result = AssetEntrySchema.parse(valid);
    expect(result.id).toBe('ast-1');
  });

  it('throws on invalid type', () => {
    expect(() => AssetEntrySchema.parse({ ...valid, type: 'video' })).toThrow(z.ZodError);
  });

  it('accepts optional size and checksum', () => {
    const result = AssetEntrySchema.parse({ ...valid, size: 1024, checksum: 'abc' });
    expect(result.size).toBe(1024);
  });
});

describe('SceneSchema', () => {
  const valid = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'GameScene',
  };

  it('parses valid scene with defaults', () => {
    const result = SceneSchema.parse(valid);
    expect(result.name).toBe('GameScene');
    expect(result.version).toBe(1);
    expect(result.entities).toEqual([]);
  });

  it('throws on missing id', () => {
    expect(() => SceneSchema.parse({ name: 'X' })).toThrow(z.ZodError);
  });

  it('throws on invalid backgroundColor', () => {
    expect(() => SceneSchema.parse({ ...valid, backgroundColor: 'red' })).toThrow(z.ZodError);
  });
});
