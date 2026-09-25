import { describe, it, expect, beforeEach, afterEach } from "vitest";

const { Game } = await import("../Game.js");
const { GmsProjectRuntime } = await import("../GmsRuntime.js");
const { Transform } = await import("../components/Transform.js");
const { Meta } = await import("../components/Meta.js");
const { GmlBehaviorState, registerGmlBehavior, unregisterGmlBehavior } =
  await import("../components/GmlBehavior.js");
const { definePrefab } = await import("../Prefab.js");
import type { GmlBehaviorModule } from "../components/GmlBehavior.js";
import type { ComponentDef } from "../Component.js";
import type { Entity } from "../Entity.js";
import type { PrefabDef } from "../Prefab.js";
import type { SceneFile } from "../SceneFile.js";
import type { GmsProjectData } from "../GmsRuntime.js";

/**
 * Synthetic, hand-authored GMS2-shaped fixture — two "objects"
 * (`objPlayer`/`objWall`), no real files on disk, no real project touched
 * (per this task's synthetic-fixtures-only scope). `objPlayer` gets a real
 * `onCreate` (writes an observable `Meta.tags` entry) and a real
 * `Collision_objWall` handler (`onCollideWithobjWall`, mirroring
 * `gms2-codegen.ts`'s real naming convention); `objWall` is a plain
 * collision target with no behavior module of its own — a real, valid GMS2
 * shape (CLAUDE.md's GmlCollision entry: a target needs no `GmlBehaviorState`).
 */
function buildFixture(): GmsProjectData {
  const lookup: Record<string, ComponentDef> = {
    Transform,
    Meta,
    GmlBehaviorState,
  };

  const playerPrefab: PrefabDef = definePrefab("objPlayer", [
    { def: Transform },
    { def: Meta },
    { def: GmlBehaviorState, overrides: { behaviorId: "objPlayer" } },
  ]);
  const wallPrefab: PrefabDef = definePrefab("objWall", [
    { def: Transform },
    { def: Meta },
  ]);

  const room0: SceneFile = {
    sceneName: "room0",
    prefabInstances: [
      { prefab: "objPlayer", props: { x: 0, y: 0 } },
      { prefab: "objWall", props: { x: 4, y: 0 } }, // overlaps the player's default AABB
    ],
  };
  const room1: SceneFile = {
    sceneName: "room1",
    prefabInstances: [{ prefab: "objWall", props: { x: 100, y: 100 } }],
  };

  return {
    rooms: { room0, room1 },
    roomOrder: ["room0", "room1"],
    prefabs: { objPlayer: playerPrefab, objWall: wallPrefab },
    lookup: (name) => lookup[name],
  };
}

