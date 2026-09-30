import fs from "fs/promises";
import path from "path";
import { importGMS2Project } from "../../gms2-import.js";
import { normalizeYypResources, parseGmsJson } from "../../gms2-parse.js";
import type {
  ComponentDef,
  Entity,
  PrefabDef,
  SceneDocument,
  GmsProjectData,
} from "@emptysock/engine";

export interface RoomResult {
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

export interface ProjectWalk {
  yyp: string;
  importWarnings: string[];
  /**
   * Generated behavior/script modules that did not load (parse or
   * evaluation error). A module that does not load silently drops that
   * object's or script's whole logic, so every walk treats these as failures.
   */
  loadFailures: string[];
  skipped: number;
  importError: string | null;
  roomOrder: string[];
  results: RoomResult[];
  /** Directory holding the importer output (only kept when `keepOutDir`). */
  outDir: string;
}

export interface WalkOptions {
  frames?: number;
  keepOutDir?: boolean;
  /** Called with the constructed Game before any room loads (audio doubles, etc.). */
  onGame?: (game: unknown) => void;
  /** Called after each room's frames, with the runtime, for extra assertions. */
  afterRoom?: (room: string, runtime: unknown) => void;
}

/**
 * Imports one real GameMaker project with the full importer and loads every
 * room headless through a real `GmsProjectRuntime`, running `frames` frames
 * (default 600) in each with `vk_right` held. Shared by the a real project
 * walk and the multi-project walk so both use one code path.
 */
export async function walkProject(
  yypPath: string,
  opts: WalkOptions = {},
): Promise<ProjectWalk> {
  const FRAMES = opts.frames ?? 600;
  const scratchRoot = path.join(__dirname, "..", "..", "..", ".gms2-smoke-tmp");
  await fs.mkdir(scratchRoot, { recursive: true });
  const outDir = await fs.mkdtemp(path.join(scratchRoot, "gms2-walk-"));
  const walk: ProjectWalk = {
    yyp: yypPath,
    importWarnings: [],
    loadFailures: [],
    skipped: 0,
    importError: null,
    roomOrder: [],
    results: [],
    outDir,
  };
  try {
    const imp = await importGMS2Project(yypPath, outDir);
    walk.importWarnings = imp.warnings.map((w) => String(w));
    walk.skipped = imp.skipped.length;
  } catch (err) {
    walk.importError = err instanceof Error ? err.message : String(err);
    return walk;
  }

  const yyp = parseGmsJson(await fs.readFile(yypPath, "utf8")) as {
    RoomOrderNodes?: { roomId?: { name?: string } }[];
    resources?: unknown[];
  };
  walk.roomOrder = (yyp.RoomOrderNodes ?? [])
    .map((n) => n.roomId?.name)
    .filter((n): n is string => typeof n === "string");

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
    if (!(await fileExists(p))) continue;
    try {
      const mod: unknown = await import(p);
      registerGmlBehavior(objName, mod as never);
      registeredIds.push(objName);
    } catch (err) {
      walk.loadFailures.push(`behavior ${objName}: ${firstLine(err)}`);
    }
  }
  // Scripts are imported by the behaviors that call them, but a script no
  // behavior calls would otherwise never be loaded at all.
  const scripts = normalizeYypResources(yyp.resources ?? [])
    .filter((r) => r.id.path.startsWith("scripts/"))
    .map((r) => r.id.name);
  for (const script of scripts) {
    const p = path.join(outDir, `${script}.ts`);
    if (!(await fileExists(p))) continue;
    try {
      await import(p);
    } catch (err) {
      walk.loadFailures.push(`script ${script}: ${firstLine(err)}`);
    }
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
  if (walk.roomOrder.length === 0) walk.roomOrder = Object.keys(rooms);
  walk.roomOrder = walk.roomOrder.filter((r) => rooms[r] !== undefined);

  const data: GmsProjectData = {
    rooms,
    roomOrder: walk.roomOrder,
    prefabs,
    lookup: (name) => lookupMap[name],
  };
  const game = new Game();
  opts.onGame?.(game);
  const includedDir = path.join(outDir, "included");
  for (const f of await fs.readdir(includedDir).catch(() => [] as string[])) {
    game.files.preload(
      f,
      await fs.readFile(path.join(includedDir, f), "utf8").catch(() => ""),
    );
  }
  const runtime = new GmsProjectRuntime(game, data, {});

  const caught: string[] = [];
  const origError = console.error;
  const origWarn = console.warn;
  console.error = (...args: unknown[]): void => {
    const msg = args.map((a) => String(a)).join(" ");
    if (msg.startsWith("GmlBehaviorSystem:")) caught.push(msg);
    else origError(...args);
  };
  console.warn = (): void => {};

  const VK_RIGHT = "ArrowRight";
  const DT = 1 / 60;
  try {
    for (const roomName of walk.roomOrder) {
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
      walk.results.push(result);
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
        opts.afterRoom?.(roomName, runtime);
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
    console.warn = origWarn;
    for (const id of registeredIds) unregisterGmlBehavior(id);
    if (!opts.keepOutDir) await fs.rm(outDir, { recursive: true, force: true });
  }
  return walk;
}

function fileExists(p: string): Promise<boolean> {
  return fs
    .access(p)
    .then(() => true)
    .catch(() => false);
}

/** One-line summary of a load error (transform errors are multi-line, coloured). */
function firstLine(err: unknown): string {
  const msg = (err instanceof Error ? err.message : String(err)).replace(
    /\u001b\[[0-9;]*m/g,
    "",
  );
  const lines = msg
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l !== "");
  const diag = lines.find((l) => /ERROR|\[[A-Z_]+\]/.test(l));
  const where = lines.find((l) => /\.ts:\d+:\d+/.test(l));
  const loc = where ? /([^/\s]+\.ts:\d+:\d+)/.exec(where)?.[1] : undefined;
  return [diag ?? lines[0] ?? "", loc]
    .filter(Boolean)
    .join(" @ ")
    .slice(0, 300);
}

/** Per-project failure counts the walks compare against the committed baseline. */
export function walkCounts(w: ProjectWalk): {
  loadFailures: number;
  handlerErrors: number;
  thrown: number;
} {
  return {
    loadFailures: w.loadFailures.length,
    handlerErrors: w.results.reduce(
      (n, r) => n + Object.keys(r.handlerErrors).length,
      0,
    ),
    thrown: w.results.filter((r) => r.thrown !== null).length,
  };
}

/** One-line-per-room text table for a project walk. */
export function formatWalk(w: ProjectWalk): string {
  const lines = w.loadFailures.map((f) => `  load failure: ${f}`);
  lines.push(
    ...w.results.map((r) => {
      const errs = Object.keys(r.handlerErrors).length;
      return `${r.room.padEnd(14)} loaded=${r.loaded} frames=${r.frames} entities=${r.entitiesStart}->${r.entitiesMax} playerDx=${r.playerMoved === null ? "n/a" : Math.round(r.playerMoved)} changes=[${r.roomChangedTo.join(",")}] handlerErrors=${errs} thrown=${r.thrown === null ? "no" : "YES"}`;
    }),
  );
  for (const r of w.results)
    for (const [k, n] of Object.entries(r.handlerErrors))
      lines.push(`  ${r.room}: ${k} (x${n})`);
  return lines.join("\n");
}
