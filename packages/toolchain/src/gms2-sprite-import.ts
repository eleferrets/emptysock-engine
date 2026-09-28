import { promises as fs } from "node:fs";
import path from "node:path";

export interface SpriteFrame {
  /** Absolute path to this frame's source PNG on disk. */
  imagePath: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SpriteAsset {
  name: string;
  frames: SpriteFrame[];
  frameCount: number;
  width: number;
  height: number;
  /**
   * @deprecated kept for backward compatibility with callers that expect a
   * single image path. GMS2 stores one PNG per frame (named by frame UUID),
   * not one PNG per sprite, so this is simply the first frame's image.
   */
  imagePath: string;
  /**
   * This sprite's own authored playback rate, translated into
   * `@emptysock/engine`'s `Sprite.frameSpeed` unit (frames advanced per
   * engine tick — `SpriteAnimationSystem`'s own per-step convention,
   * matching real GameMaker `image_speed`). `undefined` when the `.yy` had
   * no real `sequence.playbackSpeed` to read (an old GMS2 sprite resource
   * predating the Sequences-based sprite editor) — the caller falls back to
   * `Sprite.frameSpeed`'s own default (`1`) rather than a fabricated value.
   *
   * A real GMS2 `.yy` sprite's `sequence.playbackSpeed` is paired with
   * `playbackSpeedType`: `0` means the number is already **frames per
   * second** (GameMaker's own default, confirmed against a real Freedom
   * Backup sprite: `playbackSpeed: 15.0, playbackSpeedType: 0`), `1` means
   * **frames per game-step** — the exact same per-tick unit
   * `Sprite.frameSpeed` already uses, needing no conversion. Converting FPS
   * to frames-per-step needs a step rate to divide by; this importer has no
   * per-project step rate to read (GameMaker's room-level "Speed" setting
   * isn't sprite data), so it honestly assumes the common default of 60
   * steps/second — real, documented, not silently precise for a project
   * that actually runs its rooms at a different speed.
   */
  frameSpeed?: number;
  /**
   * Real GMS2 `nineSlice` metadata, present only when the `.yy`'s
   * `nineSlice` block exists AND `enabled` is `true`. Freedom Backup has
   * exactly one such block (`spr_back`) and it is `enabled: false` with all
   * guides `0`, so this stays `undefined` for it — an honest "not authored".
   */
  nineSlice?: { left: number; right: number; top: number; bottom: number };
}

interface YyFrame {
  /** Frame's own resource name — this is the UUID that names its PNG file. */
  name?: string;
  compositeImage?: { FrameId?: { name?: string } };
  images?: Array<{ FrameId?: { name?: string } }>;
  [key: string]: unknown;
}

interface YySequence {
  playbackSpeed?: number;
  playbackSpeedType?: number;
  [key: string]: unknown;
}

interface YySprite {
  name?: string;
  width?: number;
  height?: number;
  frames?: YyFrame[];
  sequence?: YySequence | null;
  nineSlice?: {
    enabled?: boolean;
    left?: number;
    right?: number;
    top?: number;
    bottom?: number;
  } | null;
  [key: string]: unknown;
}

/** Default assumed step rate (steps/second) used only to convert a real GMS2 `playbackSpeedType: 0` (frames-per-second) value into `Sprite.frameSpeed`'s frames-per-step unit — see `SpriteAsset.frameSpeed`'s own doc comment for why this is an honest assumption, not a read field. */
const ASSUMED_STEPS_PER_SECOND = 60;

function isYySprite(val: unknown): val is YySprite {
  return typeof val === "object" && val !== null;
}

/**
 * Convert a GMS2 sprite directory (containing a .yy file) into a SpriteAsset.
 * Throws a descriptive Error if the directory or .yy file cannot be read, or if
 * the JSON is invalid or missing required fields.
 */
export async function convertGms2Sprite(
  spriteYyDir: string,
): Promise<SpriteAsset> {
  let entries: string[];
  try {
    entries = await fs.readdir(spriteYyDir);
  } catch (err) {
    throw new Error(
      `convertGms2Sprite: cannot read directory "${spriteYyDir}": ${String(err)}`,
    );
  }

  const yyFile = entries.find((e) => e.endsWith(".yy"));
  if (yyFile === undefined) {
    throw new Error(`convertGms2Sprite: no .yy file found in "${spriteYyDir}"`);
  }

  const yyPath = path.join(spriteYyDir, yyFile);
  let raw: string;
  try {
    raw = await fs.readFile(yyPath, "utf-8");
  } catch (err) {
    throw new Error(
      `convertGms2Sprite: cannot read "${yyPath}": ${String(err)}`,
    );
  }

  let parsed: unknown;
  try {
    // Real GMS2 .yy files use trailing commas, which JSON.parse rejects.
    parsed = JSON.parse(raw.replace(/,(\s*[}\]])/g, "$1"));
  } catch (err) {
    throw new Error(
      `convertGms2Sprite: invalid JSON in "${yyPath}": ${String(err)}`,
    );
  }

  if (!isYySprite(parsed)) {
    throw new Error(
      `convertGms2Sprite: unexpected .yy structure in "${yyPath}"`,
    );
  }

  const name =
    typeof parsed.name === "string" ? parsed.name : path.basename(spriteYyDir);
  const width = typeof parsed.width === "number" ? parsed.width : 0;
  const height = typeof parsed.height === "number" ? parsed.height : 0;

  const rawFrames = Array.isArray(parsed.frames) ? parsed.frames : [];

  // Real GMS2 sprites store one PNG per frame at the sprite directory root,
  // named by the frame's own resource name (a UUID) — never "<sprite>.png".
  // Each frame is laid out as its own full-size image, not a shared sheet.
  const frames: SpriteFrame[] = rawFrames.map((f) => {
    const frameName = typeof f.name === "string" ? f.name : name;
    return {
      imagePath: path.join(spriteYyDir, `${frameName}.png`),
      x: 0,
      y: 0,
      w: width,
      h: height,
    };
  });

  // Verify at least the first frame's file actually exists, so a mismatch
  // between the .yy frame list and the PNGs on disk surfaces immediately
  // instead of producing a silently-dangling reference downstream.
  const firstFrame = frames[0];
  if (firstFrame !== undefined) {
    try {
      await fs.access(firstFrame.imagePath);
    } catch {
      throw new Error(
        `convertGms2Sprite: frame image "${firstFrame.imagePath}" referenced by "${yyPath}" does not exist on disk`,
      );
    }
  }

  const sequence = parsed.sequence;
  let frameSpeed: number | undefined;
  if (
    sequence !== null &&
    sequence !== undefined &&
    typeof sequence.playbackSpeed === "number"
  ) {
    frameSpeed =
      sequence.playbackSpeedType === 1
        ? sequence.playbackSpeed
        : sequence.playbackSpeed / ASSUMED_STEPS_PER_SECOND;
  }

  const ns = parsed.nineSlice;
  const nineSlice =
    ns !== null && ns !== undefined && ns.enabled === true
      ? {
          left: typeof ns.left === "number" ? ns.left : 0,
          right: typeof ns.right === "number" ? ns.right : 0,
          top: typeof ns.top === "number" ? ns.top : 0,
          bottom: typeof ns.bottom === "number" ? ns.bottom : 0,
        }
      : undefined;

  return {
    name,
    frames,
    frameCount: frames.length,
    width,
    height,
    imagePath: frames[0]?.imagePath ?? path.join(spriteYyDir, `${name}.png`),
    ...(frameSpeed !== undefined ? { frameSpeed } : {}),
    ...(nineSlice !== undefined ? { nineSlice } : {}),
  };
}
