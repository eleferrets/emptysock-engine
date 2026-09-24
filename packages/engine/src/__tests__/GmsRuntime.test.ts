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
