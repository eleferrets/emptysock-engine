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
      path.join(outDir, "obj_hero.behavior.ts"),
      "utf-8",
    );
    expect(content).toContain("onCollideWithObjWall");
    expect(content).toContain("onKeyPressLeft");
    expect(content).toContain("onKeyReleaseLeft");
    // The generated behavior module's Entity type must come from the ECS
    // subpath — apps/ide's runtime bundle and Monaco types only cover
    // @emptysock/engine/ecs now, and a .prefab.json's entities are real ECS
    // entities, not classic ones.
    expect(content).toContain("from '@emptysock/engine/ecs'");
    expect(content).not.toContain("from '@emptysock/engine'");
  });

  it("emits a real .prefab.json (ground rule 15) instead of a class, with a Transform component", async () => {
    await importGMS2Project(path.join(projectDir, "test.yyp"), outDir, {
      verbose: false,
    });
    const raw = await fs.readFile(
      path.join(outDir, "obj_hero.prefab.json"),
      "utf-8",
    );
    const prefab = JSON.parse(raw) as {
      prefabName: string;
      components: { component: string }[];
    };
    expect(prefab.prefabName).toBe("obj_hero");
    expect(prefab.components).toEqual([{ component: "Transform" }]);
  });

  it("does not warn about defaultScriptType: 1 alone (it is not a reliable GML Visual signal)", async () => {
    // The fixture project above carries "defaultScriptType":1 while every
    // event it declares (Create_0.gml, Collision_obj_wall.gml, etc.) is
    // ordinary text GML on disk — exactly the real-project shape that used
    // to produce a false-positive "uses GML Visual" warning.
    const result = await importGMS2Project(
      path.join(projectDir, "test.yyp"),
      outDir,
      { verbose: false },
    );
    expect(
      result.warnings.some((w) => /GML Visual|defaultScriptType/i.test(w)),
    ).toBe(false);
  });

  it("leaves legacy GameMaker 8.1 DnD-compat symbols untranspiled rather than faking them", async () => {
    // Real GMS2 2.3+ projects can still carry legacy DnD-compatibility
    // symbols (e.g. from ported GM8.1 content) in compiled action lists.
    // The transpiler has no rule for these and must not silently invent
    // a fake implementation — they should surface verbatim as unresolved
    // identifiers for the developer to migrate by hand.
    const dndDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "gms2-synthetic-dnd-"),
    );
    const dndOutDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "gms2-synthetic-dnd-out-"),
    );
    try {
      await fs.writeFile(
        path.join(dndDir, "dnd.yyp"),
        `{
          "%Name":"DnD Legacy Test",
          "defaultScriptType":1,
          "resources":[
            {"id":{"name":"obj_legacy","path":"objects/obj_legacy/obj_legacy.yy",},},
          ],
        }`,
        "utf-8",
      );
      const objDir = path.join(dndDir, "objects", "obj_legacy");
      await fs.mkdir(objDir, { recursive: true });
      await fs.writeFile(
        path.join(objDir, "Create_0.gml"),
        "action_move(direction, 4);\ngml_pragma('forceinline');",
        "utf-8",
      );

      await importGMS2Project(path.join(dndDir, "dnd.yyp"), dndOutDir, {
        verbose: false,
      });
      const content = await fs.readFile(
        path.join(dndOutDir, "obj_legacy.behavior.ts"),
        "utf-8",
      );
      expect(content).toContain("action_move(direction, 4);");
      expect(content).toContain("gml_pragma('forceinline');");
    } finally {
      await fs.rm(dndDir, { recursive: true, force: true });
      await fs.rm(dndOutDir, { recursive: true, force: true });
    }
  });
});

