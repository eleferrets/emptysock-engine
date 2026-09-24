import { defineScene } from "./Game.js";
import type { Game, SceneDefinition } from "./Game.js";
import type { Scene } from "./Scene.js";
import type { Entity } from "./Entity.js";
import type { PrefabDef } from "./Prefab.js";
import {
  loadSceneFile,
  type ComponentLookup,
  type SceneFile,
} from "./SceneFile.js";
import { GmlBehaviorSystem } from "./systems/GmlBehaviorSystem.js";
import { TimelineSystem } from "./systems/TimelineSystem.js";
import { GmlSequenceSystem } from "./systems/GmlSequenceSystem.js";
import { gmlActionsStep } from "./compat/gmlActions.js";
import type { GmlActionContext } from "./compat/gmlActions.js";
import type { GmlCameraContext } from "./compat/gmlCamera.js";
import type { GmlParticleContext } from "./compat/gmlParticles.js";
import type { CameraSystem } from "./systems/CameraSystem.js";
import type { RenderPipeline } from "./systems/RenderPipeline.js";
import { GmlBehaviorState } from "./components/GmlBehavior.js";

/**
 * A parsed `project-manifest.json` (`gms2-codegen.ts`'s `projectManifestJSON()`)
 * — this class never reads it from disk itself (the engine-environment-
 * boundary rule: no fs/DOM import), so the caller loads and `JSON.parse()`s
 * it (Node `fs`, a Tauri fs call, a browser `fetch`, whatever the host is)
 * and hands the parsed object in.
 */
export interface GmsProjectManifest {
  readonly prefabs: readonly string[];
  readonly behaviors: readonly string[];
  readonly scenes: readonly string[];
}

/**
 * Everything `GmsProjectRuntime` needs already parsed and in memory — the
 * same "engine takes already-loaded JSON, never reads files itself" shape
 * `loadSceneFile`/`parsePrefabFile` already establish (`SceneFile.ts`).
 * Building this from a real GMS2-import output directory (reading every
 * `.prefab.json`/`.scene.json`, parsing them with `parsePrefabFile`,
 * importing/registering every `.behavior.ts` module) is genuinely
 * toolchain/host-specific — a Node build imports `.behavior.ts` modules
 * directly, a browser bundle would need them pre-bundled — so it is left to
 * the caller, not fabricated here. See this file's own header comment for
 * the honest scope of what is and is not wired.
 */
export interface GmsProjectData {
  /** GameMaker room name -> that room's already-parsed `.scene.json`. */
  readonly rooms: Readonly<Record<string, SceneFile>>;
  /** Room order (from `manifest.scenes`, in file order) — what `nextRoom()` advances through. */
  readonly roomOrder: readonly string[];
  /** GameMaker object name -> that object's already-parsed `PrefabDef` (via `parsePrefabFile`). */
  readonly prefabs: Readonly<Record<string, PrefabDef>>;
  /** Resolves a `.prefab.json`/`.scene.json`'s component-name strings to registered `ComponentDef`s — the same `ComponentLookup` `loadSceneFile` already takes. */
  readonly lookup: ComponentLookup;
  /** Optional GameMaker sound name -> playable `AudioSystem` id map, forwarded straight into `GmlActionContext.sounds`. */
  readonly sounds?: Readonly<Record<string, string>>;
}

/** Optional live systems `GmsProjectRuntime` wires into its merged `GmlActionContext` when given — each is a real "engine defines the interface, whoever has a live instance wires it in" dependency, never constructed here. */
export interface GmsProjectRuntimeOptions {
  /** A camera to expose through `ctx.camera` for `gmlCamera.ts`'s `camera_*` compat functions. Optional — a project that never calls those doesn't need one. */
  readonly camera?: CameraSystem;
  /** A mounted `RenderPipeline` to expose through `ctx.particles` for `gmlParticles.ts`'s `part_*` compat functions, and to wire Draw/Draw GUI dispatch through (`RenderPipeline.attachGmlBehaviors`). Omit for headless operation — see this class's own doc comment. */
  readonly renderer?: RenderPipeline;
}

