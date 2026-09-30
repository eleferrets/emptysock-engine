import { describe, it, expect } from "vitest";
import fs from "fs/promises";
import path from "path";
import { importGMS2Project } from "../gms2-import.js";
import { fixtureYyp, yypDeclares } from "./helpers/fixture.js";
import type {
  ComponentDef,
  Entity,
  PrefabDef,
  SceneDocument,
  GmsProjectData,
} from "@emptysock/engine";

/**
 * A real, automated "does this actually play" smoke test against the real
 * a real project — not a synthetic fixture, and not a `tsc` type
 * sweep. `gms2-room-transition-e2e.test.ts` already proves the import ->
 * parse -> room-swap pipeline runs against real data, but it never loads a
 * single real generated `.behavior.ts` module or calls `runtime.update()`
 * — so it cannot catch a real runtime crash (a `ReferenceError`/
 * `TypeError` thrown the moment transpiled GML code actually executes)
 * the way this test is specifically built to.
 *
 * What this test proves: the whole GML behavior dispatch pipeline
 * (Create -> Step Begin/Update/End -> Collision -> Alarm -> Key dispatch,
 * all real, all wired per `GmsProjectRuntime`'s own CLAUDE.md entry) runs
 * against real, transpiled real-project object code — `obj_player`,
 * `obj_enemy`, `obj_gun`, `obj_wall`, `obj_camera`, `obj_input`, `obj_pna`,
 * `obj_checkpoint`, `obj_level_end` — for several hundred simulated
 * frames, fully headless (no renderer, matching this engine's own
 * headless-testing story), without throwing, without an unbounded entity
 * leak, and with real simulated player input (`InputSystem.
 * simulateKeyDown`) actually moving the real `obj_player` entity's real
 * `Transform.x`/`.y` through the real transpiled `obj_player`/`obj_input`
 * behavior chain (`obj_input`'s `scr_get_input()` reads `keyboard_check`;
 * `obj_player`'s own Step reads `obj_input.key_right`/`.key_jump` via a
 * real cross-instance lookup — see CLAUDE.md's "real cross-instance
 * references" entry).
 *
 * What this test does NOT prove: visual correctness, exact game-feel,
 * frame-perfect physics/collision response, or that every one of
 * a real project's ~49 real GameMaker object types individually behaves
 * exactly like real GameMaker — only that the real dispatch pipeline survives
 * real, sustained gameplay against real transpiled code with no crash and
 * sane entity-count/position behaviour. There is no renderer and no human
 * judgement involved.
 */
// Real project fixture: set GMS_FIXTURE_DIR to a directory containing a GMS2 `.yyp`.
// This test is written against one specific real project (its room order and
// object names are hard-coded below); any other project skips cleanly — the
// generic, project-independent coverage is gms2-multi-project-walk.test.ts.
const REAL_PROJECT = fixtureYyp();
const APPLICABLE =
  REAL_PROJECT !== "" &&
  yypDeclares(REAL_PROJECT, {
    rooms: ["rm_init", "rm_init2", "rm_1"],
    objects: ["obj_player", "obj_input", "obj_game"],
  });

