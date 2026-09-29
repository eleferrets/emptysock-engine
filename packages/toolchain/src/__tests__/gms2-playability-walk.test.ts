import { describe, it, expect } from "vitest";
import fs from "fs/promises";
import path from "path";
import { readdirSync } from "fs";
import { importGMS2Project } from "../gms2-import.js";
import { parseGmsJson } from "../gms2-parse.js";
import type {
  ComponentDef,
  Entity,
  PrefabDef,
  SceneDocument,
  GmsProjectData,
} from "@emptysock/engine";

/**
 * Walks every room of the real project in its real `.yyp`
 * `RoomOrderNodes` order through a real headless `GmsProjectRuntime`, running
 * 600 frames in each with `vk_right` held, and reports per room: that it
 * loaded, entity counts, whether a live `obj_player` moved, every room change
 * the game itself made, and every handler exception `GmlBehaviorSystem`
 * caught (its `safeCall` isolates a throwing handler and logs it, so
 * "`update()` did not throw" alone proves nothing about the transpiled code).
 * Skipped honestly when the real project is not on disk.
 */
// Real project fixture: set GMS_FIXTURE_DIR to a directory containing a GMS2 `.yyp`.
const REAL_PROJECT = (() => {
  const dir = process.env["GMS_FIXTURE_DIR"] ?? "";
  try {
    const yyp = readdirSync(dir).find((n) => n.endsWith(".yyp"));
    return yyp ? path.join(dir, yyp) : "";
  } catch {
    return "";
  }
})();

interface RoomResult {
  room: string;
  loaded: boolean;
  frames: number;
  entitiesStart: number;
  entitiesMax: number;
  playerMoved: number | null;
  roomChangedTo: string[];
  handlerErrors: Record<string, number>;
  thrown: string | null;
}

