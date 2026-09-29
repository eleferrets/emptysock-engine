import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { Game } = await import("../Game.js");
const { GmsProjectRuntime } = await import("../GmsRuntime.js");
const { Transform } = await import("../components/Transform.js");
const { Meta } = await import("../components/Meta.js");
const { GmlBehaviorState, registerGmlBehavior, unregisterGmlBehavior } =
  await import("../components/GmlBehavior.js");
const { definePrefab } = await import("../Prefab.js");
const compat = await import("../compat/gmlInstanceVars.js");
const actions = await import("../compat/gmlActions.js");
import type { GmlBehaviorModule } from "../components/GmlBehavior.js";
import type { ComponentDef } from "../Component.js";
import type { Entity } from "../Entity.js";
import type { GmsProjectData } from "../GmsRuntime.js";

const lookup: Record<string, ComponentDef> = {
  Transform,
  Meta,
  GmlBehaviorState,
};
const thing = definePrefab("objThing", [
  { def: Transform },
  { def: Meta },
  { def: GmlBehaviorState, overrides: { behaviorId: "objRoomThing" } },
]);
const ctrl = definePrefab("objRoomCtrl", [
  { def: Transform },
  { def: Meta, overrides: { persistent: true } },
]);

function build(): GmsProjectData {
  return {
    rooms: {
      a: {
        sceneName: "a",
        persistent: true,
        prefabInstances: [
          { prefab: "objThing", props: { x: 1, y: 1 } },
          { prefab: "objRoomCtrl", props: { x: 5, y: 5 } },
        ],
      },
      b: {
        sceneName: "b",
        prefabInstances: [{ prefab: "objThing", props: { x: 9, y: 9 } }],
      },
    },
    roomOrder: ["a", "b"],
    prefabs: { objThing: thing, objRoomCtrl: ctrl },
    lookup: (n) => lookup[n],
  };
}

function all(runtime: InstanceType<typeof GmsProjectRuntime>, name: string) {
  const out: Entity[] = [];
  runtime.scene?.each(Meta, (m, e) => {
    if (m.name === name) out.push(e);
  });
  return out;
}

let creates = 0;
beforeEach(() => {
  creates = 0;
  registerGmlBehavior("objRoomThing", {
    onCreate: () => {
      creates += 1;
    },
  } as GmlBehaviorModule);
});
afterEach(() => unregisterGmlBehavior("objRoomThing"));

describe("room-level persistence", () => {
  it("a persistent room returns as left: state kept, Create not rerun", async () => {
    const runtime = new GmsProjectRuntime(new Game(), build());
    await runtime.loadRoom("a");
    expect(creates).toBe(1);
    const [t] = all(runtime, "objThing");
    if (t === undefined) throw new Error("setup");
    const tr = t.get(Transform);
    if (tr) tr.x = 42;
    compat.setGmlVar(t, {} as never, "hp", 7);
    await runtime.loadRoom("b");
    expect(creates).toBe(2);
    await runtime.loadRoom("a");
    expect(creates).toBe(2); // no Create on the restored visit
    const things = all(runtime, "objThing");
    expect(things).toHaveLength(1);
    expect(things[0]?.get(Transform)?.x).toBe(42);
    expect(compat.getGmlVar(things[0] as Entity, {} as never, "hp")).toBe(7);
  });

  it("a non-persistent room is recreated from its file", async () => {
    const runtime = new GmsProjectRuntime(new Game(), build());
    await runtime.loadRoom("b");
    const [t] = all(runtime, "objThing");
    const tr = t?.get(Transform);
    if (tr) tr.x = 500;
    await runtime.loadRoom("a");
    await runtime.loadRoom("b");
    expect(all(runtime, "objThing")[0]?.get(Transform)?.x).toBe(9);
  });

  it("object-persistent wins: the controller travels, is not cached with the room", async () => {
    const runtime = new GmsProjectRuntime(new Game(), build());
    await runtime.loadRoom("a");
    await runtime.loadRoom("b");
    expect(all(runtime, "objRoomCtrl")).toHaveLength(1); // carried into b
    await runtime.loadRoom("a");
    // carried ctrl arrives, plus room a's own restored state has no ctrl
    expect(all(runtime, "objRoomCtrl")).toHaveLength(1);
    expect(all(runtime, "objThing")).toHaveLength(1);
  });

  it("room_restart clears that room's cache; game_restart clears all and drops carried objects", async () => {
    const game = new Game();
    const spy = vi.spyOn(game, "loadScene");
    /** Await the load the GML action started with `void`. */
    const settle = async (): Promise<void> => {
      await spy.mock.results.at(-1)?.value;
    };
    const runtime = new GmsProjectRuntime(game, build());
    await runtime.loadRoom("a");
    const move = (x: number) => {
      const tr = all(runtime, "objThing")[0]?.get(Transform);
      if (tr) tr.x = x;
    };
    move(42);
    await runtime.loadRoom("b");
    expect(game.roomCache.keys()).toEqual(["a"]);
    await runtime.loadRoom("a");
    move(43);

    const ctx = {
      game,
      rooms: (
        runtime as unknown as { buildContext(): { rooms: never } }
      ).buildContext().rooms,
      roomOrder: ["a", "b"],
      currentRoom: "a",
    };
    const dummy = all(runtime, "objThing")[0] as Entity;
    actions.room_restart(dummy, ctx as never);
    await settle();
    expect(all(runtime, "objThing")[0]?.get(Transform)?.x).toBe(1);
    expect(creates).toBe(3);

    await runtime.loadRoom("b");
    expect(game.roomCache.keys()).toEqual(["a"]);
    game.globals.set("score", 3);
    actions.game_restart(dummy, { ...ctx, currentRoom: "b" } as never);
    await settle();
    expect(game.roomCache.keys()).toEqual([]);
    // GameMaker: globals are not re-initialised by game_restart.
    expect(game.globals.get("score")).toBe(3);
    expect(all(runtime, "objThing")[0]?.get(Transform)?.x).toBe(1);
    // ctrl is placed by room a itself; the carried one from b was dropped
    expect(all(runtime, "objRoomCtrl")).toHaveLength(1);
  });
});
