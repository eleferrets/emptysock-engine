import { describe, expect, it } from "vitest";
import { SceneDocumentSchema } from "@emptysock/types";
import { parseSceneDocument } from "../SceneMigrations.js";

/**
 * The engine validates scene documents with a zod-free structural copy; the
 * zod schema in `@emptysock/types` is the source of truth. Both must accept
 * and reject the same documents, and agree on the accepted value.
 */
const valid = {
  formatVersion: 2,
  id: "rm_a",
  name: "Room A",
  persistent: true,
  backgroundColor: "#102030",
  systems: ["physics"],
  room: {
    width: 640,
    height: 480,
    viewsEnabled: true,
    views: [
      {
        id: "v0",
        visible: true,
        world: { x: 0, y: 0, w: 320, h: 240 },
        screen: { x: 0, y: 0, w: 640, h: 480 },
        border: { x: 32, y: 32 },
        speed: { x: -1, y: -1 },
        follow: { object: "obj_player", entity: { $ref: "player" } },
      },
    ],
    layers: [{ id: "l0", name: "Instances", depth: 0, visible: true }],
  },
  entities: [
    {
      id: "player",
      name: "Player",
      tags: ["hero"],
      active: true,
      persistent: true,
      prefab: { name: "obj_player", props: { hp: 3 } },
      components: { Transform: { v: 1, data: { x: 1, y: 2 } } },
      layer: "l0",
      pool: false,
      ext: { gml: { vars: { score: 1 } } },
    },
    { id: "child", parent: "player" },
  ],
  metadata: { author: "a", createdAt: 1, updatedAt: 2 },
};

const clone = (): typeof valid => structuredClone(valid);

const cases: ReadonlyArray<readonly [string, unknown, boolean]> = [
  ["a full document", valid, true],
  ["a minimal document", { formatVersion: 2, name: "x", entities: [] }, true],
  ["an empty name", { formatVersion: 2, name: "", entities: [] }, false],
  ["a bad background colour", { ...clone(), backgroundColor: "red" }, false],
  [
    "a bad entity id",
    { formatVersion: 2, name: "x", entities: [{ id: "has space" }] },
    false,
  ],
  [
    "a duplicate entity id",
    { formatVersion: 2, name: "x", entities: [{ id: "a" }, { id: "a" }] },
    false,
  ],
  [
    "an unknown parent",
    { formatVersion: 2, name: "x", entities: [{ id: "a", parent: "zz" }] },
    false,
  ],
  [
    "a parent cycle",
    {
      formatVersion: 2,
      name: "x",
      entities: [
        { id: "a", parent: "b" },
        { id: "b", parent: "a" },
      ],
    },
    false,
  ],
  [
    "a view following an unknown entity",
    {
      ...clone(),
      room: {
        ...clone().room,
        views: [
          {
            ...clone().room.views[0],
            follow: { entity: { $ref: "ghost" } },
          },
        ],
      },
    },
    false,
  ],
  [
    "a component entry without data",
    {
      formatVersion: 2,
      name: "x",
      entities: [{ id: "a", components: { Transform: { v: 1 } } }],
    },
    false,
  ],
  [
    "a non-integer component version",
    {
      formatVersion: 2,
      name: "x",
      entities: [{ id: "a", components: { T: { v: 1.5, data: {} } } }],
    },
    false,
  ],
  [
    "a prefab ref without a name",
    {
      formatVersion: 2,
      name: "x",
      entities: [{ id: "a", prefab: { props: {} } }],
    },
    false,
  ],
  [
    "a layer without a depth",
    {
      ...clone(),
      room: { width: 1, height: 1, layers: [{ id: "l", name: "n" }] },
    },
    false,
  ],
];

describe("SceneDocument: engine copy matches the zod schema", () => {
  it.each(cases)("%s", (_label, doc, ok) => {
    const zod = SceneDocumentSchema.safeParse(doc);
    let engine: unknown;
    let engineOk = true;
    try {
      engine = parseSceneDocument(doc);
    } catch {
      engineOk = false;
    }
    expect({ zod: zod.success, engine: engineOk }).toEqual({
      zod: ok,
      engine: ok,
    });
    if (ok && zod.success) expect(engine).toEqual(zod.data);
  });
});
