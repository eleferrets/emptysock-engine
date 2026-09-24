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
    // The generated behavior module's Entity type must come from
    // @emptysock/engine — the one real export surface — and a
    // .prefab.json's entities are real entities.
    expect(content).toContain("from '@emptysock/engine'");
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

  it("transpiles action_move to a real, entity-threaded GmlActions call, while still leaving genuinely unmodelled GM8.1 compatibility symbols (gml_pragma) untranspiled", async () => {
    // Real GMS2 2.3+ projects can still carry legacy DnD-compatibility
    // symbols (e.g. from ported GM8.1 content) in compiled action lists.
    // `action_move` now has a real implementation (see
    // packages/engine/src/compat/gmlActions.ts) and gets rewritten to a
    // threaded call; `gml_pragma` (a compiler directive, not a DnD action)
    // has no engine-side equivalent at all and must still surface verbatim
    // for the developer to migrate by hand.
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
      expect(content).toContain(
        "GmlActions.action_move(_entity, _ctx, direction, 4);",
      );
      expect(content).toContain("gml_pragma('forceinline');");
      expect(content).toContain(
        "import * as GmlActions from '@emptysock/engine';",
      );
      expect(content).toContain("_ctx: GmlActionContext");
    } finally {
      await fs.rm(dndDir, { recursive: true, force: true });
      await fs.rm(dndOutDir, { recursive: true, force: true });
    }
  });

  it("transpiles action_move + action_sprite_set together in one Create event, both entity-threaded", async () => {
    const dir = await fs.mkdtemp(
      path.join(os.tmpdir(), "gms2-synthetic-dnd-move-sprite-"),
    );
    const out = await fs.mkdtemp(
      path.join(os.tmpdir(), "gms2-synthetic-dnd-move-sprite-out-"),
    );
    try {
      await fs.writeFile(
        path.join(dir, "p.yyp"),
        `{
          "%Name":"DnD Move Sprite Test",
          "resources":[
            {"id":{"name":"obj_walker","path":"objects/obj_walker/obj_walker.yy",},},
          ],
        }`,
        "utf-8",
      );
      const objDir = path.join(dir, "objects", "obj_walker");
      await fs.mkdir(objDir, { recursive: true });
      await fs.writeFile(
        path.join(objDir, "Create_0.gml"),
        "action_move(32, 4);\naction_sprite_set(spr_walk, 0, 1);",
        "utf-8",
      );

      await importGMS2Project(path.join(dir, "p.yyp"), out, { verbose: false });
      const content = await fs.readFile(
        path.join(out, "obj_walker.behavior.ts"),
        "utf-8",
      );
      expect(content).toContain(
        "GmlActions.action_move(_entity, _ctx, 32, 4);",
      );
      expect(content).toContain(
        "GmlActions.action_sprite_set(_entity, _ctx, spr_walk, 0, 1);",
      );
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
      await fs.rm(out, { recursive: true, force: true });
    }
  });

  it("nests action_if_collision around the following action_kill_object as a real if block", async () => {
    const dir = await fs.mkdtemp(
      path.join(os.tmpdir(), "gms2-synthetic-dnd-if-kill-"),
    );
    const out = await fs.mkdtemp(
      path.join(os.tmpdir(), "gms2-synthetic-dnd-if-kill-out-"),
    );
    try {
      await fs.writeFile(
        path.join(dir, "p.yyp"),
        `{
          "%Name":"DnD If Collision Kill Test",
          "resources":[
            {"id":{"name":"obj_hazard","path":"objects/obj_hazard/obj_hazard.yy",},},
          ],
        }`,
        "utf-8",
      );
      const objDir = path.join(dir, "objects", "obj_hazard");
      await fs.mkdir(objDir, { recursive: true });
      await fs.writeFile(
        path.join(objDir, "Step_0.gml"),
        "action_if_collision(other)\naction_kill_object();",
        "utf-8",
      );

      await importGMS2Project(path.join(dir, "p.yyp"), out, { verbose: false });
      const content = await fs.readFile(
        path.join(out, "obj_hazard.behavior.ts"),
        "utf-8",
      );
      expect(content).toContain(
        "if (GmlActions.action_if_collision(_entity, _ctx, other)) {",
      );
      expect(content).toContain(
        "GmlActions.action_kill_object(_entity, _ctx);",
      );
      // The kill call must be nested inside the if-block, not a flat sibling statement.
      const ifIndex = content.indexOf("if (GmlActions.action_if_collision");
      const killIndex = content.indexOf("GmlActions.action_kill_object");
      const closeBraceIndex = content.indexOf("}", ifIndex);
      expect(killIndex).toBeGreaterThan(ifIndex);
      expect(killIndex).toBeLessThan(closeBraceIndex);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
      await fs.rm(out, { recursive: true, force: true });
    }
  });

  it("transpiles action_create_object and action_next_room, entity-threaded", async () => {
    const dir = await fs.mkdtemp(
      path.join(os.tmpdir(), "gms2-synthetic-dnd-create-room-"),
    );
    const out = await fs.mkdtemp(
      path.join(os.tmpdir(), "gms2-synthetic-dnd-create-room-out-"),
    );
    try {
      await fs.writeFile(
        path.join(dir, "p.yyp"),
        `{
          "%Name":"DnD Create Object Next Room Test",
          "resources":[
            {"id":{"name":"obj_spawner","path":"objects/obj_spawner/obj_spawner.yy",},},
          ],
        }`,
        "utf-8",
      );
      const objDir = path.join(dir, "objects", "obj_spawner");
      await fs.mkdir(objDir, { recursive: true });
      await fs.writeFile(
        path.join(objDir, "Create_0.gml"),
        "action_create_object(obj_pickup, 10, 20);\naction_next_room();",
        "utf-8",
      );

      await importGMS2Project(path.join(dir, "p.yyp"), out, { verbose: false });
      const content = await fs.readFile(
        path.join(out, "obj_spawner.behavior.ts"),
        "utf-8",
      );
      expect(content).toContain(
        "GmlActions.action_create_object(_entity, _ctx, obj_pickup, 10, 20);",
      );
      expect(content).toContain("GmlActions.action_next_room(_entity, _ctx);");
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
      await fs.rm(out, { recursive: true, force: true });
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

  it("renders a room's real background sprite as a Transform+Sprite entity on the background layer", async () => {
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
          "name":"rm_bg",
          "roomSettings":{"Width":800,"Height":600,},
          "layers":[
            {"name":"Background","resourceType":"GMRBackgroundLayer","spriteId":{"name":"bg_grass",},},
            {"name":"Compat colour","resourceType":"GMRBackgroundLayer","spriteId":null,},
          ],
        }`,
        "utf-8",
      );

      // A real background sprite lives under sprites/, same as any other
      // GMS2 sprite — one PNG per frame, named by frame UUID.
      const tinyPng = Buffer.from(
        "89504e470d0a1a0a0000000d49484452000000010000000108020000009077" +
          "53de0000000a49444154789c6300010000050001a5f645400000000049454e" +
          "44ae426082",
        "hex",
      );
      const spriteDir = path.join(dir, "sprites", "bg_grass");
      await fs.mkdir(spriteDir, { recursive: true });
      await fs.writeFile(path.join(spriteDir, "bg-frame-uuid.png"), tinyPng);
      await fs.writeFile(
        path.join(spriteDir, "bg_grass.yy"),
        `{
          "name":"bg_grass",
          "width":800,
          "height":600,
          "frames":[{"name":"bg-frame-uuid",},],
        }`,
        "utf-8",
      );

      const result = await importGMS2Project(path.join(dir, "room.yyp"), out, {
        verbose: false,
      });
      expect(result.warnings).toEqual([]);

      const raw = await fs.readFile(
        path.join(out, "rooms", "rm_bg.scene.json"),
        "utf-8",
      );
      const scene = JSON.parse(raw) as {
        entities?: Array<{
          components: Array<{
            component: string;
            overrides?: Record<string, unknown>;
          }>;
        }>;
      };
      expect(scene.entities).toHaveLength(1);
      const entities = scene.entities as NonNullable<typeof scene.entities>;
      const entity = entities[0];
      if (entity === undefined) throw new Error("expected one entity");
      const sprite = entity.components.find((c) => c.component === "Sprite");
      expect(sprite?.overrides?.["layer"]).toBe("background");
      expect(sprite?.overrides?.["texturePath"]).toContain(
        "assets/backgrounds/bg_grass/",
      );

      await fs.access(
        path.join(out, "assets", "backgrounds", "bg_grass", "frame_0.png"),
      );
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
      await fs.rm(out, { recursive: true, force: true });
    }
  });

  it("warns (and omits the entity) when a room's background sprite can't actually be found on disk", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "gms2-room-bg-fail-"));
    const out = await fs.mkdtemp(
      path.join(os.tmpdir(), "gms2-room-bg-fail-out-"),
    );
    try {
      await fs.writeFile(
        path.join(dir, "room.yyp"),
        `{
          "%Name":"Room Background Fail Test",
          "resources":[
            {"id":{"name":"rm_bg2","path":"rooms/rm_bg2/rm_bg2.yy",},},
          ],
        }`,
        "utf-8",
      );
      const roomDir = path.join(dir, "rooms", "rm_bg2");
      await fs.mkdir(roomDir, { recursive: true });
      await fs.writeFile(
        path.join(roomDir, "rm_bg2.yy"),
        `{
          "name":"rm_bg2",
          "roomSettings":{"Width":800,"Height":600,},
          "layers":[
            {"name":"Background","resourceType":"GMRBackgroundLayer","spriteId":{"name":"bg_missing",},},
          ],
        }`,
        "utf-8",
      );
      // No sprites/bg_missing directory exists at all.

      const result = await importGMS2Project(path.join(dir, "room.yyp"), out, {
        verbose: false,
      });
      expect(result.warnings).toEqual([
        expect.stringContaining(
          'Room "rm_bg2" background sprite "bg_missing" could not be converted',
        ) as string,
      ]);

      const raw = await fs.readFile(
        path.join(out, "rooms", "rm_bg2.scene.json"),
        "utf-8",
      );
      const scene = JSON.parse(raw) as { entities?: unknown[] };
      expect(scene.entities ?? []).toHaveLength(0);
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

describe("a resource type with no import path (extensions, timelines, …)", () => {
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
            {"id":{"name":"ext0","path":"extensions/ext0/ext0.yy",},},
          ],
        }`,
        "utf-8",
      );

      const result = await importGMS2Project(path.join(dir, "test.yyp"), out, {
        verbose: false,
      });
      expect(result.skipped).toContain("ext0");
      expect(result.warnings).toEqual([
        expect.stringContaining(
          '"ext0" (extensions/ext0/ext0.yy) has no import path',
        ) as string,
      ]);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
      await fs.rm(out, { recursive: true, force: true });
    }
  });
});

