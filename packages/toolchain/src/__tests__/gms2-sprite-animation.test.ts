import { describe, it, expect, afterEach } from "vitest";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { convertGms2Sprite } from "../gms2-sprite-import.js";
import { buildSpriteAsset, buildObjectPrefabJSON } from "../gms2-codegen.js";
import { importGMS2Project } from "../gms2-import.js";

const tmpDirs: string[] = [];
async function mkTemp(prefix: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  tmpDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(
    tmpDirs.splice(0).map((d) => fs.rm(d, { recursive: true, force: true })),
  );
});

/** Writes a real multi-frame sprite directory: a .yy with N frames (real .yy frame-UUID convention) plus one PNG per frame, named by that frame's own resource name. */
async function writeMultiFrameSprite(
  projectRoot: string,
  name: string,
  frameCount: number,
  opts: { playbackSpeed?: number; playbackSpeedType?: number } = {},
): Promise<void> {
  const dir = path.join(projectRoot, "sprites", name);
  await fs.mkdir(dir, { recursive: true });
  const frameNames = Array.from(
    { length: frameCount },
    (_, i) => `frame-uuid-${i}`,
  );
  for (const fn of frameNames) {
    await fs.writeFile(
      path.join(dir, `${fn}.png`),
      Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    );
  }
  const sequence =
    opts.playbackSpeed !== undefined
      ? `,"sequence":{"playbackSpeed":${opts.playbackSpeed},"playbackSpeedType":${opts.playbackSpeedType ?? 0},}`
      : "";
  await fs.writeFile(
    path.join(dir, `${name}.yy`),
    `{"name":"${name}","width":16,"height":16,"frames":[${frameNames
      .map((fn) => `{"name":"${fn}",}`)
      .join(",")}]${sequence},}`,
    "utf-8",
  );
}

describe("convertGms2Sprite — multi-frame", () => {
  it("reads every frame in frames[] order, and a real playbackSpeed/playbackSpeedType", async () => {
    const dir = await mkTemp("gms2-sprite-multiframe-");
    await writeMultiFrameSprite(dir, "spr_walk", 4, {
      playbackSpeed: 15,
      playbackSpeedType: 0,
    });
    const asset = await convertGms2Sprite(
      path.join(dir, "sprites", "spr_walk"),
    );
    expect(asset.frameCount).toBe(4);
    expect(asset.frames.map((f) => path.basename(f.imagePath))).toEqual([
      "frame-uuid-0.png",
      "frame-uuid-1.png",
      "frame-uuid-2.png",
      "frame-uuid-3.png",
    ]);
    // playbackSpeedType 0 (fps) converted onto the engine's frames-per-step
    // unit via the documented ASSUMED_STEPS_PER_SECOND = 60.
    expect(asset.frameSpeed).toBeCloseTo(15 / 60);
  });

  it("reads playbackSpeedType 1 (frames per step) with no conversion", async () => {
    const dir = await mkTemp("gms2-sprite-spf-");
    await writeMultiFrameSprite(dir, "spr_walk", 2, {
      playbackSpeed: 0.25,
      playbackSpeedType: 1,
    });
    const asset = await convertGms2Sprite(
      path.join(dir, "sprites", "spr_walk"),
    );
    expect(asset.frameSpeed).toBe(0.25);
  });

  it("leaves frameSpeed undefined when the .yy has no sequence data", async () => {
    const dir = await mkTemp("gms2-sprite-nospeed-");
    await writeMultiFrameSprite(dir, "spr_static", 1);
    const asset = await convertGms2Sprite(
      path.join(dir, "sprites", "spr_static"),
    );
    expect(asset.frameSpeed).toBeUndefined();
  });
});

describe("buildSpriteAsset — copies every frame, not just frame_0", () => {
  it("writes one PNG per frame and a {n}-templated texturePath for a multi-frame sprite", async () => {
    const dir = await mkTemp("gms2-buildsprite-");
    const out = await mkTemp("gms2-buildsprite-out-");
    await writeMultiFrameSprite(dir, "spr_walk", 3, {
      playbackSpeed: 12,
      playbackSpeedType: 0,
    });
    const content = await buildSpriteAsset("spr_walk", dir, out);

    const files = await fs.readdir(
      path.join(out, "assets", "sprites", "spr_walk"),
    );
    expect(files.sort()).toEqual(["frame_0.png", "frame_1.png", "frame_2.png"]);
    expect(content).toContain(
      'texturePath: "./assets/sprites/spr_walk/frame_{n}.png"',
    );
    expect(content).toContain("frameCount: 3");
  });

  it("keeps the old single-file literal path for a one-frame sprite", async () => {
    const dir = await mkTemp("gms2-buildsprite-single-");
    const out = await mkTemp("gms2-buildsprite-single-out-");
    await writeMultiFrameSprite(dir, "spr_static", 1);
    const content = await buildSpriteAsset("spr_static", dir, out);
    expect(content).toContain(
      'texturePath: "./assets/sprites/spr_static/frame_0.png"',
    );
    expect(content).not.toContain("{n}");
  });
});