/**
 * The full merged context every `compat/gmlActions.ts`/`gmlCamera.ts`/
 * `gmlParticles.ts` function actually receives from this runtime.
 * `GmlActionContext`, `GmlCameraContext` and `GmlParticleContext` are three
 * separate structural supersets of the same base shape (see each file's own
 * doc comment) — a single object satisfying every optional field on all
 * three satisfies all of them simultaneously, no adapter needed.
 */
export type GmsRuntimeContext = GmlActionContext &
  GmlCameraContext &
  GmlParticleContext;

/**
 * Real per-frame orchestration for a GMS2-imported project — the gap
 * CLAUDE.md's "GMS2 import emits prefab/scene JSON..." and "GML behavior
 * dispatch" entries both flag as still-open follow-up work: `GmlBehaviorSystem`/
 * `TimelineSystem`/`GmlSequenceSystem`/`gmlActionsStep`/`PhysicsSystem`'s GML
 * dispatch, and `RenderPipeline`'s Draw/Draw GUI passes, all exist as real,
 * callable pieces on this branch, but nothing before this file called all of
 * them together, in the right order, against a live `Game`.
 *
 * Owns one `Game` (constructed by the caller — the same "engine owns what it
 * creates, but a `Game` is the caller's to construct" split every other
 * engine entry point uses) and drives room loading through `Game.loadScene()`
 * so physics/actors/coroutines keep working exactly as documented elsewhere
 * in this file — this class adds a `SceneDefinition.onUpdate` hook that runs
 * the GML-specific passes `Game.update()` itself has no concept of, it does
 * not reimplement or bypass `Game`'s own per-frame order.
 *
 * `update(dt)` is a thin forward to `game.update(dt)` — everything GML-
 * specific happens inside the current room's `onUpdate` hook this class
 * installs in `loadRoom()`, in this fixed order, once per frame:
 *
 *   1. `GmlBehaviorSystem.update()` — the three Step passes plus Collision.
 *   2. `gmlActionsStep()` for every `GmlBehaviorState` entity — applies any
 *      `action_move`/`action_set_alarm` motion/alarm state that entity's
 *      transpiled GML wrote this frame or an earlier one.
 *   3. `TimelineSystem.update()`.
 *   4. `GmlSequenceSystem.update()`.
 *
 * `Game.update()` itself (called by `update(dt)` after the above) still
 * separately steps physics/actors/coroutines and — if a renderer was
 * attached via the constructor's `options.renderer` — the frame's render
 * pass, which includes `RenderPipeline`'s own Draw/Draw GUI dispatch (see
 * `attachGmlBehaviors()`, wired once at construction, not per room).
 *
 * Honest gaps, stated plainly rather than glossed over:
 *
 * - No transpiler support for `timeline_index = tlFoo;`/`sequence_index =
 *   sqFoo;` assignment syntax exists yet, and GameMaker objects do not
 *   declare a timeline/sequence on the object resource itself (confirmed
 *   against real `.yy` object files — timelines/sequences are only ever
 *   invoked imperatively from GML), so `buildObjectPrefabJSON()` was
 *   deliberately *not* changed to emit a fabricated static prefab-level
 *   `TimelineState`/`GmlSequenceState` link — there is no such link in real
 *   GameMaker projects to codegen from. What a transpiled `timeline_index =
 *   tlFoo;` assignment needs to become is a call to `entity.add(TimelineState,
 *   { timelineId: "tlFoo", running: true })` (or `.get()` + field writes if
 *   the component is already present) — real, callable, exercised by this
 *   file's own tests — but nothing in `gms2-transpile.ts` rewrites that
 *   assignment shape into a call yet. That rewrite is a real, separate,
 *   not-yet-started follow-up.
 * - Loading a real GMS2-import output directory's `.behavior.ts` modules
 *   (registering each with `registerGmlBehavior`) is intentionally left to
 *   the caller, not this class — see `GmsProjectData`'s own doc comment.
 */