describe("GmsProjectRuntime", () => {
  let game: InstanceType<typeof Game>;
  let createRan: boolean;
  let collisionRan: boolean;

  beforeEach(() => {
    createRan = false;
    collisionRan = false;

    const module: GmlBehaviorModule & Record<string, unknown> = {
      onCreate: (entity) => {
        createRan = true;
        const meta = entity.get(Meta);
        if (meta !== undefined) meta.tags = [...meta.tags, "created"];
      },
      onDestroy: (entity) => {
        const meta = entity.get(Meta);
        if (meta !== undefined) meta.tags = [...meta.tags, "destroyed"];
      },
    };
    module["onCollideWithobjWall"] = ((entity: Entity) => {
      collisionRan = true;
      const meta = entity.get(Meta);
      if (meta !== undefined) meta.tags = [...meta.tags, "collided"];
    }) satisfies GmlBehaviorModule["onCreate"];
    registerGmlBehavior("objPlayer", module);

    game = new Game();
  });

  afterEach(() => {
    unregisterGmlBehavior("objPlayer");
  });

  it("loads a room, spawns every entity, dispatches onCreate, and fires the Collision handler across 60+ update()s with zero exceptions", async () => {
    const runtime = new GmsProjectRuntime(game, buildFixture());

    await expect(runtime.loadRoom("room0")).resolves.toBeUndefined();

    const scene = runtime.scene;
    expect(scene).toBeDefined();

    let spawnedCount = 0;
    scene?.each(Transform, () => {
      spawnedCount += 1;
    });
    expect(spawnedCount).toBe(2);

    expect(createRan).toBe(true);

    for (let i = 0; i < 65; i++) {
      expect(() => runtime.update(1 / 60)).not.toThrow();
    }

    expect(collisionRan).toBe(true);

    let foundTags: string[] = [];
    scene?.each(Meta, (meta, entity) => {
      if (entity.get(GmlBehaviorState) !== undefined) {
        foundTags = meta.tags;
      }
    });
    expect(foundTags).toContain("created");
    expect(foundTags).toContain("collided");
  });

  it("destroyEntity dispatches onDestroy before removing the entity", async () => {
    const runtime = new GmsProjectRuntime(game, buildFixture());
    await runtime.loadRoom("room0");

    const scene = runtime.scene;
    let target: Entity | undefined;
    scene?.each(GmlBehaviorState, (_state, entity) => {
      target = entity;
    });
    expect(target).toBeDefined();
    if (target === undefined) return;

    let onDestroyRan = false;
    unregisterGmlBehavior("objPlayer");
    registerGmlBehavior("objPlayer", {
      onDestroy: () => {
        onDestroyRan = true;
      },
    } satisfies GmlBehaviorModule);

    runtime.destroyEntity(target);

    expect(onDestroyRan).toBe(true);
    // A destroyed entity no longer appears in a subsequent query.
    let remaining = 0;
    scene?.each(GmlBehaviorState, () => {
      remaining += 1;
    });
    expect(remaining).toBe(0);
  });

  it("runs headless (no renderer attached) without throwing", async () => {
    const runtime = new GmsProjectRuntime(game, buildFixture());
    await runtime.loadRoom("room0");
    for (let i = 0; i < 10; i++) {
      expect(() => runtime.update(1 / 60)).not.toThrow();
    }
  });

  it("loadRoom() swaps to a second room's entities correctly", async () => {
    const runtime = new GmsProjectRuntime(game, buildFixture());
    await runtime.loadRoom("room0");
    expect(runtime.currentRoom).toBe("room0");

    let room0Count = 0;
    runtime.scene?.each(Transform, () => {
      room0Count += 1;
    });
    expect(room0Count).toBe(2);

    await runtime.loadRoom("room1");
    expect(runtime.currentRoom).toBe("room1");

    let room1Count = 0;
    runtime.scene?.each(Transform, () => {
      room1Count += 1;
    });
    expect(room1Count).toBe(1);
  });

  it("nextRoom() advances through roomOrder", async () => {
    const runtime = new GmsProjectRuntime(game, buildFixture());
    await runtime.loadRoom("room0");
    await runtime.nextRoom();
    expect(runtime.currentRoom).toBe("room1");
    // already last room — stays put
    await runtime.nextRoom();
    expect(runtime.currentRoom).toBe("room1");
  });
});

describe("GmsProjectRuntime — real room camera/view wiring", () => {
  it("configures the camera registry from SceneFile.views on loadRoom(), and follows the target entity across update()s", async () => {
    const { camera_get_view_x, camera_get_view_y, view_get_enabled } =
      await import("../compat/gmlCamera.js");

    const lookup: Record<string, ComponentDef> = { Transform, Meta };
    const playerPrefab: PrefabDef = definePrefab("objPlayer", [
      { def: Transform },
      { def: Meta, overrides: { name: "objPlayer" } },
    ]);

    const room0: SceneFile = {
      sceneName: "room0",
      prefabInstances: [{ prefab: "objPlayer", props: { x: 700, y: 20 } }],
      viewsEnabled: true,
      views: [
        {
          visible: true,
          worldX: 0,
          worldY: 0,
          worldWidth: 640,
          worldHeight: 480,
          screenX: 0,
          screenY: 0,
          screenWidth: 640,
          screenHeight: 480,
          borderX: 32,
          borderY: 32,
          speedX: -1,
          speedY: -1,
          followObject: "objPlayer",
        },
      ],
    };

    const data: GmsProjectData = {
      rooms: { room0 },
      roomOrder: ["room0"],
      prefabs: { objPlayer: playerPrefab },
      lookup: (name) => lookup[name],
    };

    const g = new Game();
    const runtime = new GmsProjectRuntime(g, data);
    await runtime.loadRoom("room0");

    // The room's real viewsEnabled/views data must already be live on the
    // camera registry immediately after loadRoom() — before any update().
    const scene = runtime.scene;
    expect(scene).toBeDefined();
    if (scene === undefined) throw new Error("expected a live scene");
    expect(view_get_enabled({ scene })).toBe(true);

    // update() runs stepAllGmlCameraFollows() every frame — the camera
    // should snap toward the player (target is outside the border) with no
    // renderer attached (headless, honest zero-render-cost path).
    runtime.update(1 / 60);
    const ctx = { scene };
    expect(camera_get_view_x(ctx, 0)).not.toBe(0);
    expect(camera_get_view_y(ctx, 0)).not.toBe(0);
  });

  it("a room with no views data leaves the camera registry disabled and does not throw across update()s", async () => {
    const runtime = new GmsProjectRuntime(new Game(), buildFixture());
    await runtime.loadRoom("room0");
    for (let i = 0; i < 5; i++) {
      expect(() => runtime.update(1 / 60)).not.toThrow();
    }
  });
});

