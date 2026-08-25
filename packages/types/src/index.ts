import { z } from 'zod';

// ─── Project Manifest ─────────────────────────────────────────────────────────

export const ProjectManifestSchema = z.object({
  name: z.string().min(1).max(128),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Must be semver'),
  engineVersion: z.string(),
  entryPoint: z.string().default('src/main.ts'),
  targetResolution: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }).default({ width: 1280, height: 720 }),
  physics: z.object({
    gravity: z.object({ x: z.number(), y: z.number() }).default({ x: 0, y: -9.81 }),
    enabled: z.boolean().default(true),
  }).default({}),
  audio: z.object({
    masterVolume: z.number().min(0).max(1).default(1),
  }).default({}),
  metadata: z.object({
    author: z.string().optional(),
    description: z.string().optional(),
    icon: z.string().optional(),
    tags: z.array(z.string()).default([]),
  }).default({}),
});

export type ProjectManifest = z.infer<typeof ProjectManifestSchema>;

// ─── Save Slot ────────────────────────────────────────────────────────────────

export const SaveSlotSchema = z.object({
  slotId: z.number().int().min(0).max(9),
  timestamp: z.number(),
  playtime: z.number().nonnegative(),
  currentScene: z.string(),
  data: z.record(z.string(), z.unknown()),
});

export type SaveSlot = z.infer<typeof SaveSlotSchema>;

// ─── Scene ────────────────────────────────────────────────────────────────────

export const ComponentDataSchema = z.object({
  type: z.string(),
  data: z.record(z.string(), z.unknown()),
});

export const EntitySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  tags: z.array(z.string()).default([]),
  active: z.boolean().default(true),
  components: z.array(ComponentDataSchema).default([]),
  children: z.array(z.lazy((): z.ZodTypeAny => EntitySchema)).default([]),
});

export type EntityData = z.infer<typeof EntitySchema>;

export const SceneSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  version: z.number().int().positive().default(1),
  backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#1a1a2e'),
  entities: z.array(EntitySchema).default([]),
  metadata: z.object({
    author: z.string().optional(),
    createdAt: z.number().optional(),
    updatedAt: z.number().optional(),
  }).default({}),
});

export type Scene = z.infer<typeof SceneSchema>;

// ─── Asset Manifest ───────────────────────────────────────────────────────────

export const AssetTypeSchema = z.enum([
  'image',
  'audio',
  'font',
  'json',
  'spritesheet',
  'tilemap',
  'shader',
]);

export type AssetType = z.infer<typeof AssetTypeSchema>;

export const AssetEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  type: AssetTypeSchema,
  path: z.string(),
  size: z.number().nonnegative().optional(),
  checksum: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type AssetEntry = z.infer<typeof AssetEntrySchema>;

export const AssetManifestSchema = z.object({
  version: z.number().int().positive().default(1),
  assets: z.array(AssetEntrySchema).default([]),
});

export type AssetManifest = z.infer<typeof AssetManifestSchema>;

// ─── GPU Tier ─────────────────────────────────────────────────────────────────

export const GPUTierSchema = z.enum(['potato', 'low', 'mid', 'high', 'ultra']);
export type GPUTier = z.infer<typeof GPUTierSchema>;

// ─── Engine Config ────────────────────────────────────────────────────────────

export const EngineConfigSchema = z.object({
  width: z.number().int().positive().default(1280),
  height: z.number().int().positive().default(720),
  backgroundColor: z.number().default(0x1a1a2e),
  antialias: z.boolean().default(true),
  resolution: z.number().positive().default(1),
  powerPreference: z.enum(['default', 'high-performance', 'low-power']).default('high-performance'),
  physics: z.object({
    gravity: z.object({ x: z.number(), y: z.number() }).default({ x: 0, y: -200 }),
    timestep: z.number().positive().default(1 / 60),
  }).default({}),
});

export type EngineConfig = z.infer<typeof EngineConfigSchema>;
