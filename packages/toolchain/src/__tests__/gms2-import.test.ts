import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { importGMS2Project, parseGmsJson } from "../gms2-import.js";
import { convertGms2Sprite } from "../gms2-sprite-import.js";
import { convertGms2Room } from "../gms2-room-import.js";

// ---------------------------------------------------------------------------
// This suite is fully synthetic — it builds small, hand-written .yyp/.yy
// snippets on disk in a temp directory rather than depending on any real
// GameMaker project. It exists to capture, as permanent regression tests,
// the real-format quirks discovered while validating the importer against
// a real GMS2 export (see RELEASE_PASS.md for the full write-up of what
// broke and why). No fixture directory is required or referenced.
// ---------------------------------------------------------------------------

describe("parseGmsJson (trailing-comma tolerant parsing)", () => {
  it("parses GMS2-style JSON with trailing commas in objects and arrays", () => {
    const raw = `{
      "%Name":"Test Project",
      "resources":[
        {"id":{"name":"obj_foo","path":"objects/obj_foo/obj_foo.yy",},},
        {"id":{"name":"scr_bar","path":"scripts/scr_bar/scr_bar.yy",},},
      ],
      "defaultScriptType":1,
    }`;
    const parsed = parseGmsJson(raw) as {
      "%Name": string;
      resources: unknown[];
    };
    expect(parsed["%Name"]).toBe("Test Project");
    expect(parsed.resources).toHaveLength(2);
  });

  it("still parses strict JSON with no trailing commas", () => {
    const raw = `{"a": 1, "b": [1, 2, 3]}`;
    expect(parseGmsJson(raw)).toEqual({ a: 1, b: [1, 2, 3] });
  });

  it("throws on genuinely malformed JSON (not just a trailing comma)", () => {
    expect(() => parseGmsJson("{not json at all")).toThrow();
  });
});

describe("importGMS2Project (synthetic fabricated project)", () => {
  let projectDir: string;
  let outDir: string;

  beforeAll(async () => {
    projectDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "gms2-synthetic-project-"),
    );
    outDir = await fs.mkdtemp(path.join(os.tmpdir(), "gms2-synthetic-out-"));

    // Minimal .yyp with GameMaker-style trailing commas and a "%Name" key
    // (the project root only ever carries "%Name", never a plain "name").
    await fs.writeFile(
      path.join(projectDir, "test.yyp"),
      `{
        "%Name":"Synthetic Test",
        "defaultScriptType":1,
        "resources":[
          {"id":{"name":"obj_hero","path":"objects/obj_hero/obj_hero.yy",},},
        ],
      }`,
      "utf-8",
    );

    // Object with a Create event, a Collision event, and KeyPress/KeyRelease
    // events — exercising the event-naming logic that silently dropped
    // these on a real project (only Create_/Step_/Draw_/Destroy_ were
    // previously recognised).
    const objDir = path.join(projectDir, "objects", "obj_hero");
    await fs.mkdir(objDir, { recursive: true });
    await fs.writeFile(
      path.join(objDir, "Create_0.gml"),
      "var x = 0;",
      "utf-8",
    );
    await fs.writeFile(
      path.join(objDir, "Collision_obj_wall.gml"),
      "instance_destroy();",
      "utf-8",
    );
    await fs.writeFile(
      path.join(objDir, "KeyPress_37.gml"),
      "show_message('left');",
      "utf-8",
    );
    await fs.writeFile(
      path.join(objDir, "KeyRelease_37.gml"),
      "show_message('left released');",
      "utf-8",
    );
  });

  afterAll(async () => {
    await fs.rm(projectDir, { recursive: true, force: true });
    await fs.rm(outDir, { recursive: true, force: true });
  });

  it("parses the trailing-comma .yyp (via %Name) and converts the object", async () => {
    const result = await importGMS2Project(
      path.join(projectDir, "test.yyp"),
      outDir,
      { verbose: false },
    );
    expect(result.converted).toBeGreaterThanOrEqual(1);
  });

  it("emits onCollideWith/onKeyPress/onKeyRelease methods by event file name", async () => {
    await importGMS2Project(path.join(projectDir, "test.yyp"), outDir, {
      verbose: false,
    });
    const content = await fs.readFile(
      path.join(outDir, "obj_hero.ts"),
      "utf-8",
    );
    expect(content).toContain("onCollideWithObjWall");
    expect(content).toContain("onKeyPressLeft");
    expect(content).toContain("onKeyReleaseLeft");
  });
});