export class GmsProjectRuntime {
  private readonly _behaviors = new GmlBehaviorSystem();
  private readonly _timelines = new TimelineSystem();
  private readonly _sequences = new GmlSequenceSystem();
  private _currentRoom: string | undefined;

  constructor(
    private readonly game: Game,
    private readonly data: GmsProjectData,
    private readonly options: GmsProjectRuntimeOptions = {},
  ) {}

  /** The GameMaker room name currently loaded, or `undefined` before the first `loadRoom()`. */
  get currentRoom(): string | undefined {
    return this._currentRoom;
  }

  /** The live `Scene` `loadRoom()` most recently spawned, or `undefined` before the first call. */
  get scene(): Scene | undefined {
    return this.game.currentScene ?? undefined;
  }

  /**
   * Builds the one merged `GmsRuntimeContext` every compat function and
   * every `GmlBehaviorSystem`/`TimelineSystem` dispatch call this frame
   * actually receives. Rebuilt fresh each call (rather than cached) so
   * `ctx.scene`/`ctx.currentRoom` always reflect whichever room is loaded
   * *right now* — a stale cached `ctx` from before a `loadRoom()` call would
   * silently point transpiled GML at the previous room's entities.
   *
   * `ctx.rooms` maps every GameMaker room name to a real `SceneDefinition`
   * built by `buildSceneDefinition()` — the exact same definition
   * `loadRoom()` itself loads — so a transpiled `action_next_room`/
   * `action_another_room` call (which goes through `ctx.game.loadScene(def)`
   * directly, bypassing this class's own `loadRoom()` method) still spawns
   * entities, dispatches `onCreate`, and installs the per-frame GML passes
   * exactly as if `loadRoom()` had been called — `buildSceneDefinition`'s own
   * `onLoad` updates `this._currentRoom`, so `currentRoom`/`scene` stay
   * accurate even when a room change is driven from inside GML rather than
   * from this class's own API.
   */
  private buildContext(): GmsRuntimeContext {
    const rooms: Record<string, SceneDefinition> = {};
    for (const name of this.data.roomOrder) {
      rooms[name] = this.buildSceneDefinition(name);
    }
    return {
      scene: this.scene as Scene,
      game: this.game,
      rooms,
      roomOrder: this.data.roomOrder,
      prefabs: this.data.prefabs,
      ...(this._currentRoom !== undefined
        ? { currentRoom: this._currentRoom }
        : {}),
      ...(this.data.sounds !== undefined ? { sounds: this.data.sounds } : {}),
      ...(this.options.camera !== undefined
        ? { camera: this.options.camera }
        : {}),
      ...(this.options.renderer !== undefined
        ? { particles: this.options.renderer }
        : {}),
    };
  }

  /** `data.prefabs` as a `Map`, for `loadSceneFile()`'s `prefabsByName` parameter — rebuilt each call rather than cached since `GmsProjectData` is caller-owned and could change between rooms. */
  private prefabsByName(): ReadonlyMap<string, PrefabDef> {
    return new Map(Object.entries(this.data.prefabs));
  }

