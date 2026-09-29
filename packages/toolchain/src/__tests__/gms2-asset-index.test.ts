import { describe, it, expect, afterEach } from "vitest";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { AssetIndexSchema } from "@emptysock/types";
import {
  buildAssetIndex,
  assetIndexWarnings,
  nameIndexEntry,
  spriteIndexEntry,
} from "../gms2-asset-index.js";
import { importGMS2Project } from "../gms2-import.js";
import { transpileGML, setGmlSpriteNames } from "../gms2-transpile.js";

describe("buildAssetIndex", () => {
  it("sorts by kind then name and is schema-valid", () => {
    const idx = buildAssetIndex([
      nameIndexEntry("object", "obj_b"),
      nameIndexEntry("room", "rm_a"),
      nameIndexEntry("object", "obj_a"),
    ]);
    expect(idx.entries.map((e) => `${e.kind}:${e.name}`)).toEqual([
      "object:obj_a",
      "object:obj_b",
      "room:rm_a",
    ]);
    expect(() => AssetIndexSchema.parse(idx)).not.toThrow();
    expect(idx.collisions).toEqual([]);
  });

  it("lists cross-kind collisions and warns", () => {
    const idx = buildAssetIndex([
      nameIndexEntry("object", "thing"),
      nameIndexEntry("script", "thing"),
      nameIndexEntry("sound", "solo"),
    ]);
    expect(idx.collisions).toEqual([
      { name: "thing", kinds: ["object", "script"] },
    ]);
    expect(assetIndexWarnings(idx).join("\n")).toMatch(/"thing"/);
  });

  it("warns on case-only duplicates", () => {
    const idx = buildAssetIndex([
      nameIndexEntry("object", "Obj_A"),
      nameIndexEntry("object", "obj_a"),
    ]);
    expect(assetIndexWarnings(idx).join("\n")).toMatch(/differ only by case/);
  });

  it("spriteIndexEntry carries size, frameCount and the transpiled id", () => {
    const e = spriteIndexEntry({
      name: "spr_x",
      frames: [],
      frameCount: 3,
      width: 8,
      height: 12,
      originX: 4,
      imagePath: "",
    });
    expect(e).toMatchObject({
      kind: "sprite",
      id: "./assets/sprites/spr_x/frame_0.png",
      width: 8,
      height: 12,
      frameCount: 3,
      originX: 4,
    });
  });
});

const tmpDirs: string[] = [];
afterEach(async () => {
  await Promise.all(
    tmpDirs.splice(0).map((d) => fs.rm(d, { recursive: true, force: true })),
  );
});
async function mkTemp(prefix: string): Promise<string> {
  const d = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  tmpDirs.push(d);
  return d;
}

describe("importGMS2Project — asset-index.json", () => {
  it("writes sprite dims/frameCount, font size and object names", async () => {
    const dir = await mkTemp("gms2-index-");
    const out = await mkTemp("gms2-index-out-");
    await fs.writeFile(
      path.join(dir, "p.yyp"),
      `{"%Name":"Idx","resources":[
        {"id":{"name":"obj_hero","path":"objects/obj_hero/obj_hero.yy",},},
        {"id":{"name":"spr_hero","path":"sprites/spr_hero/spr_hero.yy",},},
        {"id":{"name":"fnt_main","path":"fonts/fnt_main/fnt_main.yy",},},
      ],}`,
      "utf-8",
    );
    const sdir = path.join(dir, "sprites", "spr_hero");
    await fs.mkdir(sdir, { recursive: true });
    for (const f of ["a", "b"]) {
      await fs.writeFile(
        path.join(sdir, `${f}.png`),
        Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      );
    }
    await fs.writeFile(
      path.join(sdir, "spr_hero.yy"),
      `{"name":"spr_hero","width":20,"height":30,"frames":[{"name":"a",},{"name":"b",}],}`,
      "utf-8",
    );
    const odir = path.join(dir, "objects", "obj_hero");
    await fs.mkdir(odir, { recursive: true });
    await fs.writeFile(
      path.join(odir, "obj_hero.yy"),
      `{"name":"obj_hero","spriteId":{"name":"spr_hero",},}`,
      "utf-8",
    );
    const fdir = path.join(dir, "fonts", "fnt_main");
    await fs.mkdir(fdir, { recursive: true });
    await fs.writeFile(
      path.join(fdir, "fnt_main.yy"),
      `{"resourceType":"GMFont","name":"fnt_main","fontName":"Arial","size":14,"bold":true,}`,
      "utf-8",
    );

    await importGMS2Project(path.join(dir, "p.yyp"), out, { verbose: false });

    const idx = AssetIndexSchema.parse(
      JSON.parse(
        await fs.readFile(path.join(out, "asset-index.json"), "utf-8"),
      ),
    );
    const find = (kind: string, name: string) =>
      idx.entries.find((e) => e.kind === kind && e.name === name);
    expect(find("sprite", "spr_hero")).toMatchObject({
      width: 20,
      height: 30,
      frameCount: 2,
      id: "./assets/sprites/spr_hero/frame_0.png",
    });
    expect(find("font", "fnt_main")).toMatchObject({ size: 14, bold: true });
    expect(find("object", "obj_hero")).toBeDefined();
  });
});

describe("transpile — registry-backed getters are ctx-threaded", () => {
  it("threads _ctx into font_get_size, object_exists, asset_get_index, sprite_exists", () => {
    setGmlSpriteNames(["spr_a"]);
    const out = transpileGML(
      'a = font_get_size(fnt_x); b = object_exists(obj_y); c = asset_get_index("spr_a"); d = sprite_exists(spr_a);',
    );
    expect(out).toContain("GmlActions.font_get_size(_ctx,");
    expect(out).toContain("GmlActions.object_exists(_ctx,");
    expect(out).toContain("GmlActions.asset_get_index(_ctx,");
    expect(out).toContain("GmlActions.sprite_exists(_ctx,");
    setGmlSpriteNames([]);
  });
});
