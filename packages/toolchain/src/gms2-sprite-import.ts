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
}

interface YyFrame {
  /** Frame's own resource name — this is the UUID that names its PNG file. */
  name?: string;
  compositeImage?: { FrameId?: { name?: string } };
  images?: Array<{ FrameId?: { name?: string } }>;
  [key: string]: unknown;
}

interface YySprite {
  name?: string;
  width?: number;
  height?: number;
  frames?: YyFrame[];
  [key: string]: unknown;
}

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

  return {
    name,
    frames,
    frameCount: frames.length,
    width,
    height,
    imagePath: frames[0]?.imagePath ?? path.join(spriteYyDir, `${name}.png`),
  };
}