describe("GMS2 sound import produces a real, loadable AudioSystem asset", () => {
  it("copies the real audio file and emits a descriptor matching AudioSystem.load/.play", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "gms2-sound-"));
    const out = await fs.mkdtemp(path.join(os.tmpdir(), "gms2-sound-out-"));
    try {
      await fs.writeFile(
        path.join(dir, "snd.yyp"),
        `{
          "%Name":"Sound Test",
          "resources":[
            {"id":{"name":"snd_jump","path":"sounds/snd_jump/snd_jump.yy",},},
          ],
        }`,
        "utf-8",
      );
      const soundDir = path.join(dir, "sounds", "snd_jump");
      await fs.mkdir(soundDir, { recursive: true });
      // A tiny fake .ogg — the importer only copies bytes, never decodes.
      await fs.writeFile(
        path.join(soundDir, "snd_jump.ogg"),
        Buffer.from([0x4f, 0x67, 0x67, 0x53]),
      );
      await fs.writeFile(
        path.join(soundDir, "snd_jump.yy"),
        `{
          "name":"snd_jump",
          "volume":0.8,
          "loop":false,
          "soundFile":"snd_jump.ogg",
          "audioGroupId":{"name":"audiogroup_sfx",},
        }`,
        "utf-8",
      );

      const result = await importGMS2Project(path.join(dir, "snd.yyp"), out, {
        verbose: false,
      });
      expect(result.skipped).not.toContain("snd_jump");

      const content = await fs.readFile(
        path.join(out, "assets", "snd_jump.sound.ts"),
        "utf-8",
      );
      expect(content).toContain("SndJumpSound");
      expect(content).toContain("./assets/sounds/snd_jump.ogg");
      expect(content).toContain("volume: 0.8");
      expect(content).toContain("audiogroup_sfx");
      expect(content).toContain("audio.load(");
      expect(content).toContain("audio.play(");

      // The real audio file itself was copied, not just referenced.
      await fs.access(
        path.join(out, "assets", "sounds", "snd_jump.ogg"),
      );
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
      await fs.rm(out, { recursive: true, force: true });
    }
  });

  it("reports a genuinely broken sound resource as manual, not converted", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "gms2-sound-bad-"));
    const out = await fs.mkdtemp(path.join(os.tmpdir(), "gms2-sound-bad-out-"));
    try {
      await fs.writeFile(
        path.join(dir, "snd.yyp"),
        `{
          "%Name":"Broken Sound Test",
          "resources":[
            {"id":{"name":"snd_broken","path":"sounds/snd_broken/snd_broken.yy",},},
          ],
        }`,
        "utf-8",
      );
      const soundDir = path.join(dir, "sounds", "snd_broken");
      await fs.mkdir(soundDir, { recursive: true });
      // .yy exists but references no real audio file, and none is on disk.
      await fs.writeFile(
        path.join(soundDir, "snd_broken.yy"),
        `{"name":"snd_broken","volume":1,}`,
        "utf-8",
      );

      const result = await importGMS2Project(path.join(dir, "snd.yyp"), out, {
        verbose: false,
      });
      expect(result.skipped).toContain("snd_broken");
      expect(
        result.warnings.some((w) => /Sound "snd_broken" could not be converted/.test(w)),
      ).toBe(true);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
      await fs.rm(out, { recursive: true, force: true });
    }
  });
});