describe("GmsProjectRuntime — timeline_index wiring (real onCreate dispatch)", () => {
  // Proves the *exact* code shape `gms2-transpile.ts` emits for a
  // `timeline_index = tmJiggle;` assignment (see
  // `packages/toolchain/src/__tests__/gms2-timeline-codegen.test.ts` for the
  // companion proof that a real object's Create event actually produces
  // this text) genuinely attaches/re-targets/removes a live `TimelineState`
  // when run as a real `onCreate` handler through `GmsProjectRuntime`, end
  // to end — not just that the regex rewrite looks right in isolation.
  let game: InstanceType<typeof Game>;

  beforeEach(() => {
    game = new Game();
  });

  afterEach(() => {
    unregisterGmlBehavior("objJiggler");
  });

  it("attaches TimelineState on create, re-targets on a second assignment, and removes it on timeline_index = -1", async () => {
    // The literal text `gms2-transpile.ts`'s timeline_index rewrite pass
    // produces for `timeline_index = tmJiggle;` — executed for real via
    // `new Function`, exactly like the generated `.behavior.ts`'s compiled
    // JS would run it, with `_entity`/`GmlActions` bound the same way a
    // real generated onCreate/onUpdate function receives them.
    const attachCall =
      '(() => { const _tl = _entity.get(GmlActions.TimelineState); if (_tl) { _tl.timelineId = "tmJiggle"; _tl.position = 0; _tl.running = true; } else { _entity.add(GmlActions.TimelineState, { timelineId: "tmJiggle", position: 0, running: true }); } })();';
    const retargetCall =
      '(() => { const _tl = _entity.get(GmlActions.TimelineState); if (_tl) { _tl.timelineId = "tmOther"; _tl.position = 0; _tl.running = true; } else { _entity.add(GmlActions.TimelineState, { timelineId: "tmOther", position: 0, running: true }); } })();';
    const removeCall = "_entity.remove(GmlActions.TimelineState);";

    const EmptySockEngine = await import("../index.js");

    const attachFn = new Function("_entity", "GmlActions", attachCall) as (
      entity: Entity,
      actions: typeof EmptySockEngine,
    ) => void;
    const retargetFn = new Function("_entity", "GmlActions", retargetCall) as (
      entity: Entity,
      actions: typeof EmptySockEngine,
    ) => void;
    const removeFn = new Function("_entity", "GmlActions", removeCall) as (
      entity: Entity,
      actions: typeof EmptySockEngine,
    ) => void;

    const module: GmlBehaviorModule = {
      onCreate: (entity) => attachFn(entity, EmptySockEngine),
    };
    registerGmlBehavior("objJiggler", module);

    const lookup: Record<string, ComponentDef> = {
      Transform,
      Meta,
      GmlBehaviorState,
    };
    const jigglerPrefab: PrefabDef = definePrefab("objJiggler", [
      { def: Transform },
      { def: GmlBehaviorState, overrides: { behaviorId: "objJiggler" } },
    ]);
    const room0: SceneFile = {
      sceneName: "room0",
      prefabInstances: [{ prefab: "objJiggler", props: {} }],
    };
    const data: GmsProjectData = {
      rooms: { room0 },
      roomOrder: ["room0"],
      prefabs: { objJiggler: jigglerPrefab },
      lookup: (name) => lookup[name],
    };

    const runtime = new GmsProjectRuntime(game, data);
    await runtime.loadRoom("room0");

    let entity: Entity | undefined;
    runtime.scene?.each(GmlBehaviorState, (_state, e) => {
      entity = e;
    });
    expect(entity).toBeDefined();
    if (entity === undefined) return;

    // onCreate already ran during loadRoom() — the attach already happened.
    const TimelineState = (
      EmptySockEngine as unknown as {
        TimelineState: ComponentDef<{
          timelineId: string;
          position: number;
          speed: number;
          running: boolean;
          loop: boolean;
        }>;
      }
    ).TimelineState;
    expect(entity.has(TimelineState)).toBe(true);
    expect(entity.get(TimelineState)?.timelineId).toBe("tmJiggle");
    expect(entity.get(TimelineState)?.running).toBe(true);

    // Re-targeting writes fields in place rather than calling
    // `Entity.add()` a second time (which throws — "one shot" semantics).
    expect(() => retargetFn(entity as Entity, EmptySockEngine)).not.toThrow();
    expect(entity.get(TimelineState)?.timelineId).toBe("tmOther");
    expect(entity.has(TimelineState)).toBe(true);

    // timeline_index = -1 removes the component entirely — GameMaker's own
    // "no timeline assigned" sentinel.
    removeFn(entity, EmptySockEngine);
    expect(entity.has(TimelineState)).toBe(false);
  });
});

