import { z } from "zod";

// ─── Project Manifest ─────────────────────────────────────────────────────────

export const ProjectManifestSchema = z.object({
  name: z.string().min(1).max(128),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "Must be semver"),
  engineVersion: z.string(),
  entryPoint: z.string().default("src/main.ts"),
  targetResolution: z
    .object({
      width: z.number().int().positive(),
      height: z.number().int().positive(),
    })
    .default({ width: 1280, height: 720 }),
  physics: z
    .object({
      gravity: z
        .object({ x: z.number(), y: z.number() })
        .default({ x: 0, y: -9.81 }),
      enabled: z.boolean().default(true),
    })
    .default({}),
  audio: z
    .object({
      masterVolume: z.number().min(0).max(1).default(1),
    })
    .default({}),
  metadata: z
    .object({
      author: z.string().optional(),
      description: z.string().optional(),
      icon: z.string().optional(),
      tags: z.array(z.string()).default([]),
    })
    .default({}),
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

export * from "./scene.js";

// ─── Asset Manifest ───────────────────────────────────────────────────────────

export const AssetTypeSchema = z.enum([
  "image",
  "audio",
  "font",
  "json",
  "spritesheet",
  "tilemap",
  "shader",
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

// ─── Asset index (typed lookup facts, not the loader manifest above) ─────────

export const AssetKindSchema = z.enum([
  "sprite",
  "font",
  "sound",
  "object",
  "room",
  "shader",
  "tileset",
  "sequence",
  "note",
]);
export type AssetKind = z.infer<typeof AssetKindSchema>;

export const AssetIndexEntrySchema = z.object({
  kind: AssetKindSchema,
  /** Resource name, unique per kind. */
  name: z.string(),
  /** Runtime reference string as transpiled (sprite: texture path; others: name). */
  id: z.string(),
  width: z.number().int().nonnegative().optional(),
  height: z.number().int().nonnegative().optional(),
  frameCount: z.number().int().positive().optional(),
  originX: z.number().optional(),
  originY: z.number().optional(),
  /** Font point size. */
  size: z.number().optional(),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  /** Primary file, relative to the output dir. */
  path: z.string().optional(),
});
export type AssetIndexEntry = z.infer<typeof AssetIndexEntrySchema>;

export const AssetIndexSchema = z.object({
  version: z.literal(1),
  entries: z.array(AssetIndexEntrySchema),
  collisions: z
    .array(z.object({ name: z.string(), kinds: z.array(AssetKindSchema) }))
    .default([]),
});
export type AssetIndex = z.infer<typeof AssetIndexSchema>;

// ─── GPU Tier ─────────────────────────────────────────────────────────────────

export const GPUTierSchema = z.enum(["potato", "low", "mid", "high", "ultra"]);
export type GPUTier = z.infer<typeof GPUTierSchema>;

// ─── Engine Config ────────────────────────────────────────────────────────────

export const EngineConfigSchema = z.object({
  width: z.number().int().positive().default(1280),
  height: z.number().int().positive().default(720),
  backgroundColor: z.number().default(0x1a1a2e),
  antialias: z.boolean().default(true),
  resolution: z.number().positive().default(1),
  powerPreference: z
    .enum(["default", "high-performance", "low-power"])
    .default("high-performance"),
  physics: z
    .object({
      gravity: z
        .object({ x: z.number(), y: z.number() })
        .default({ x: 0, y: -200 }),
      timestep: z
        .number()
        .positive()
        .default(1 / 60),
    })
    .default({}),
});

export type EngineConfig = z.infer<typeof EngineConfigSchema>;

// ─── ImageLoader ──────────────────────────────────────────────────────────────

export interface ImageLoader {
  load(src: string): Promise<string | ImageBitmap>;
}

// ─── IUIRenderer ─────────────────────────────────────────────────────────────

/**
 * Minimal drawing-context interface accepted by UISystem.render().
 *
 * Uses only primitives — no DOM types. CanvasRenderingContext2D structurally
 * satisfies this interface, so existing callers that pass a canvas context
 * require no changes.
 */
export interface IUIRenderer {
  /** Colour or style used by fill operations. Accepts any string colour value. */
  fillStyle: string | object;
  /** Colour or style used by stroke operations. Accepts any string colour value. */
  strokeStyle: string | object;
  lineWidth: number;
  font: string;
  textAlign: string;
  textBaseline: string;
  globalAlpha: number;

  save(): void;
  restore(): void;
  beginPath(): void;
  closePath(): void;
  fill(): void;
  stroke(): void;
  rect(x: number, y: number, w: number, h: number): void;
  /** Optional — present in modern canvas implementations. */
  roundRect?(
    x: number,
    y: number,
    w: number,
    h: number,
    r: number | number[],
  ): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  arcTo(x1: number, y1: number, x2: number, y2: number, r: number): void;
  arc(
    x: number,
    y: number,
    r: number,
    startAngle: number,
    endAngle: number,
  ): void;
  fillText(text: string, x: number, y: number): void;
  /** Draw a pre-loaded image into the context at the given position and size. */
  drawImage(
    image: object,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
  ): void;
  /**
   * Optional 9-argument (source-region) form of `drawImage`, used by
   * `UISystem` to blit bitmap-font glyphs from an atlas. Canvas2D satisfies
   * it structurally. Renderers without it get the CSS-font text path.
   */
  drawImageRegion?(
    image: object,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
  ): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  strokeRect(x: number, y: number, w: number, h: number): void;
  /** Restrict subsequent drawing to the current path, until the next restore(). */
  clip(): void;
}

// ─── HostAdapter ──────────────────────────────────────────────────────────────

/**
 * Minimal event envelope delivered to HostAdapter message listeners.
 * Mirrors the fields of DOM MessageEvent that the engine actually uses,
 * without importing any DOM type.
 */
export interface HostMessage {
  readonly data: unknown;
  readonly origin: string;
}

export type HostMessageHandler = (event: HostMessage) => void;

/**
 * Abstraction layer between the engine and its host environment (browser
 * iframe, Tauri WebView, or Node test harness). Inject a concrete
 * implementation via IDEBridgeService constructor / Engine.init(); use
 * NullHostAdapter in contexts where no host integration is needed.
 */
export interface HostAdapter {
  /** Post a structured message to the parent / host frame. */
  postMessage(data: unknown, targetOrigin: string): void;
  /** Register a listener for messages arriving from the host. */
  addMessageListener(handler: HostMessageHandler): void;
  /** Deregister a previously registered message listener. */
  removeMessageListener(handler: HostMessageHandler): void;
  /** Schedule a recurring callback. Returns an opaque handle. */
  setInterval(fn: () => void, ms: number): unknown;
  /** Cancel a handle returned by setInterval. */
  clearInterval(id: unknown): void;
  /**
   * Detect GPU capability tier. Returns the best tier the host can determine;
   * return 'mid' when information is unavailable.
   */
  detectGPUTier(): GPUTier;
}

/** No-op adapter for Node.js tests and contexts without a host frame. */
export class NullHostAdapter implements HostAdapter {
  postMessage(_data: unknown, _targetOrigin: string): void {}
  addMessageListener(_handler: HostMessageHandler): void {}
  removeMessageListener(_handler: HostMessageHandler): void {}
  setInterval(_fn: () => void, _ms: number): unknown {
    return null;
  }
  clearInterval(_id: unknown): void {}
  detectGPUTier(): GPUTier {
    return "mid";
  }
}