describe("convertGms2Sprite (synthetic per-frame PNGs)", () => {
  let spriteDir: string;

  beforeAll(async () => {
    spriteDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "gms2-synthetic-sprite-"),
    );

    // Real GMS2 sprites store one PNG per frame at the sprite directory
    // root, named by the frame's own UUID resource name from the .yy
    // "frames[].name" field — never "<sprite name>.png". Reproduce that
    // shape with two fake "frame" PNGs (1x1 PNG bytes are enough; the
    // importer only copies bytes, it doesn't decode them).
    const tinyPng = Buffer.from(
      "89504e470d0a1a0a0000000d49484452000000010000000108020000009077" +
        "53de0000000a49444154789c6300010000050001a5f645400000000049454e" +
        "44ae426082",
      "hex",
    );
    await fs.writeFile(path.join(spriteDir, "frame-uuid-aaaa.png"), tinyPng);
    await fs.writeFile(path.join(spriteDir, "frame-uuid-bbbb.png"), tinyPng);
    await fs.writeFile(
      path.join(spriteDir, "MySprite.yy"),
      `{
        "%Name":"MySprite",
        "name":"MySprite",
        "width":32,
        "height":32,
        "frames":[
          {"$GMSpriteFrame":"v1","%Name":"frame-uuid-aaaa","name":"frame-uuid-aaaa","resourceType":"GMSpriteFrame","resourceVersion":"2.0",},
          {"$GMSpriteFrame":"v1","%Name":"frame-uuid-bbbb","name":"frame-uuid-bbbb","resourceType":"GMSpriteFrame","resourceVersion":"2.0",},
        ],
        "resourceType":"GMSprite",
      }`,
      "utf-8",
    );
  });

  afterAll(async () => {
    await fs.rm(spriteDir, { recursive: true, force: true });
  });

  it("resolves each frame to its own UUID-named PNG on disk, not <name>.png", async () => {
    const sprite = await convertGms2Sprite(spriteDir);
    expect(sprite.frameCount).toBe(2);
    expect(sprite.frames[0]?.imagePath).toContain("frame-uuid-aaaa.png");
    expect(sprite.frames[1]?.imagePath).toContain("frame-uuid-bbbb.png");
  });

  it("throws a clear error when a referenced frame PNG is missing on disk", async () => {
    const brokenDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "gms2-synthetic-sprite-broken-"),
    );
    await fs.writeFile(
      path.join(brokenDir, "Broken.yy"),
      `{
        "name":"Broken",
        "width":16,
        "height":16,
        "frames":[
          {"name":"does-not-exist-on-disk",},
        ],
      }`,
      "utf-8",
    );
    await expect(convertGms2Sprite(brokenDir)).rejects.toThrow(
      /does not exist on disk/,
    );
    await fs.rm(brokenDir, { recursive: true, force: true });
  });
});

describe("convertGms2Room (synthetic resourceType-based layers)", () => {
  let roomYyPath: string;

  beforeAll(async () => {
    const roomDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "gms2-synthetic-room-"),
    );
    roomYyPath = path.join(roomDir, "rm_test.yy");
    // Real room .yy layers identify their kind via "resourceType"
    // (e.g. "GMRInstanceLayer") — there is no "layerType" field in real
    // files, so relying on it alone always fell back to "unknown".
    await fs.writeFile(
      roomYyPath,
      `{
        "name":"rm_test",
        "roomSettings":{"Width":640,"Height":480,},
        "layers":[
          {
            "resourceType":"GMRInstanceLayer",
            "name":"Instances",
            "instances":[
              {"objectId":{"name":"obj_hero",},"x":80,"y":64,},
            ],
          },
        ],
      }`,
      "utf-8",
    );
  });

  afterAll(async () => {
    await fs.rm(path.dirname(roomYyPath), { recursive: true, force: true });
  });

  it("detects layer type from resourceType, not the nonexistent layerType field", async () => {
    const room = await convertGms2Room(roomYyPath);
    expect(room.layers[0]?.type).toBe("GMRInstanceLayer");
  });

  it("extracts real instance placements with object name and position", async () => {
    const room = await convertGms2Room(roomYyPath);
    expect(room.width).toBe(640);
    expect(room.height).toBe(480);
    expect(room.layers[0]?.instances).toEqual([
      { objectName: "obj_hero", x: 80, y: 64 },
    ]);
  });
});
