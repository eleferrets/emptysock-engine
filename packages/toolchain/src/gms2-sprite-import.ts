import { promises as fs } from "node:fs";
import path from "node:path";

export interface SpriteAsset {
  name: string;
  frames: Array<{ x: number; y: number; w: number; h: number }>;
  frameCount: number;
  width: number;
  height: number;
  imagePath: string;
}

interface YyFrame {
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
    parsed = JSON.parse(raw);
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
  const frames: Array<{ x: number; y: number; w: number; h: number }> =
    rawFrames.map((_f, idx) => ({
      x: (idx % Math.max(1, Math.floor(width || 1))) * width,
      y: Math.floor(idx / Math.max(1, Math.floor(width || 1))) * height,
      w: width,
      h: height,
    }));

  const imagePath = path.join(spriteYyDir, `${name}.png`);

  return {
    name,
    frames,
    frameCount: frames.length,
    width,
    height,
    imagePath,
  };
}