describe("GmsProjectRuntime — alarm dispatch (real onAlarm<N> wiring)", () => {
  // Proves gmlActionsStep()'s onAlarm callback, wired by runGmlPasses() to
  // GmlBehaviorSystem.dispatchAlarm(), actually fires a generated
  // onAlarm<index> export once the alarm's countdown reaches zero — not
  // just that action_set_alarm's countdown ticks (that part already
  // worked; the dispatch on top of it did not, until this pass).
  let game: InstanceType<typeof Game>;

  function buildAlarmFixture(): GmsProjectData {
    const lookup: Record<string, ComponentDef> = {
      Transform,
      Meta,
      GmlBehaviorState,
    };
    const prefab: PrefabDef = definePrefab("objAlarmed", [
      { def: Transform },
      { def: Meta },
      { def: GmlBehaviorState, overrides: { behaviorId: "objAlarmed" } },
    ]);
    const room0: SceneFile = {
      sceneName: "room0",
      prefabInstances: [{ prefab: "objAlarmed", props: { x: 0, y: 0 } }],
    };
    return {
      rooms: { room0 },
      roomOrder: ["room0"],
      prefabs: { objAlarmed: prefab },
      lookup: (name) => lookup[name],
    };
  }

  beforeEach(() => {
    game = new Game();
  });

  afterEach(() => {
    unregisterGmlBehavior("objAlarmed");
  });

  it("dispatches onAlarm0 once the armed alarm reaches zero, with the correct entity/ctx", async () => {
    const { action_set_alarm } = await import("../compat/gmlActions.js");
    let alarm0Fired = 0;
    let firedEntity: Entity | undefined;
    const module: GmlBehaviorModule & Record<string, unknown> = {
      onCreate: (entity, ctx) => {
        action_set_alarm(entity, ctx, 0, 3); // fires 3 steps from now
      },
    };
    module["onAlarm0"] = ((entity: Entity) => {
      alarm0Fired += 1;
      firedEntity = entity;
    }) satisfies GmlBehaviorModule["onCreate"];
    registerGmlBehavior("objAlarmed", module);

    const runtime = new GmsProjectRuntime(game, buildAlarmFixture());
    await runtime.loadRoom("room0");

    let entity: Entity | undefined;
    runtime.scene?.each(GmlBehaviorState, (_state, e) => {
      entity = e;
    });
    expect(entity).toBeDefined();

    // Not fired yet — the countdown needs a few Step passes first.
    expect(alarm0Fired).toBe(0);

    for (let i = 0; i < 5; i++) {
      runtime.update(1 / 60);
    }

    expect(alarm0Fired).toBe(1); // one-shot, matching GameMaker
    expect(firedEntity?.eid).toBe(entity?.eid);

    // Ticking further does not re-fire it — GameMaker alarms are one-shot
    // unless explicitly re-armed.
    for (let i = 0; i < 10; i++) {
      runtime.update(1 / 60);
    }
    expect(alarm0Fired).toBe(1);
  });

  it("a throwing onAlarm handler does not abort dispatch for other entities/alarms in the same frame", async () => {
    const { action_set_alarm } = await import("../compat/gmlActions.js");
    let otherAlarmFired = false;

    const module: GmlBehaviorModule & Record<string, unknown> = {
      onCreate: (entity, ctx) => {
        action_set_alarm(entity, ctx, 0, 1);
        action_set_alarm(entity, ctx, 1, 1);
      },
    };
    module["onAlarm0"] = (() => {
      throw new Error("boom — synthetic onAlarm0 failure");
    }) satisfies GmlBehaviorModule["onCreate"];
    module["onAlarm1"] = (() => {
      otherAlarmFired = true;
    }) satisfies GmlBehaviorModule["onCreate"];
    registerGmlBehavior("objAlarmed", module);

    const runtime = new GmsProjectRuntime(game, buildAlarmFixture());
    await runtime.loadRoom("room0");

    expect(() => {
      for (let i = 0; i < 3; i++) runtime.update(1 / 60);
    }).not.toThrow();

    // alarm 1's handler still ran even though alarm 0's threw.
    expect(otherAlarmFired).toBe(true);
  });

  it("an alarm index with no matching handler on the module is a safe no-op", async () => {
    const { action_set_alarm } = await import("../compat/gmlActions.js");
    registerGmlBehavior("objAlarmed", {
      onCreate: (entity, ctx) => {
        action_set_alarm(entity, ctx, 5, 1); // no onAlarm5 export below
      },
    } satisfies GmlBehaviorModule);

    const runtime = new GmsProjectRuntime(game, buildAlarmFixture());
    await runtime.loadRoom("room0");

    expect(() => {
      for (let i = 0; i < 5; i++) runtime.update(1 / 60);
    }).not.toThrow();
  });
});