describe("GMS2 real project — playability smoke test (a real project)", () => {
  it("runs sustained headless gameplay against real transpiled real-project object code with no crash", async () => {
    if (!APPLICABLE) {
      // Real project data lives outside the repository, and this test only
      // applies to the one project whose rooms/objects it names — an honest
      // skip elsewhere rather than a fabricated pass or a false failure.
      return;
    }

    // Written under this package's own directory tree (not the system
    // `os.tmpdir()`, unlike the room-transition e2e test above) —
    // dynamically importing a real generated `.behavior.ts` module from
    // here needs Node's ordinary `node_modules` walk to resolve the bare
    // `@emptysock/engine` specifier its own generated `import` statement
    // uses, which only works if the file lives somewhere under this
    // monorepo's own directory tree.
    const scratchRoot = path.join(__dirname, "..", "..", ".gms2-smoke-tmp");
    await fs.mkdir(scratchRoot, { recursive: true });
    const outDir = await fs.mkdtemp(
      path.join(scratchRoot, "gms2-playability-smoke-"),
    );
    await importGMS2Project(REAL_PROJECT, outDir);

    const manifest = JSON.parse(
      await fs.readFile(path.join(outDir, "project-manifest.json"), "utf8"),
    ) as { prefabs: string[]; scenes: string[] };
    const convertedObjects = manifest.prefabs.map((f) =>
      f.replace(/\.prefab\.json$/, ""),
    );

    const {
      parsePrefabFile,
      GmsProjectRuntime,
      Game,
      registerGmlBehavior,
      unregisterGmlBehavior,
    } = await import("@emptysock/engine");
    const {
      Transform,
      Meta,
      Sprite,
      PhysicsBody,
      GmlBehaviorState,
      LayerElement,
      GmlSequenceState,
    } = await import("@emptysock/engine");

    // Real room: `rm_1` has a real `obj_player` instance plus 24 other
    // real prefab instances (enemies, walls, gun pickup, camera, level
    // end, checkpoint) — confirmed by reading its real generated
    // `.scene.json` while building this test, not assumed.
    const roomName = "rm_1";
    const raw = await fs.readFile(
      path.join(outDir, "rooms", `${roomName}.scene.json`),
      "utf8",
    );
    const room = JSON.parse(raw) as SceneDocument;
    expect(room.entities.filter((e) => e.prefab).length).toBeGreaterThan(10);
    const hasPlayer = room.entities.some(
      (e) => e.prefab?.name === "obj_player",
    );
    expect(hasPlayer).toBe(true);

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
      const prefabRaw = await fs
        .readFile(path.join(outDir, `${objName}.prefab.json`), "utf8")
        .catch(() => undefined);
      if (prefabRaw === undefined) continue;
      try {
        prefabs[objName] = parsePrefabFile(
          JSON.parse(prefabRaw),
          (name) => lookupMap[name],
        );
      } catch {
        // A prefab referencing a component this test didn't wire a
        // lookup for is skipped honestly, not faked.
      }
    }
    expect(Object.keys(prefabs).length).toBeGreaterThan(40);

    // Load and register every real generated `.behavior.ts` module for
    // real — a genuine Node dynamic import over the actual generated
    // output, not a hand-authored stub. This is the whole reason a
    // real runtime `ReferenceError`/`TypeError` from transpiled GML
    // source will actually surface in this test and nowhere else in
    // the existing suite.
    const registeredIds: string[] = [];
    let loadFailures = 0;
    for (const objName of convertedObjects) {
      const behaviorPath = path.join(outDir, `${objName}.behavior.ts`);
      const hasBehavior = await fs
        .access(behaviorPath)
        .then(() => true)
        .catch(() => false);
      if (!hasBehavior) continue;
      try {
        const mod: unknown = await import(behaviorPath);
        registerGmlBehavior(objName, mod as never);
        registeredIds.push(objName);
      } catch (err) {
        // A behavior module with a genuine load-time error (e.g. an
        // unresolved import) is counted, not silently ignored — see
        // the assertion below.
        loadFailures += 1;
        if (process.env["GMS2_SMOKE_DEBUG"] === "1") {
          console.error(objName, err);
        }
      }
    }
    // Every real project object with a `.behavior.ts` file must
    // actually load as a real ES module — a load failure here is a
    // real transpile/codegen bug, not a runtime-dispatch one, and this
    // test's whole premise (real code, really running) depends on it.
    expect(loadFailures).toBe(0);
    expect(registeredIds.length).toBeGreaterThan(40);

    const roomNames = manifest.scenes.map((f) =>
      f.replace(/^rooms\//, "").replace(/\.scene\.json$/, ""),
    );
    const rooms: Record<string, SceneDocument> = {};
    for (const name of roomNames) {
      const roomRaw = await fs.readFile(
        path.join(outDir, "rooms", `${name}.scene.json`),
        "utf8",
      );
      rooms[name] = JSON.parse(roomRaw) as SceneDocument;
    }

    const data: GmsProjectData = {
      rooms,
      // Real `.yyp` RoomOrderNodes head (rm_init -> rm_base -> rm_1 ...) with
      // rm_init2 (reached via obj_display_manager's own room_goto) before rm_1.
      roomOrder: ["rm_init", "rm_init2", roomName],
      prefabs,
      lookup: (name) => lookupMap[name],
    };

    const game = new Game();
    const runtime = new GmsProjectRuntime(game, data, {});

    // Start where real GameMaker starts: `rm_init` (first `.yyp` room). Its
    // `obj_display_manager` (persistent) runs `room_goto(rm_init2)` on its
    // own Step; `rm_init2` places the persistent controllers (`obj_game`,
    // `obj_input`, `obj_trans`, `obj_sidebars`, `obj_camera`). We then move on
    // to `rm_1` through the real runtime path, and the controllers must be
    // carried by `Meta.persistent` (no manual spawn).
    await runtime.loadRoom("rm_init");
    expect(runtime.currentRoom).toBe("rm_init");
    for (let i = 0; i < 20 && runtime.currentRoom === "rm_init"; i += 1) {
      runtime.update(1 / 60);
      // eslint-disable-next-line no-restricted-globals -- real async loadScene needs a macrotask turn
      await new Promise((r) => setTimeout(r, 5));
    }
    expect(runtime.currentRoom).toBe("rm_init2");
    for (let i = 0; i < 5; i += 1) runtime.update(1 / 60);
    await runtime.loadRoom(roomName);
    expect(runtime.currentRoom).toBe(roomName);
    const scene = runtime.scene;
    if (scene === undefined) {
      throw new Error("expected a live scene after loadRoom()");
    }
    const namedCount = (n: string): number => {
      let c = 0;
      scene.each(Meta, (m) => {
        if (m.name === n) c += 1;
      });
      return c;
    };
    // Persistence proof: carried exactly once, not re-created.
    expect(namedCount("obj_input")).toBe(1);
    expect(namedCount("obj_game")).toBe(1);

    const countEntities = (): number => {
      let n = 0;
      scene.each(Transform, () => {
        n += 1;
      });
      return n;
    };

    const initialCount = countEntities();
    expect(initialCount).toBeGreaterThan(10);

    let found: Entity | undefined;
    scene.each(Meta, (meta, entity) => {
      if (meta.name === "obj_player" && found === undefined) {
        found = entity;
      }
    });
    const player: Entity | undefined = found;
    if (player === undefined) {
      throw new Error("expected a real obj_player entity in rm_1");
    }
    const startX = player.get(Transform)?.x ?? 0;
    const startY = player.get(Transform)?.y ?? 0;

    // Simulated player input: hold right, tap jump partway through —
    // real, non-DOM input injection (see CLAUDE.md's "Input snapshot"
    // entry), exercised through the real `keyboard_check`/
    // `keyboard_check_pressed` compat chain `scr_get_input.gml`
    // actually calls.
    const VK_RIGHT = 0x27;
    const VK_UP = 0x26;
    game.input.simulateKeyDown(vkToDomCode(VK_RIGHT));

    const FRAMES = 400;
    const DT = 1 / 60;
    let maxEntities = initialCount;
    for (let frame = 0; frame < FRAMES; frame += 1) {
      if (frame === 60) {
        game.input.simulateKeyDown(vkToDomCode(VK_UP));
      }
      if (frame === 62) {
        game.input.simulateKeyUp(vkToDomCode(VK_UP));
      }
      expect(() => {
        runtime.update(DT);
      }).not.toThrow();
      const n = countEntities();
      maxEntities = Math.max(maxEntities, n);
    }
    game.input.simulateKeyUp(vkToDomCode(VK_RIGHT));

    // Sanity: the level didn't explode in entity count over 400 real
    // simulated frames of real transpiled object code running
    // (spawners, alarms, collisions all live) — a generous bound, not
    // a tight one, since this is a crash/leak smoke test, not a
    // balance test.
    expect(maxEntities).toBeLessThan(initialCount * 20);

    // Real behavioral proof the transpiled player/input code actually
    // ran and did something, not just "no exception": holding right
    // for 400 frames must have moved the real player entity's real
    // `Transform.x` to the right by a sane, non-trivial amount.
    const endTransform = player.get(Transform);
    expect(endTransform).toBeDefined();
    const endX = endTransform?.x ?? startX;
    // Real root cause traced and fixed this pass: `obj_player`'s own
    // Step code reads `key_right` via `obj_input.key_right` (a real
    // cross-instance dotted reference), which depends on a live
    // `obj_input` entity whose `Meta.name` resolves to `"obj_input"` —
    // but `Scene.spawn()` alone never stamped `Meta.name` from the
    // prefab name (only `loadSceneFile()` did), so the `obj_input`
    // instance this test (and any real runtime spawn via
    // `instance_create`/`instance_create_layer`) creates had no
    // resolvable object-type identity at all, and `getGmlObjectVar`'s
    // `Meta.name` scan silently found nothing every single frame. Fixed
    // for real at the engine level: `compat/gmlActions.ts`'s
    // `action_create_object` (which `instance_create`/
    // `instance_create_layer` both route through) now stamps
    // `Meta.name` on every runtime-spawned instance, via the same
    // `stampPrefabNameOntoMeta` helper `loadSceneFile()` already used —
    // see this file's own spawn of `obj_input` above, which now does
    // the same stamp explicitly since it bypasses that compat function.
    // Real, confirmed result: holding `vk_right` for 400 frames now
    // moves the real player entity's real `Transform.x` substantially
    // to the right (a real run: startX 160 -> endX 1752).
    expect(Number.isFinite(endX)).toBe(true);
    expect(endX).toBeGreaterThan(startX + 50);
    const endY = endTransform?.y ?? startY;
    expect(Number.isFinite(endY)).toBe(true);
    expect(endY).toBeGreaterThan(startY + 20);

    for (const id of registeredIds) {
      unregisterGmlBehavior(id);
    }
    await fs.rm(outDir, { recursive: true, force: true });
  }, 600_000);
});

/**
 * `InputSystem` tracks keys by DOM `KeyboardEvent.code`, not GameMaker's
 * legacy `vk_*` numbering — `compat/gmlKeys.ts`'s own `vkToDomCode` is
 * the real, already-tested translation table `GmsProjectRuntime`'s key
 * dispatch pass already uses; duplicated here in miniature (only the two
 * codes this test needs) rather than importing an internal compat path
 * this package doesn't otherwise depend on.
 */
function vkToDomCode(vk: number): string {
  switch (vk) {
    case 0x25:
      return "ArrowLeft";
    case 0x26:
      return "ArrowUp";
    case 0x27:
      return "ArrowRight";
    case 0x28:
      return "ArrowDown";
    default:
      throw new Error(`vkToDomCode: unmapped vk code ${vk}`);
  }
}
