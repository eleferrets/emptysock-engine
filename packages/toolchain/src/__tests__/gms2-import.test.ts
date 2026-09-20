import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import { importGMS2Project } from "../gms2-import.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// This suite runs the GMS2 importer end-to-end against a real, full
// GameMaker Studio 2 export ("J3 Adventure") rather than a synthetic
// fixture. The project data is user-provided and lives only on disk
// (gitignored — see packages/toolchain/src/__fixtures__/gms2-j3-adventure)
// so it is never committed to the repo. When the fixture isn't present
// (e.g. a fresh clone without it), the suite skips instead of failing.

const FIXTURE_ROOT = path.join(
  __dirname,
  "..",
  "__fixtures__",
  "gms2-j3-adventure",
);
const YYP_PATH = path.join(FIXTURE_ROOT, "J3 Adventure.yyp");

async function fixtureExists(): Promise<boolean> {
  try {
    await fs.access(YYP_PATH);
    return true;
  } catch {
    return false;
  }
}

describe.runIf(await fixtureExists())(
  "importGMS2Project (real fixture)",
  () => {
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
      const spriteDir = path.join(
        outDir,
        "assets",
        "sprites",
        "Breakable_Block",
      );
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
  },
);