describe("GMS2 font import emits family/size/style metadata for this engine's Canvas/CSS text rendering", () => {
  it("emits a font descriptor usable with Label's font/fontSize fields, without copying the glyph atlas", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "gms2-font-"));
    const out = await fs.mkdtemp(path.join(os.tmpdir(), "gms2-font-out-"));
    try {
      await fs.writeFile(
        path.join(dir, "font.yyp"),
        `{
          "%Name":"Font Test",
          "resources":[
            {"id":{"name":"font_title","path":"fonts/font_title/font_title.yy",},},
          ],
        }`,
        "utf-8",
      );
      const fontDir = path.join(dir, "fonts", "font_title");
      await fs.mkdir(fontDir, { recursive: true });
      await fs.writeFile(
        path.join(fontDir, "font_title.yy"),
        `{
          "name":"font_title",
          "fontName":"Verdana",
          "size":24,
          "bold":true,
          "italic":false,
        }`,
        "utf-8",
      );
      // A real GMS2 font resource also ships a pre-rendered glyph atlas PNG
      // — present here to prove the importer deliberately does not copy it.
      await fs.writeFile(
        path.join(fontDir, "font_title.png"),
        Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      );

      const result = await importGMS2Project(path.join(dir, "font.yyp"), out, {
        verbose: false,
      });
      expect(result.skipped).not.toContain("font_title");

      const content = await fs.readFile(
        path.join(out, "assets", "font_title.font.ts"),
        "utf-8",
      );
      expect(content).toContain('family: "Verdana"');
      expect(content).toContain("size: 24");
      expect(content).toContain("bold: true");
      expect(content).toContain("Label");

      expect(
        result.warnings.some((w) =>
          /glyph atlas image was not used/.test(w),
        ),
      ).toBe(true);

      // The glyph atlas PNG must not have been copied anywhere in the output.
      await expect(
        fs.access(path.join(out, "assets", "font_title.png")),
      ).rejects.toThrow();
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
      await fs.rm(out, { recursive: true, force: true });
    }
  });
});

