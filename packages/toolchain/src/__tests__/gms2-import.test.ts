import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import { importGMS2Project, parseGmsJson } from "../gms2-import.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Synthetic unit tests — no real fixture required, always run (CI included).
// These cover the pure-logic pieces the real-fixture bugs were found in,
// so a regression is caught even on a machine/CI without the real project.
// ---------------------------------------------------------------------------

describe("parseGmsJson (trailing-comma tolerant parsing)", () => {
  it("parses real GMS2-style JSON with trailing commas in objects and arrays", () => {
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

    // Minimal .yyp with GameMaker-style trailing commas, one object with a
    // Create event, a Collision event, and KeyPress/KeyRelease events —
    // exercising the same event-naming logic the real fixture exposed as
    // broken, without depending on the real fixture being present.
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

  it("parses the trailing-comma .yyp and converts the object", async () => {
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

// ---------------------------------------------------------------------------
// Real-fixture suite below. This is a real, full GameMaker Studio 2 export
// ("J3 Adventure") rather than a synthetic fixture. The project data is
// user-provided and lives only on disk (gitignored — see
// packages/toolchain/src/__fixtures__/gms2-j3-adventure), so it is never
// committed to the repo or available in CI. When the fixture isn't present
// (any clone other than the one it was validated on), this whole suite is
// skipped cleanly rather than failing.
// ---------------------------------------------------------------------------

const FIXTURE_ROOT = path.join(
  __dirname,
  "..",
  "__fixtures__",
  "gms2-j3-adventure",
);
const YYP_PATH = path.join(FIXTURE_ROOT, "J3 Adventure.yyp");
const FIXTURE_PRESENT = existsSync(YYP_PATH);

if (!FIXTURE_PRESENT) {
  describe.skip("importGMS2Project (real fixture) — SKIPPED: real GMS2 fixture not present, see RELEASE_PASS.md", () => {
    it("skipped", () => {
      /* no-op: fixture-backed suite only runs when the real project is on disk locally */
    });
  });
}

describe.runIf(FIXTURE_PRESENT)("importGMS2Project (real fixture)", () => {
  let outDir: string;

  beforeAll(async () => {
    outDir = await fs.mkdtemp(path.join(os.tmpdir(), "gms2-import-test-"));
  });

  afterAll(async () => {
    await fs.rm(outDir, { recursive: true, force: true });
  });

  it("parses the real, non-strict-JSON .yyp file without throwing", async () => {
    // Real GMS2 .yyp/.yy files use trailing commas — this would throw a
    // JSON.parse error if the lenient parser regressed.
    await expect(
      importGMS2Project(YYP_PATH, outDir, { verbose: false }),
    ).resolves.toBeDefined();
  });

  it("converts a realistic number of objects, scripts, sprites, and rooms", async () => {
    const result = await importGMS2Project(YYP_PATH, outDir, {
      verbose: false,
    });
    // Real project has 59 object directories, ~200 sprites, 10 rooms.
    expect(result.converted).toBeGreaterThan(150);
    expect(result.skipped.length).toBeGreaterThan(0); // sounds/fonts/notes stay manual
  });

  it("emits onCollideWith*/onKeyPress*/onKeyRelease* methods for obj_Brian", async () => {
    await importGMS2Project(YYP_PATH, outDir, { verbose: false });
    const content = await fs.readFile(
      path.join(outDir, "obj_Brian.ts"),
      "utf-8",
    );
    // Real obj_Brian has Collision_obj_boulder.gml, Collision_obj_newroom_vert.gml,
    // and KeyPress_37..40 / KeyRelease_37..40 (GameMaker vk codes for arrow keys).
    expect(content).toContain("onCollideWithObjBoulder");
    expect(content).toContain("onCollideWithObjNewroomVert");
    expect(content).toContain("onKeyPressLeft");
    expect(content).toContain("onKeyPressUp");
    expect(content).toContain("onKeyPressRight");
    expect(content).toContain("onKeyPressDown");
    expect(content).toContain("onKeyReleaseLeft");
    expect(content).toContain("class ObjBrian extends Component");
  });

  it("copies real sprite frame PNGs to disk with correct byte size", async () => {
    await importGMS2Project(YYP_PATH, outDir, { verbose: false });
    const spriteDir = path.join(outDir, "assets", "sprites", "Breakable_Block");
    const files = await fs.readdir(spriteDir);
    expect(files.length).toBeGreaterThan(0);

    // frame_0.png in the output corresponds to the .yy file's first listed
    // frame — read the .yy to find that frame's real UUID filename on disk.
    const sourceDir = path.join(FIXTURE_ROOT, "sprites", "Breakable_Block");
    const yyRaw = await fs.readFile(
      path.join(sourceDir, "Breakable_Block.yy"),
      "utf-8",
    );
    const parsed = JSON.parse(yyRaw.replace(/,(\s*[}\]])/g, "$1")) as {
      frames: Array<{ name: string }>;
    };
    const firstFrameName = parsed.frames[0]?.name;
    expect(firstFrameName).toBeDefined();

    const sourceStat = await fs.stat(
      path.join(sourceDir, `${firstFrameName}.png`),
    );
    const copiedStat = await fs.stat(path.join(spriteDir, "frame_0.png"));
    // The copy is byte-for-byte, so sizes must match exactly (not just be nonzero).
    expect(copiedStat.size).toBe(sourceStat.size);
    expect(copiedStat.size).toBeGreaterThan(0);
  });

  it("produces structurally correct room data with real instance placements", async () => {
    await importGMS2Project(YYP_PATH, outDir, { verbose: false });
    const content = await fs.readFile(
      path.join(outDir, "rooms", "rm_Brians_Room.ts"),
      "utf-8",
    );
    expect(content).toContain("Room size: 640x480");
    expect(content).toContain("createEntity()");
    expect(content).toContain("ObjBriansRoom");
  });
});
