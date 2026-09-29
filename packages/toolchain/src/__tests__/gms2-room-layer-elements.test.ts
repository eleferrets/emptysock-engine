import { describe, it, expect, afterEach } from "vitest";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { convertGms2Room } from "../gms2-room-import.js";
import { importGMS2Project } from "../gms2-import.js";
import { transpileGML } from "../gms2-transpile.js";

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

const ROOM_YY = `{
  "name":"rm_title",
  "roomSettings":{"Width":640,"Height":480,},
  "layers":[
    {"assets":[
      {"spriteId":{"name":"spr_gun","path":"sprites/spr_gun/spr_gun.yy",},"headPosition":1.0,"rotation":90.0,"scaleX":2.0,"scaleY":1.0,"animationSpeed":0.5,"colour":2164260863,"x":100.0,"y":50.0,"name":"gGun","resourceType":"GMRSpriteGraphic",},
      {"spriteId":{"name":"spr_missing","path":"sprites/spr_missing/spr_missing.yy",},"headPosition":0.0,"rotation":0.0,"scaleX":1.0,"scaleY":1.0,"animationSpeed":1.0,"colour":4294967295,"x":0.0,"y":0.0,"name":"gGone","resourceType":"GMRSpriteGraphic",},
      {"sequenceId":{"name":"seq_intro","path":"sequences/seq_intro/seq_intro.yy",},"headPosition":3.0,"rotation":0.0,"scaleX":1.0,"scaleY":1.0,"animationSpeed":2.0,"colour":4294967295,"x":7.0,"y":8.0,"name":"gIntro","resourceType":"GMRSequenceGraphic",},
    ],"visible":true,"depth":100,"name":"TitleAssets","resourceType":"GMRAssetLayer",},
  ],
}`;

async function project(): Promise<{ dir: string; out: string }> {
  const dir = await mkTemp("gms2-el-");
  const out = await mkTemp("gms2-el-out-");
  await fs.writeFile(
    path.join(dir, "p.yyp"),
    `{"%Name":"El","resources":[
      {"id":{"name":"rm_title","path":"rooms/rm_title/rm_title.yy",},},
      {"id":{"name":"spr_gun","path":"sprites/spr_gun/spr_gun.yy",},},
      {"id":{"name":"seq_intro","path":"sequences/seq_intro/seq_intro.yy",},},
    ],}`,
  );
  await fs.mkdir(path.join(dir, "rooms", "rm_title"), { recursive: true });
  await fs.writeFile(
    path.join(dir, "rooms", "rm_title", "rm_title.yy"),
    ROOM_YY,
  );
  const sp = path.join(dir, "sprites", "spr_gun");
  await fs.mkdir(sp, { recursive: true });
  for (const f of ["f0", "f1"])
    await fs.writeFile(path.join(sp, `${f}.png`), Buffer.from([0x89, 0x50]));
  await fs.writeFile(
    path.join(sp, "spr_gun.yy"),
    `{"name":"spr_gun","width":20,"height":10,"frames":[{"name":"f0",},{"name":"f1",}],"sequence":{"playbackSpeed":30,"playbackSpeedType":0,"xorigin":10,"yorigin":5,},}`,
  );
  const qd = path.join(dir, "sequences", "seq_intro");
  await fs.mkdir(qd, { recursive: true });
  await fs.writeFile(
    path.join(qd, "seq_intro.yy"),
    `{"resourceType":"GMSequence","length":10.0,"playbackSpeed":30.0,"playbackSpeedType":0,"tracks":[],}`,
  );
  return { dir, out };
}

describe("GMS2 room-layer sprite and sequence elements", () => {
  it("parses GMRAssetLayer assets", async () => {
    const { dir } = await project();
    const room = await convertGms2Room(
      path.join(dir, "rooms", "rm_title", "rm_title.yy"),
    );
    const layer = room.layers[0];
    expect(layer?.depth).toBe(100);
    expect(layer?.assets?.map((a) => [a.kind, a.name, a.assetName])).toEqual([
      ["sprite", "gGun", "spr_gun"],
      ["sprite", "gGone", "spr_missing"],
      ["sequence", "gIntro", "seq_intro"],
    ]);
  });

  it("imports elements into .scene.json entities and reports unresolved ones", async () => {
    const { dir, out } = await project();
    const result = await importGMS2Project(path.join(dir, "p.yyp"), out, {
      verbose: false,
    });
    const scene = JSON.parse(
      await fs.readFile(
        path.join(out, "rooms", "rm_title.scene.json"),
        "utf-8",
      ),
    ) as {
      entities: {
        components: Record<string, { data: Record<string, unknown> }>;
      }[];
    };
    const byName = (n: string) =>
      scene.entities.find(
        (e) => e.components["LayerElement"]?.data["name"] === n,
      );
    const comp = (e: (typeof scene.entities)[number] | undefined, c: string) =>
      e?.components[c]?.data;

    const gun = byName("gGun");
    expect(comp(gun, "LayerElement")).toEqual({
      name: "gGun",
      layer: "TitleAssets",
      kind: "sprite",
    });
    expect(comp(gun, "Transform")).toMatchObject({
      x: 100,
      y: 50,
      scaleX: 2,
      scaleY: 1,
    });
    expect(comp(gun, "Transform")?.["rotation"]).toBeCloseTo(-Math.PI / 2); // GM CCW -> clockwise
    expect(comp(gun, "Sprite")).toMatchObject({
      texturePath: "./assets/sprites/spr_gun/frame_{n}.png",
      depth: -100,
      anchorX: 0.5,
      anchorY: 0.5,
      width: 20,
      height: 10,
      frameCount: 2,
      currentFrame: 1,
      // 0xFF | tint: colour 0x root; 2164260863 = 0x80FFFFFF -> alpha ~0.5, white
      tint: 0xffffff,
    });
    expect(comp(gun, "Sprite")?.["alpha"]).toBeCloseTo(128 / 255);
    expect(comp(gun, "Sprite")?.["frameSpeed"]).toBeCloseTo((30 / 60) * 0.5);

    const seq = byName("gIntro");
    expect(comp(seq, "GmlSequenceState")).toEqual({
      sequenceId: "seq_intro",
      position: 3,
      speed: 60,
      playing: true,
    });
    expect(byName("gGone")).toBeUndefined();
    expect(result.warnings.join("\n")).toContain('sprite element "gGone"');
  });

  it("threads the new layer element GML calls", () => {
    const out = transpileGML(
      'g = layer_sprite_get_id("TitleAssets", "gGun"); layer_sprite_destroy(g);',
    );
    expect(out).toContain(
      'GmlActions.layer_sprite_get_id(_ctx, "TitleAssets", "gGun")',
    );
    expect(out).toContain("GmlActions.layer_sprite_destroy(_ctx,");
  });
});
