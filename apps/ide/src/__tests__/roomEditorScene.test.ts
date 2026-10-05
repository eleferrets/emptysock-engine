import { describe, it, expect } from "vitest";
import {
  parseRoomScene,
  serializeRoomScene,
} from "../components/panels/roomEditorScene";

const V2 = {
  formatVersion: 2,
  name: "rm",
  persistent: true,
  editorNote: { keep: "me" },
  room: {
    width: 640,
    height: 480,
    layers: [{ id: "l0", name: "Main", depth: 0 }],
    views: [
      {
        id: "cam",
        visible: true,
        world: { x: 1, y: 2, w: 3, h: 4 },
        screen: { x: 5, y: 6, w: 7, h: 8 },
        border: { x: 0, y: 0 },
        speed: { x: -1, y: -1 },
        follow: { entity: { $ref: "hero" } },
      },
    ],
  },
  entities: [
    { id: "bg", components: { Sprite: { data: { texturePath: "a.png" } } } },
    {
      id: "hero",
      name: "Hero",
      parent: "bg",
      tags: ["t"],
      persistent: true,
      prefab: { name: "obj_hero", props: { x: 1, y: 2 } },
      ext: { gml: { vars: { hp: 3 } } },
    },
    { id: "late", components: { Transform: { data: { x: 9 } } } },
  ],
};

describe("roomEditorScene", () => {
  it("round-trips a v2 document untouched, keeping ids, order and unknown keys", () => {
    const state = parseRoomScene(JSON.stringify(V2));
    expect(state).toBeDefined();
    if (state === undefined) return;
    expect(state.instances.map((i) => i.id)).toEqual(["hero"]);
    const out = JSON.parse(serializeRoomScene(state)) as typeof V2;
    expect(out.entities.map((e) => e.id)).toEqual(["bg", "hero", "late"]);
    expect(out.editorNote).toEqual({ keep: "me" });
    expect(out.persistent).toBe(true);
    expect(out.room.layers).toEqual(V2.room.layers);
    // (Absent border/speed are written back as their defaults, 0 and -1.)
    // The view keeps its id and its entity follow ref through the flat editor model.
    expect(out.room.views[0]).toEqual(V2.room.views[0]);
    expect(out.entities[1]).toEqual(V2.entities[1]);
  });

  it("moving an instance changes props only, never the id or other fields", () => {
    const state = parseRoomScene(JSON.stringify(V2));
    if (state === undefined) throw new Error("parse failed");
    const [hero] = state.instances;
    if (hero === undefined) throw new Error("no hero");
    const moved = {
      ...state,
      instances: [
        { ...hero, prefab: { ...hero.prefab, props: { x: 50, y: 60 } } },
      ],
    };
    const out = JSON.parse(serializeRoomScene(moved)) as typeof V2;
    expect(out.entities[1]).toEqual({
      ...V2.entities[1],
      prefab: { name: "obj_hero", props: { x: 50, y: 60 } },
    });
  });

  it("reads a v1 file and writes v2 only", () => {
    const state = parseRoomScene(
      JSON.stringify({
        sceneName: "old",
        prefabInstances: [{ prefab: "obj_a", props: { x: 1, y: 2 } }],
        roomWidth: 320,
        roomHeight: 200,
      }),
    );
    if (state === undefined) throw new Error("parse failed");
    const out = JSON.parse(serializeRoomScene(state)) as Record<
      string,
      unknown
    >;
    expect(out["formatVersion"]).toBe(2);
    expect(out["name"]).toBe("old");
    expect(out["sceneName"]).toBeUndefined();
    expect(out["prefabInstances"]).toBeUndefined();
    expect(out["room"]).toEqual({ width: 320, height: 200 });
  });

  it("rejects non-scene and too-new documents", () => {
    expect(parseRoomScene("not json")).toBeUndefined();
    expect(parseRoomScene(JSON.stringify({ foo: 1 }))).toBeUndefined();
    expect(
      parseRoomScene(
        JSON.stringify({ formatVersion: 3, name: "x", entities: [] }),
      ),
    ).toBeUndefined();
  });
});
