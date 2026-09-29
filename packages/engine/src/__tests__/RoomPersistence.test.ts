import { afterEach, beforeEach, describe, expect, it } from "vitest";

const { Game } = await import("../Game.js");
const { GmsProjectRuntime } = await import("../GmsRuntime.js");
const { Transform } = await import("../components/Transform.js");
const { Meta } = await import("../components/Meta.js");
const { GmlBehaviorState, registerGmlBehavior, unregisterGmlBehavior } =
  await import("../components/GmlBehavior.js");
const { definePrefab } = await import("../Prefab.js");
const compat = await import("../compat/gmlInstanceVars.js");
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
});
