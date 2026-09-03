import * as fs from "node:fs";
import * as path from "node:path";

// ── GMS2 .yy input shape ─────────────────────────────────────────────────────

interface GMS2FrameId {
  name: string;
}

interface GMS2Frame {
  id: GMS2FrameId;
  compositeImage: { FrameId: GMS2FrameId };
}

interface GMS2Sequence {
  animationSpeedType: number;
  animationSpeed: number;
  length: number;
  xorigin?: number;
  yorigin?: number;
}

interface GMS2SpriteYY {
  name: string;
  width: number;
  height: number;
  frames: GMS2Frame[];
  sequence: GMS2Sequence;
  bbox_left: number;
  bbox_right: number;
  bbox_top: number;
  bbox_bottom: number;
  origin: number;
}

// ── Engine-compatible output shape ───────────────────────────────────────────

export interface SpriteAsset {
  type: "sprite";
  name: string;
  width: number;
  height: number;
  frameCount: number;
  fps: number;
  originX: number;
  originY: number;
  bbox: { left: number; top: number; right: number; bottom: number };
  frames: string[];
  sourceFile: string;
}

// ── Origin code mapping ───────────────────────────────────────────────────────

function resolveOrigin(
  code: number,
  width: number,
  height: number,
  seq: GMS2Sequence,
): { originX: number; originY: number } {
  switch (code) {
    case 0:
      return { originX: 0, originY: 0 };
    case 1:
      return { originX: width / 2, originY: 0 };
    case 2:
      return { originX: width, originY: 0 };
    case 3:
      return { originX: 0, originY: height / 2 };
    case 4:
      return { originX: width / 2, originY: height / 2 };
    case 5:
      return { originX: width, originY: height / 2 };
    case 6:
      return { originX: 0, originY: height };
    case 7:
      return { originX: width / 2, originY: height };
    case 8:
      return { originX: width, originY: height };
    case 9:
      return {
        originX: seq.xorigin ?? width / 2,
        originY: seq.yorigin ?? height / 2,
      };
    default:
      return { originX: width / 2, originY: height / 2 };
  }
}

// ── Validation helpers ────────────────────────────────────────────────────────

function assertString(val: unknown, field: string, src: string): string {
  if (typeof val !== "string") {
    throw new Error(
      `importGMS2Sprite: missing or invalid "${field}" in "${src}"`,
    );
  }
  return val;
}

function assertNumber(val: unknown, field: string, src: string): number {
  if (typeof val !== "number") {
    throw new Error(
      `importGMS2Sprite: missing or invalid "${field}" in "${src}"`,
    );
  }
  return val;
}