describe("GMS2 room import emits a real .scene.json (ground rule 15)", () => {
  it("writes prefabInstances for every known-object room instance, omitting unknown ones", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "gms2-room-json-"));
    const out = await fs.mkdtemp(path.join(os.tmpdir(), "gms2-room-json-out-"));
    try {
      await fs.writeFile(
        path.join(dir, "room.yyp"),
        `{
          "%Name":"Room JSON Test",
          "resources":[
            {"id":{"name":"obj_player","path":"objects/obj_player/obj_player.yy",},},
            {"id":{"name":"rm_main","path":"rooms/rm_main/rm_main.yy",},},
          ],
        }`,
        "utf-8",
      );
      await fs.mkdir(path.join(dir, "objects", "obj_player"), {
        recursive: true,
      });
      const roomDir = path.join(dir, "rooms", "rm_main");
      await fs.mkdir(roomDir, { recursive: true });
      await fs.writeFile(
        path.join(roomDir, "rm_main.yy"),
        `{
          "roomSettings":{"Width":800,"Height":600,},
          "layers":[
            {"name":"Instances","resourceType":"GMRInstanceLayer","instances":[
              {"objectId":{"name":"obj_player",},"x":10,"y":20,},
              {"objectId":{"name":"obj_unknown_not_imported",},"x":99,"y":99,},
            ],},
          ],
        }`,
        "utf-8",
      );

      await importGMS2Project(path.join(dir, "room.yyp"), out, {
        verbose: false,
      });
      const raw = await fs.readFile(
        path.join(out, "rooms", "rm_main.scene.json"),
        "utf-8",
      );
      const scene = JSON.parse(raw) as {
        sceneName: string;
        prefabInstances: { prefab: string; props: { x: number; y: number } }[];
      };
      expect(scene.sceneName).toBe("rm_main");
      expect(scene.prefabInstances).toEqual([
        { prefab: "obj_player", props: { x: 10, y: 20 } },
      ]);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
      await fs.rm(out, { recursive: true, force: true });
    }
  });

  it("warns when a room's background layer references a real sprite, instead of silently dropping it", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "gms2-room-bg-"));
    const out = await fs.mkdtemp(path.join(os.tmpdir(), "gms2-room-bg-out-"));
    try {
      await fs.writeFile(
        path.join(dir, "room.yyp"),
        `{
          "%Name":"Room Background Test",
          "resources":[
            {"id":{"name":"rm_bg","path":"rooms/rm_bg/rm_bg.yy",},},
          ],
        }`,
        "utf-8",
      );
      const roomDir = path.join(dir, "rooms", "rm_bg");
      await fs.mkdir(roomDir, { recursive: true });
      await fs.writeFile(
        path.join(roomDir, "rm_bg.yy"),
        `{
          "roomSettings":{"Width":800,"Height":600,},
          "layers":[
            {"name":"Background","resourceType":"GMRBackgroundLayer","spriteId":{"name":"bg_grass",},},
            {"name":"Compat colour","resourceType":"GMRBackgroundLayer","spriteId":null,},
          ],
        }`,
        "utf-8",
      );

      const result = await importGMS2Project(path.join(dir, "room.yyp"), out, {
        verbose: false,
      });
      expect(result.warnings).toEqual([
        expect.stringContaining(
          'Room "rm_bg" has a background layer using sprite "bg_grass"',
        ) as string,
      ]);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
      await fs.rm(out, { recursive: true, force: true });
    }
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

describe("a resource type with no import path (fonts, notes, compatibility reports, …)", () => {
  it("warns by name instead of vanishing silently into the skipped list", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "gms2-unknown-res-"));
    const out = await fs.mkdtemp(
      path.join(os.tmpdir(), "gms2-unknown-res-out-"),
    );
    try {
      await fs.writeFile(
        path.join(dir, "test.yyp"),
        `{
          "%Name":"Unknown Resource Test",
          "resources":[
            {"id":{"name":"font0","path":"fonts/font0/font0.yy",},},
          ],
        }`,
        "utf-8",
      );

      const result = await importGMS2Project(path.join(dir, "test.yyp"), out, {
        verbose: false,
      });
      expect(result.skipped).toContain("font0");
      expect(result.warnings).toEqual([
        expect.stringContaining(
          '"font0" (fonts/font0/font0.yy) has no import path',
        ) as string,
      ]);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
      await fs.rm(out, { recursive: true, force: true });
    }
  });
});