describe("GmsProjectRuntime — key dispatch (real onKeyPress<Name>/onKeyRelease<Name> wiring)", () => {
  // Proves the previously-uncalled onKeyPress<Name>/onKeyRelease<Name>
  // exports gms2-codegen.ts's buildKeyFns() generates actually fire, once
  // per real up-down/down-up transition — not every frame a key is held —
  // exactly the class of gap the onAlarm fix above already found and fixed
  // for the Alarm event family. vk 32 = space (GameMaker's vk_space,
  // confirmed against a real generated obj_game_start.behavior.ts's
  // onKeyPressSpace export from a real GMS2 project import).
  let game: InstanceType<typeof Game>;

  function buildKeyFixture(): GmsProjectData {
    const lookup: Record<string, ComponentDef> = {
      Transform,
      Meta,
      GmlBehaviorState,
    };
    const prefab: PrefabDef = definePrefab("objKeyed", [
      { def: Transform },
      { def: Meta },
      { def: GmlBehaviorState, overrides: { behaviorId: "objKeyed" } },
    ]);
    const room0: SceneFile = {
      sceneName: "room0",
      prefabInstances: [{ prefab: "objKeyed", props: { x: 0, y: 0 } }],
    };
    return {
      rooms: { room0 },
      roomOrder: ["room0"],
      prefabs: { objKeyed: prefab },
      lookup: (name) => lookup[name],
    };
  }

  beforeEach(() => {
    game = new Game();
  });

  afterEach(() => {
    unregisterGmlBehavior("objKeyed");
    game.input.simulateKeyUp("Space");
  });

  it("dispatches onKeyPressSpace exactly once on the up-to-down transition, not while held", async () => {
    let pressCount = 0;
    const module: GmlBehaviorModule & Record<string, unknown> = {};
    module["onKeyPressSpace"] = (() => {
      pressCount += 1;
    }) satisfies GmlBehaviorModule["onCreate"];
    registerGmlBehavior("objKeyed", module);

    const runtime = new GmsProjectRuntime(game, buildKeyFixture());
    await runtime.loadRoom("room0");

    // Not down yet.
    runtime.update(1 / 60);
    expect(pressCount).toBe(0);

    // Press: the transition frame fires it once.
    game.input.simulateKeyDown("Space");
    runtime.update(1 / 60);
    expect(pressCount).toBe(1);

    // Still held — no re-fire while it stays down.
    for (let i = 0; i < 5; i++) runtime.update(1 / 60);
    expect(pressCount).toBe(1);
  });

  it("dispatches onKeyReleaseSpace exactly once on the down-to-up transition", async () => {
    let releaseCount = 0;
    const module: GmlBehaviorModule & Record<string, unknown> = {};
    module["onKeyReleaseSpace"] = (() => {
      releaseCount += 1;
    }) satisfies GmlBehaviorModule["onCreate"];
    registerGmlBehavior("objKeyed", module);

    const runtime = new GmsProjectRuntime(game, buildKeyFixture());
    await runtime.loadRoom("room0");

    game.input.simulateKeyDown("Space");
    runtime.update(1 / 60);
    expect(releaseCount).toBe(0);

    game.input.simulateKeyUp("Space");
    runtime.update(1 / 60);
    expect(releaseCount).toBe(1);

    // Stays up — no re-fire.
    for (let i = 0; i < 5; i++) runtime.update(1 / 60);
    expect(releaseCount).toBe(1);
  });

  it("a key with no transition this frame dispatches nothing", async () => {
    let pressCount = 0;
    let releaseCount = 0;
    const module: GmlBehaviorModule & Record<string, unknown> = {};
    module["onKeyPressSpace"] = (() => {
      pressCount += 1;
    }) satisfies GmlBehaviorModule["onCreate"];
    module["onKeyReleaseSpace"] = (() => {
      releaseCount += 1;
    }) satisfies GmlBehaviorModule["onCreate"];
    registerGmlBehavior("objKeyed", module);

    const runtime = new GmsProjectRuntime(game, buildKeyFixture());
    await runtime.loadRoom("room0");

    // Never touched — no transitions ever occur.
    for (let i = 0; i < 10; i++) runtime.update(1 / 60);
    expect(pressCount).toBe(0);
    expect(releaseCount).toBe(0);
  });

  it("a throwing onKeyPress<Name> handler does not abort dispatch for other entities", async () => {
    let otherFired = false;
    const throwing: GmlBehaviorModule & Record<string, unknown> = {};
    throwing["onKeyPressSpace"] = (() => {
      throw new Error("boom — synthetic onKeyPressSpace failure");
    }) satisfies GmlBehaviorModule["onCreate"];
    registerGmlBehavior("objKeyed", throwing);
    registerGmlBehavior("objKeyedOther", {
      onKeyPressSpace: () => {
        otherFired = true;
      },
    } as GmlBehaviorModule & Record<string, unknown>);

    const lookup: Record<string, ComponentDef> = {
      Transform,
      Meta,
      GmlBehaviorState,
    };
    const prefabA: PrefabDef = definePrefab("objKeyed", [
      { def: Transform },
      { def: Meta },
      { def: GmlBehaviorState, overrides: { behaviorId: "objKeyed" } },
    ]);
    const prefabB: PrefabDef = definePrefab("objKeyedOther", [
      { def: Transform },
      { def: Meta },
      { def: GmlBehaviorState, overrides: { behaviorId: "objKeyedOther" } },
    ]);
    const room0: SceneFile = {
      sceneName: "room0",
      prefabInstances: [
        { prefab: "objKeyed", props: { x: 0, y: 0 } },
        { prefab: "objKeyedOther", props: { x: 10, y: 0 } },
      ],
    };
    const runtime = new GmsProjectRuntime(game, {
      rooms: { room0 },
      roomOrder: ["room0"],
      prefabs: { objKeyed: prefabA, objKeyedOther: prefabB },
      lookup: (name) => lookup[name],
    });
    await runtime.loadRoom("room0");

    game.input.simulateKeyDown("Space");
    expect(() => runtime.update(1 / 60)).not.toThrow();
    expect(otherFired).toBe(true);

    unregisterGmlBehavior("objKeyedOther");
  });
});