describe("GMS2 real project: room walk (a real project)", () => {
  it("loads and runs every room in roomOrder for 600 frames with no uncaught throws and no handler exceptions", async () => {
    const exists = await fs
      .access(REAL_PROJECT)
      .then(() => true)
      .catch(() => false);
    if (!exists) return;

    const scratchRoot = path.join(__dirname, "..", "..", ".gms2-smoke-tmp");
    await fs.mkdir(scratchRoot, { recursive: true });
    const outDir = await fs.mkdtemp(path.join(scratchRoot, "gms2-walk-"));
    await importGMS2Project(REAL_PROJECT, outDir);

    const yyp = parseGmsJson(await fs.readFile(REAL_PROJECT, "utf8")) as {
      RoomOrderNodes?: { roomId?: { name?: string } }[];
    };
    const roomOrder = (yyp.RoomOrderNodes ?? [])
      .map((n) => n.roomId?.name)
      .filter((n): n is string => typeof n === "string");
    expect(roomOrder.length).toBeGreaterThan(5);
    expect(roomOrder[0]).toBe("rm_init");

    const manifest = JSON.parse(
      await fs.readFile(path.join(outDir, "project-manifest.json"), "utf8"),
    ) as { prefabs: string[]; scenes: string[] };
    const convertedObjects = manifest.prefabs.map((f) =>
      f.replace(/\.prefab\.json$/, ""),
    );

    const eng = await import("@emptysock/engine");
    const {
      parsePrefabFile,
      GmsProjectRuntime,
      Game,
      registerGmlBehavior,
      unregisterGmlBehavior,
      Transform,
      Meta,
      Sprite,
      PhysicsBody,
      GmlBehaviorState,
      LayerElement,
      GmlSequenceState,
    } = eng;
    const lookupMap: Record<string, ComponentDef> = {
      Transform,
      Meta,
      Sprite,
      PhysicsBody,
      GmlBehaviorState,
      LayerElement,
      GmlSequenceState,
    };

    const prefabs: Record<string, PrefabDef> = {};
    for (const objName of convertedObjects) {
      const raw = await fs
        .readFile(path.join(outDir, `${objName}.prefab.json`), "utf8")
        .catch(() => undefined);
      if (raw === undefined) continue;
      try {
        prefabs[objName] = parsePrefabFile(
          JSON.parse(raw),
          (name) => lookupMap[name],
        );
      } catch {
        /* a prefab needing an unwired component is skipped, not faked */
      }
    }

    const registeredIds: string[] = [];
    for (const objName of convertedObjects) {
      const p = path.join(outDir, `${objName}.behavior.ts`);
      if (
        !(await fs
          .access(p)
          .then(() => true)
          .catch(() => false))
      )
        continue;
      const mod: unknown = await import(p);
      registerGmlBehavior(objName, mod as never);
      registeredIds.push(objName);
    }

    const rooms: Record<string, SceneDocument> = {};
    for (const f of manifest.scenes) {
      const name = f.replace(/^rooms\//, "").replace(/\.scene\.json$/, "");
      rooms[name] = JSON.parse(
        await fs.readFile(
          path.join(outDir, "rooms", `${name}.scene.json`),
          "utf8",
        ),
      ) as SceneDocument;
    }
    for (const r of roomOrder) expect(rooms[r]).toBeDefined();

    const data: GmsProjectData = {
      rooms,
      roomOrder,
      prefabs,
      lookup: (name) => lookupMap[name],
    };
    const game = new Game();
    // The importer copies datafiles to `included/`; a real host mounts them
    // into the game's file system (a real project's `obj_game` reads `lang.txt`).
    const includedDir = path.join(outDir, "included");
    for (const f of await fs.readdir(includedDir).catch(() => [] as string[])) {
      game.files.preload(
        f,
        await fs.readFile(path.join(includedDir, f), "utf8"),
      );
    }
    const runtime = new GmsProjectRuntime(game, data, {});

    // Capture the handler exceptions GmlBehaviorSystem catches and logs.
    const caught: string[] = [];
    const origError = console.error;
    console.error = (...args: unknown[]): void => {
      const msg = args.map((a) => String(a)).join(" ");
      if (msg.startsWith("GmlBehaviorSystem:")) caught.push(msg);
      else origError(...args);
    };

    const VK_RIGHT = "ArrowRight";
    const FRAMES = 600;
    const DT = 1 / 60;
    const results: RoomResult[] = [];
    try {
      for (const roomName of roomOrder) {
        const before = caught.length;
        const result: RoomResult = {
          room: roomName,
          loaded: false,
          frames: 0,
          entitiesStart: 0,
          entitiesMax: 0,
          playerMoved: null,
          roomChangedTo: [],
          handlerErrors: {},
          thrown: null,
        };
        results.push(result);
        try {
          await runtime.loadRoom(roomName);
          result.loaded = runtime.currentRoom === roomName;
          game.input.simulateKeyDown(VK_RIGHT);
          const count = (): number => {
            let n = 0;
            runtime.scene?.each(Transform, () => {
              n += 1;
            });
            return n;
          };
          const findPlayer = (): Entity | undefined => {
            let found: Entity | undefined;
            runtime.scene?.each(Meta, (m, e) => {
              if (m.name === "obj_player" && found === undefined) found = e;
            });
            return found;
          };
          result.entitiesStart = count();
          result.entitiesMax = result.entitiesStart;
          let player = findPlayer();
          const startX = player?.get(Transform)?.x ?? 0;
          let lastRoom = runtime.currentRoom;
          for (let f = 0; f < FRAMES; f += 1) {
            runtime.update(DT);
            result.frames += 1;
            result.entitiesMax = Math.max(result.entitiesMax, count());
            if (runtime.currentRoom !== lastRoom) {
              // The game itself changed room (room_goto and friends). The
              // async load needs a macrotask turn before the scene swaps.
              lastRoom = runtime.currentRoom;
              if (lastRoom !== undefined) result.roomChangedTo.push(lastRoom);
              player = undefined;
            }
            // eslint-disable-next-line no-restricted-globals -- a real async loadScene may be pending
            if (f % 100 === 99) await new Promise((r) => setTimeout(r, 1));
            player ??= findPlayer();
          }
          if (player !== undefined && runtime.currentRoom === roomName) {
            result.playerMoved = (player.get(Transform)?.x ?? startX) - startX;
          }
        } catch (err) {
          result.thrown =
            err instanceof Error ? (err.stack ?? err.message) : String(err);
        } finally {
          game.input.simulateKeyUp(VK_RIGHT);
        }
        for (const line of caught.slice(before)) {
          const m =
            /^GmlBehaviorSystem: "([^"]+)"\.(\w+) threw[^.]*\. ([^\n]*)/.exec(
              line,
            );
          const key = m ? `${m[1]}.${m[2]}: ${m[3]}` : line.slice(0, 160);
          result.handlerErrors[key] = (result.handlerErrors[key] ?? 0) + 1;
        }
      }
    } finally {
      console.error = origError;
    }

    const table = results.map((r) => {
      const errs = Object.entries(r.handlerErrors);
      return `${r.room.padEnd(12)} loaded=${r.loaded} frames=${r.frames} entities=${r.entitiesStart}->${r.entitiesMax} playerDx=${r.playerMoved === null ? "n/a" : Math.round(r.playerMoved)} roomChanges=[${r.roomChangedTo.join(",")}] handlerErrors=${errs.length} thrown=${r.thrown === null ? "no" : "YES"}`;
    });
    const report = `${table.join("\n")}\n${results
      .flatMap((r) =>
        Object.entries(r.handlerErrors).map(
          ([k, n]) => `  ${r.room}: ${k} (x${n})`,
        ),
      )
      .join("\n")}\n`;
    if (process.env["GMS2_WALK_REPORT"]) {
      await fs.writeFile(process.env["GMS2_WALK_REPORT"], report, "utf8");
    }

    for (const id of registeredIds) unregisterGmlBehavior(id);
    await fs.rm(outDir, { recursive: true, force: true });

    // Every room loads and runs 600 frames without an uncaught throw.
    expect(
      results
        .filter((r) => r.thrown !== null)
        .map((r) => `${r.room}: ${r.thrown}`),
    ).toEqual([]);
    expect(results.every((r) => r.frames === FRAMES)).toBe(true);
    // The real player walks in the first gameplay room.
    const rm1 = results.find((r) => r.room === "rm_1");
    expect(rm1?.playerMoved ?? 0).toBeGreaterThan(50);
    // No transpiled handler throws.
    const errorsByRoom = results
      .filter((r) => Object.keys(r.handlerErrors).length > 0)
      .map((r) => `${r.room}: ${Object.keys(r.handlerErrors).join(" | ")}`);
    expect(errorsByRoom).toEqual([]);
  }, 300_000);
});