describe("buildObjectPrefabJSON — seeds frameCount/frameSpeed for a multi-frame initial sprite", () => {
  it("emits a templated texturePath plus frameCount/frameSpeed overrides", async () => {
    const dir = await mkTemp("gms2-obj-anim-");
    await writeMultiFrameSprite(dir, "spr_dad_walk", 5, {
      playbackSpeed: 10,
      playbackSpeedType: 1,
    });
    const objDir = path.join(dir, "objects", "obj_dad");
    await fs.mkdir(objDir, { recursive: true });
    await fs.writeFile(
      path.join(objDir, "obj_dad.yy"),
      `{"name":"obj_dad","spriteId":{"name":"spr_dad_walk",},}`,
      "utf-8",
    );

    const raw = await buildObjectPrefabJSON("obj_dad", dir);
    const prefab = JSON.parse(raw) as {
      components: { component: string; overrides?: Record<string, unknown> }[];
    };
    const spriteComp = prefab.components.find((c) => c.component === "Sprite");
    expect(spriteComp?.overrides).toEqual({
      texturePath: "./assets/sprites/spr_dad_walk/frame_{n}.png",
      frameCount: 5,
      frameSpeed: 10,
    });
  });

  it("keeps the plain single-frame Sprite override when the sprite has one frame", async () => {
    const dir = await mkTemp("gms2-obj-static-");
    await writeMultiFrameSprite(dir, "spr_crate", 1);
    const objDir = path.join(dir, "objects", "obj_crate");
    await fs.mkdir(objDir, { recursive: true });
    await fs.writeFile(
      path.join(objDir, "obj_crate.yy"),
      `{"name":"obj_crate","spriteId":{"name":"spr_crate",},}`,
      "utf-8",
    );
    const raw = await buildObjectPrefabJSON("obj_crate", dir);
    const prefab = JSON.parse(raw) as {
      components: { component: string; overrides?: Record<string, unknown> }[];
    };
    const spriteComp = prefab.components.find((c) => c.component === "Sprite");
    expect(spriteComp?.overrides).toEqual({
      texturePath: "./assets/sprites/spr_crate/frame_0.png",
    });
  });
});

describe("importGMS2Project — end-to-end multi-frame sprite import", () => {
  it("imports a project with an animated object's sprite emitting every frame file", async () => {
    const dir = await mkTemp("gms2-e2e-anim-");
    const out = await mkTemp("gms2-e2e-anim-out-");
    await fs.writeFile(
      path.join(dir, "p.yyp"),
      `{
        "%Name":"Anim Test",
        "resources":[
          {"id":{"name":"obj_hero","path":"objects/obj_hero/obj_hero.yy",},},
        ],
      }`,
      "utf-8",
    );
    await writeMultiFrameSprite(dir, "spr_hero_walk", 4, {
      playbackSpeed: 12,
      playbackSpeedType: 0,
    });
    const objDir = path.join(dir, "objects", "obj_hero");
    await fs.mkdir(objDir, { recursive: true });
    await fs.writeFile(
      path.join(objDir, "obj_hero.yy"),
      `{"name":"obj_hero","spriteId":{"name":"spr_hero_walk",},}`,
      "utf-8",
    );

    await importGMS2Project(path.join(dir, "p.yyp"), out, { verbose: false });

    const prefabRaw = await fs.readFile(
      path.join(out, "obj_hero.prefab.json"),
      "utf-8",
    );
    const prefab = JSON.parse(prefabRaw) as {
      components: { component: string; overrides?: Record<string, unknown> }[];
    };
    const spriteComp = prefab.components.find((c) => c.component === "Sprite");
    expect(spriteComp?.overrides?.["frameCount"]).toBe(4);
  });
});