  /**
   * Builds the `SceneDefinition` for GameMaker room `name`: `onLoad` spawns
   * every declared entity via `loadSceneFile()` and dispatches `onCreate` on
   * each spawned entity that carries `GmlBehaviorState` (the real
   * integration point CLAUDE.md's "real limits of this pass" paragraph
   * names), and `onUpdate` installs this class's own per-frame GML passes
   * (see the class doc comment's numbered list). Shared by `loadRoom()` and
   * by every entry `buildContext()` puts in `ctx.rooms`, so a room change
   * triggered from either path behaves identically.
   */
  private buildSceneDefinition(name: string): SceneDefinition {
    const file = this.data.rooms[name];
    if (file === undefined) {
      throw new Error(
        `GmsProjectRuntime: unknown room "${name}" — not present in the supplied GmsProjectData.rooms.`,
      );
    }
    return defineScene({
      onLoad: (scene) => {
        this._currentRoom = name;
        loadSceneFile(scene, file, this.data.lookup, this.prefabsByName(), {
          onSpawned: (entity) => {
            if (entity.get(GmlBehaviorState) !== undefined) {
              this._behaviors.dispatchCreate(entity, this.buildContext());
            }
          },
        });
      },
      onUpdate: (dt) => {
        this.runGmlPasses(dt);
      },
    });
  }

  /**
   * Loads a room by GameMaker name: unloads whatever room/scene is
   * currently loaded (via `Game.loadScene()`'s own unconditional teardown)
   * and loads the `SceneDefinition` `buildSceneDefinition()` builds for it
   * — see that method's doc comment for exactly what it wires.
   */
  async loadRoom(name: string): Promise<void> {
    const definition = this.buildSceneDefinition(name);
    await this.game.loadScene(definition, { physics: {} });

    if (this.options.renderer !== undefined) {
      this.options.renderer.attachGmlBehaviors(
        this._behaviors,
        this.buildContext(),
      );
    }
  }

  /** Advances to `data.roomOrder`'s entry after `currentRoom` (GM8.1's `action_next_room`'s own "current index + 1" semantics — the same rule `compat/gmlActions.ts`'s `action_next_room` uses when it's driven through `ctx.game.loadScene` instead of this class). No-ops (stays on the current room) when already on the last room. */
  async nextRoom(): Promise<void> {
    const order = this.data.roomOrder;
    const index =
      this._currentRoom === undefined ? -1 : order.indexOf(this._currentRoom);
    const next = order[index + 1];
    if (next === undefined) return;
    await this.loadRoom(next);
  }

  private runGmlPasses(dt: number): void {
    const scene = this.scene;
    if (scene === undefined) return;
    const ctx = this.buildContext();

    this._behaviors.update(scene, dt, ctx);

    scene.each(GmlBehaviorState, (_state, entity) => {
      gmlActionsStep(entity);
    });

    this._timelines.update(scene, ctx);

    // GmlSequenceState is a distinct opt-in component from GmlBehaviorState
    // (an entity can play a Sequence with no GML behavior module at all —
    // real GameMaker Sequences are commonly attached to plain sprite
    // instances), so this pass runs over every GmlSequenceState entity, not
    // just the ones gmlActionsStep/timelines just touched.
    this._sequences.update(scene, dt);
  }

  /**
   * The sanctioned way to destroy a `GmlBehaviorState`-carrying entity —
   * dispatches `onDestroy` (if the module exports one) before the real
   * `scene.destroy(entity)`, per CLAUDE.md's "GML behavior dispatch"
   * documented integration point (`GmlBehaviorSystem.destroy()`'s own doc
   * comment: `Scene.destroy()` itself has no `GmlActionContext` to dispatch
   * one with).
   */
  destroyEntity(entity: Entity): void {
    const scene = this.scene;
    if (scene === undefined) return;
    this._behaviors.destroy(scene, entity, this.buildContext());
  }

  /**
   * `game.update(dt)` — physics/actors/coroutines/render (this class's own
   * GML-specific passes run from the `onUpdate` hook `loadRoom()` installs,
   * called as part of this same `game.update()` call, in the order
   * documented on the class). Safe with zero renderer attached: `Game`'s
   * own headless support (no `attachRenderer()` call, or a scene loaded
   * with `headless: true`) already makes step 7 a no-op — this class does
   * nothing renderer-specific on its own.
   */
  update(dt: number): void {
    this.game.update(dt);
  }
}
