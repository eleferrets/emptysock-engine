import { describe, it, expect, afterEach } from "vitest";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { convertGms2Sprite } from "../gms2-sprite-import.js";
import { buildObjectPrefabJSON } from "../gms2-codegen.js";
import {
  convertGms2RoomBackgrounds,
  type RoomData,
} from "../gms2-room-import.js";

const tmpDirs: string[] = [];
afterEach(async () => {
  await Promise.all(
    tmpDirs.splice(0).map((d) => fs.rm(d, { recursive: true, force: true })),
  );
});

async function writeSprite(
  root: string,
  name: string,
  nineSlice: string,
): Promise<void> {
  const dir = path.join(root, "sprites", name);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "f0.png"), Buffer.from([0x89, 0x50]));
  await fs.writeFile(
    path.join(dir, `${name}.yy`),
    `{"name":"${name}","width":48,"height":48,"frames":[{"name":"f0",}],"nineSlice":${nineSlice},}`,
    "utf-8",
  );
}

const ENABLED = `{"left":16,"top":12,"right":16,"bottom":12,"enabled":true,"tileMode":[0,0,0,0,0],}`;
const DISABLED = `{"left":0,"top":0,"right":0,"bottom":0,"enabled":false,"tileMode":[0,0,0,0,0],}`;

describe("GMS2 nineSlice metadata", () => {
  it("reads enabled guides", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ns-"));
    tmpDirs.push(root);
    await writeSprite(root, "spr_panel", ENABLED);
    const s = await convertGms2Sprite(path.join(root, "sprites", "spr_panel"));
    expect(s.nineSlice).toEqual({ left: 16, right: 16, top: 12, bottom: 12 });
  });

  it("ignores a disabled block (the only real project shape) and null", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ns-"));
    tmpDirs.push(root);
    await writeSprite(root, "spr_back", DISABLED);
    await writeSprite(root, "spr_null", "null");
    for (const n of ["spr_back", "spr_null"]) {
      const s = await convertGms2Sprite(path.join(root, "sprites", n));
      expect(s.nineSlice).toBeUndefined();
    }
  });

  it("seeds sliceMode/slice guides on the object's Sprite component", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ns-"));
    tmpDirs.push(root);
    await writeSprite(root, "spr_panel", ENABLED);
    const od = path.join(root, "objects", "obj_panel");
    await fs.mkdir(od, { recursive: true });
    await fs.writeFile(
      path.join(od, "obj_panel.yy"),
      `{"name":"obj_panel","spriteId":{"name":"spr_panel",},}`,
    );
    const prefab = JSON.parse(
      await buildObjectPrefabJSON("obj_panel", root),
    ) as {
      components: Record<string, { data?: Record<string, unknown> }>;
    };
    const o = prefab.components["Sprite"]?.data;
    expect(o).toMatchObject({
      sliceMode: 1,
      sliceLeft: 16,
      sliceRight: 16,
      sliceTop: 12,
      sliceBottom: 12,
    });
  });
});

describe("GMS2 tiled background layers", () => {
  async function run(htiled: boolean, vtiled: boolean) {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "bg-"));
    tmpDirs.push(root);
    await writeSprite(root, "spr_trees", DISABLED);
    const room: RoomData = {
      name: "rm",
      width: 640,
      height: 480,
      viewsEnabled: false,
      views: [],
      layers: [
        {
          name: "Trees",
          type: "GMRBackgroundLayer",
          tiles: [],
          instances: [],
          backgroundSprite: "spr_trees",
          htiled,
          vtiled,
          offsetX: 0,
          offsetY: 400,
        },
      ],
    } as RoomData;
    const r = await convertGms2RoomBackgrounds(
      room,
      root,
      path.join(root, "out"),
    );
    const comps = r.entities[0]?.components;
    return [comps?.["Transform"]?.data, comps?.["Sprite"]?.data];
  }

  it("htiled-only spans the room width at native height, at the layer y", async () => {
    const c = await run(true, false);
    expect(c[0]).toEqual({ x: 320, y: 424 });
    expect(c[1]).toMatchObject({
      width: 640,
      height: 48,
      sliceMode: 2,
    });
  });

  it("both axes cover the whole room", async () => {
    const c = await run(true, true);
    expect(c[1]).toMatchObject({
      width: 640,
      height: 480,
      sliceMode: 2,
    });
  });

  it("untiled keeps the stretch-to-cover behaviour", async () => {
    const c = await run(false, false);
    expect(c[1]).not.toHaveProperty("sliceMode");
    expect(c[0]).toMatchObject({ scaleX: 640 / 48 });
  });
});
