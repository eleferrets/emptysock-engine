import { describe, it, expect } from "vitest";
import { migrateScene, parseSceneDocument } from "../SceneMigrations.js";
import type { SceneFileV1 } from "../SceneMigrations.js";

const v1: SceneFileV1 = {
  sceneName: "rm_a",
  systems: ["physics"],
  prefabInstances: [
    { prefab: "objA", props: { x: 1, y: 2 }, gmlVars: { hp: 3 }, pool: true },
    { prefab: "objB" },
  ],
  entities: [
    {
      components: [
        { component: "LayerElement", overrides: { depth: 5 } },
        { component: "Meta" },
      ],
    },
  ],
  roomWidth: 640,
  roomHeight: 480,
  viewsEnabled: true,
  views: [
    {
      visible: true,
      worldX: 0,
      worldY: 1,
      worldWidth: 320,
      worldHeight: 240,
      screenX: 2,
      screenY: 3,
      screenWidth: 640,
      screenHeight: 480,
      borderX: 4,
      borderY: 5,
      speedX: 6,
      speedY: 7,
      followObject: "objA",
    },
  ],
};

describe("parseSceneDocument", () => {
  it("migrates a v1 SceneFile to v2 with deterministic ids and spawn order", () => {
    const doc = parseSceneDocument(v1);
    expect(doc.formatVersion).toBe(2);
    expect(doc.name).toBe("rm_a");
    expect(doc.systems).toEqual(["physics"]);
    expect(doc.entities.map((e) => e.id)).toEqual(["p0", "p1", "e0"]);
    expect(doc.entities[0]).toEqual({
      id: "p0",
      prefab: { name: "objA", props: { x: 1, y: 2 } },
      pool: true,
      ext: { gml: { vars: { hp: 3 } } },
    });
    expect(doc.entities[2]?.components).toEqual({
      LayerElement: { data: { depth: 5 } },
      Meta: { data: {} },
    });
    expect(doc.room).toEqual({
      width: 640,
      height: 480,
      viewsEnabled: true,
      views: [
        {
          id: "v0",
          visible: true,
          world: { x: 0, y: 1, w: 320, h: 240 },
          screen: { x: 2, y: 3, w: 640, h: 480 },
          border: { x: 4, y: 5 },
          speed: { x: 6, y: 7 },
          follow: { object: "objA" },
        },
      ],
    });
    // deterministic
    expect(parseSceneDocument(v1)).toEqual(doc);
  });

  it("omits room when a v1 file has no room data", () => {
    const doc = parseSceneDocument({ sceneName: "x" });
    expect(doc.room).toBeUndefined();
    expect(doc.entities).toEqual([]);
  });

  it("round-trips a v2 document through JSON", () => {
    const doc = parseSceneDocument(v1);
    expect(parseSceneDocument(JSON.parse(JSON.stringify(doc)))).toEqual(doc);
  });

  it("flattens a v0 editor tree with parent links", () => {
    const doc = parseSceneDocument({
      id: "123e4567-e89b-12d3-a456-426614174000",
      name: "Old",
      version: 1,
      entities: [
        {
          id: "aaaaaaaa-e89b-12d3-a456-426614174000",
          name: "root",
          tags: ["t"],
          active: false,
          components: [{ type: "Transform", data: { x: 1 } }],
          children: [
            { id: "bbbbbbbb-e89b-12d3-a456-426614174000", name: "kid" },
          ],
        },
      ],
    });
    expect(doc.entities).toHaveLength(2);
    expect(doc.entities[0]).toMatchObject({
      name: "root",
      tags: ["t"],
      active: false,
      components: { Transform: { data: { x: 1 } } },
    });
    expect(doc.entities[1]?.parent).toBe(doc.entities[0]?.id);
  });

  it("rejects a newer formatVersion naming both versions", () => {
    expect(() =>
      parseSceneDocument({ formatVersion: 3, name: "x", entities: [] }),
    ).toThrow(/3.*newer.*2/);
  });

  it("rejects duplicate ids, missing parents, cycles and unknown view refs", () => {
    const base = { formatVersion: 2, name: "x" };
    expect(() =>
      parseSceneDocument({ ...base, entities: [{ id: "a" }, { id: "a" }] }),
    ).toThrow(/duplicate/);
    expect(() =>
      parseSceneDocument({ ...base, entities: [{ id: "a", parent: "q" }] }),
    ).toThrow(/unknown parent/);
    expect(() =>
      parseSceneDocument({
        ...base,
        entities: [
          { id: "a", parent: "b" },
          { id: "b", parent: "a" },
        ],
      }),
    ).toThrow(/cycle/);
    expect(() =>
      parseSceneDocument({
        ...base,
        entities: [{ id: "a" }],
        room: {
          width: 1,
          height: 1,
          views: [{ follow: { entity: { $ref: "nope" } } }],
        },
      }),
    ).toThrow(/unknown entity/);
  });

  it("rejects non-scene input", () => {
    expect(() => migrateScene(42)).toThrow();
    expect(() => migrateScene({ foo: 1 })).toThrow(/unrecognised/);
  });
});