function parseYY(raw: string, yyPath: string): GMS2SpriteYY {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `importGMS2Sprite: invalid JSON in "${yyPath}": ${String(err)}`,
    );
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error(`importGMS2Sprite: root must be an object in "${yyPath}"`);
  }
  const obj = parsed as Record<string, unknown>;

  const name = assertString(obj["name"], "name", yyPath);
  const width = assertNumber(obj["width"], "width", yyPath);
  const height = assertNumber(obj["height"], "height", yyPath);

  if (!Array.isArray(obj["frames"])) {
    throw new Error(
      `importGMS2Sprite: "frames" must be an array in "${yyPath}"`,
    );
  }
  const frames = (obj["frames"] as unknown[]).map((f, i) => {
    if (typeof f !== "object" || f === null) {
      throw new Error(
        `importGMS2Sprite: frames[${i}] is not an object in "${yyPath}"`,
      );
    }
    const fo = f as Record<string, unknown>;
    if (typeof fo["id"] !== "object" || fo["id"] === null) {
      throw new Error(
        `importGMS2Sprite: frames[${i}].id missing in "${yyPath}"`,
      );
    }
    const id = fo["id"] as Record<string, unknown>;
    assertString(id["name"], `frames[${i}].id.name`, yyPath);
    if (
      typeof fo["compositeImage"] !== "object" ||
      fo["compositeImage"] === null
    ) {
      throw new Error(
        `importGMS2Sprite: frames[${i}].compositeImage missing in "${yyPath}"`,
      );
    }
    const ci = fo["compositeImage"] as Record<string, unknown>;
    if (typeof ci["FrameId"] !== "object" || ci["FrameId"] === null) {
      throw new Error(
        `importGMS2Sprite: frames[${i}].compositeImage.FrameId missing in "${yyPath}"`,
      );
    }
    return {
      id: { name: id["name"] as string },
      compositeImage: {
        FrameId: {
          name: ((ci["FrameId"] as Record<string, unknown>)["name"] ??
            "") as string,
        },
      },
    };
  });

  if (typeof obj["sequence"] !== "object" || obj["sequence"] === null) {
    throw new Error(`importGMS2Sprite: "sequence" missing in "${yyPath}"`);
  }
  const seqObj = obj["sequence"] as Record<string, unknown>;
  const animationSpeedType = assertNumber(
    seqObj["animationSpeedType"],
    "sequence.animationSpeedType",
    yyPath,
  );
  const animationSpeed = assertNumber(
    seqObj["animationSpeed"],
    "sequence.animationSpeed",
    yyPath,
  );
  const length = assertNumber(seqObj["length"], "sequence.length", yyPath);
  const xorigin =
    typeof seqObj["xorigin"] === "number" ? seqObj["xorigin"] : undefined;
  const yorigin =
    typeof seqObj["yorigin"] === "number" ? seqObj["yorigin"] : undefined;

  const bbox_left = assertNumber(obj["bbox_left"], "bbox_left", yyPath);
  const bbox_right = assertNumber(obj["bbox_right"], "bbox_right", yyPath);
  const bbox_top = assertNumber(obj["bbox_top"], "bbox_top", yyPath);
  const bbox_bottom = assertNumber(obj["bbox_bottom"], "bbox_bottom", yyPath);
  const origin = assertNumber(obj["origin"], "origin", yyPath);

  return {
    name,
    width,
    height,
    frames,
    sequence: {
      animationSpeedType,
      animationSpeed,
      length,
      ...(xorigin !== undefined ? { xorigin } : {}),
      ...(yorigin !== undefined ? { yorigin } : {}),
    },
    bbox_left,
    bbox_right,
    bbox_top,
    bbox_bottom,
    origin,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Parse a GMS2 sprite `.yy` file and return an engine-compatible SpriteAsset.
 * Throws a descriptive Error on missing file, invalid JSON, or missing fields.
 */
export function importGMS2Sprite(yyPath: string): SpriteAsset {
  let raw: string;
  try {
    raw = fs.readFileSync(yyPath, "utf-8");
  } catch (err) {
    throw new Error(
      `importGMS2Sprite: cannot read "${yyPath}": ${String(err)}`,
    );
  }

  const yy = parseYY(raw, yyPath);
  const { originX, originY } = resolveOrigin(
    yy.origin,
    yy.width,
    yy.height,
    yy.sequence,
  );

  // fps: animationSpeedType 1 = frames-per-game-frame → multiply by 60
  const fps =
    yy.sequence.animationSpeedType === 1
      ? yy.sequence.animationSpeed * 60
      : yy.sequence.animationSpeed;

  // GMS2 stores each frame PNG under sprites/<name>/images/{uuid}.png
  const frames = yy.frames.map((f) => `images/${f.id.name}.png`);

  return {
    type: "sprite",
    name: yy.name,
    width: yy.width,
    height: yy.height,
    frameCount: Math.round(yy.sequence.length),
    fps,
    originX,
    originY,
    bbox: {
      left: yy.bbox_left,
      top: yy.bbox_top,
      right: yy.bbox_right,
      bottom: yy.bbox_bottom,
    },
    frames,
    sourceFile: path.basename(yyPath),
  };
}

/**
 * Walk a directory, find all `.yy` files, and import each as a SpriteAsset.
 * Files that fail to parse are skipped with a warning written to stderr.
 */
export function importGMS2SpriteDir(spriteDir: string): SpriteAsset[] {
  // GMS2 stores each sprite in its own subdirectory: sprites/spr_player/spr_player.yy
  // Use a recursive scan so nested .yy files are found.
  const yyPaths: string[] = [];
  const walk = (dir: string): void => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (err) {
      process.stderr.write(
        `importGMS2SpriteDir: cannot read directory "${dir}": ${String(err)}\n`,
      );
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        walk(path.join(dir, entry.name));
      } else if (entry.isFile() && entry.name.endsWith(".yy")) {
        yyPaths.push(path.join(dir, entry.name));
      }
    }
  };
  walk(spriteDir);

  const results: SpriteAsset[] = [];
  for (const yyPath of yyPaths) {
    try {
      results.push(importGMS2Sprite(yyPath));
    } catch (err) {
      process.stderr.write(
        `importGMS2SpriteDir: skipping "${yyPath}": ${String(err)}\n`,
      );
    }
  }
  return results;
}