describe("GMS2 note import preserves content instead of demanding a from-scratch recreation", () => {
  it("copies a note's real text content into notes/<name>.md and reports it as copied, not manual", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "gms2-note-"));
    const out = await fs.mkdtemp(path.join(os.tmpdir(), "gms2-note-out-"));
    try {
      await fs.writeFile(
        path.join(dir, "note.yyp"),
        `{
          "%Name":"Note Test",
          "resources":[
            {"id":{"name":"TODO","path":"notes/TODO/TODO.yy",},},
          ],
        }`,
        "utf-8",
      );
      const noteDir = path.join(dir, "notes", "TODO");
      await fs.mkdir(noteDir, { recursive: true });
      await fs.writeFile(
        path.join(noteDir, "TODO.yy"),
        `{"name":"TODO","resourceType":"GMNote",}`,
        "utf-8",
      );
      await fs.writeFile(
        path.join(noteDir, "TODO.txt"),
        "Remember to balance the boss fight.",
        "utf-8",
      );

      const result = await importGMS2Project(path.join(dir, "note.yyp"), out, {
        verbose: false,
      });
      expect(result.skipped).not.toContain("TODO");

      const content = await fs.readFile(
        path.join(out, "notes", "TODO.md"),
        "utf-8",
      );
      expect(content).toContain("Remember to balance the boss fight.");
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
      await fs.rm(out, { recursive: true, force: true });
    }
  });

  it("reports a note with no readable .txt file as manual, not silently lost", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "gms2-note-bad-"));
    const out = await fs.mkdtemp(path.join(os.tmpdir(), "gms2-note-bad-out-"));
    try {
      await fs.writeFile(
        path.join(dir, "note.yyp"),
        `{
          "%Name":"Broken Note Test",
          "resources":[
            {"id":{"name":"BadNote","path":"notes/BadNote/BadNote.yy",},},
          ],
        }`,
        "utf-8",
      );
      const noteDir = path.join(dir, "notes", "BadNote");
      await fs.mkdir(noteDir, { recursive: true });
      await fs.writeFile(
        path.join(noteDir, "BadNote.yy"),
        `{"name":"BadNote","resourceType":"GMNote",}`,
        "utf-8",
      );
      // No .txt file present.

      const result = await importGMS2Project(path.join(dir, "note.yyp"), out, {
        verbose: false,
      });
      expect(result.skipped).toContain("BadNote");
      expect(
        result.warnings.some((w) => /Note "BadNote" could not be copied/.test(w)),
      ).toBe(true);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
      await fs.rm(out, { recursive: true, force: true });
    }
  });
});
