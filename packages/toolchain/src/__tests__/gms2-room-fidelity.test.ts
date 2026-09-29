import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { importGMS2Project } from "../gms2-import.js";
import { convertGms2Room } from "../gms2-room-import.js";

// ---------------------------------------------------------------------------
// Room-instance placement fidelity: proves the importer's generated
// .scene.json prefab-instance entities are a genuine 1:1 mapping of the source room's
// instances/positions, not a sampled or scrambled subset. This test builds a
// synthetic room with 20 instances spread across 3 layers, at deliberately
// varied coordinates (negative, large, duplicate-object-different-position,
// and duplicate-position-different-object) chosen so an axis swap,
// layer-offset bug, off-by-one, coordinate scaling, or instance-order
// scramble would all be caught rather than accidentally masked by a lucky
// trivial fixture.
// ---------------------------------------------------------------------------

interface FixtureInstance {
  layer: string;
  objectName: string;
  x: number;
  y: number;
}

// 20 instances across 3 layers. Includes: negative coordinates, large
// coordinates, two instances of the same object at different positions, and
// two different objects at the same position (on different layers) — all
// cases a naive dedup/sort/scramble bug could collapse or misplace.
const FIXTURE_INSTANCES: FixtureInstance[] = [
  { layer: "Background_Layer", objectName: "obj_deco", x: -500, y: -500 },
  { layer: "Background_Layer", objectName: "obj_deco", x: 12345, y: 9876 },
  { layer: "Background_Layer", objectName: "obj_deco", x: 0, y: 0 },
  { layer: "Background_Layer", objectName: "obj_rock", x: 40, y: 80 },
  { layer: "Background_Layer", objectName: "obj_rock", x: 120, y: 80 },
  { layer: "Background_Layer", objectName: "obj_rock", x: -1, y: 999999 },
  { layer: "Main_Layer", objectName: "obj_player", x: 64, y: 128 },
  { layer: "Main_Layer", objectName: "obj_enemy", x: 200, y: 200 },
  { layer: "Main_Layer", objectName: "obj_enemy", x: 200.5, y: 200.5 },
  { layer: "Main_Layer", objectName: "obj_enemy", x: -300, y: 40 },
  { layer: "Main_Layer", objectName: "obj_coin", x: 10, y: 10 },
  { layer: "Main_Layer", objectName: "obj_coin", x: 20, y: 10 },
  { layer: "Main_Layer", objectName: "obj_coin", x: 30, y: 10 },
  { layer: "Main_Layer", objectName: "obj_coin", x: 40, y: 10 },
  { layer: "Main_Layer", objectName: "obj_deco", x: 40, y: 80 }, // same pos as obj_rock above, diff layer
  { layer: "Foreground_Layer", objectName: "obj_cloud", x: -9999, y: -1 },
  { layer: "Foreground_Layer", objectName: "obj_cloud", x: 5000, y: 5000 },
  { layer: "Foreground_Layer", objectName: "obj_torch", x: 1, y: 2 },
  { layer: "Foreground_Layer", objectName: "obj_torch", x: 3, y: 4 },
  { layer: "Foreground_Layer", objectName: "obj_exit", x: 700, y: -700 },
];

const OBJECT_NAMES = [...new Set(FIXTURE_INSTANCES.map((i) => i.objectName))];
const LAYER_NAMES = [...new Set(FIXTURE_INSTANCES.map((i) => i.layer))];

function buildRoomYy(): string {
  const layers = LAYER_NAMES.map((layerName) => {
    const instances = FIXTURE_INSTANCES.filter((i) => i.layer === layerName)
      .map(
        (i) =>
          `{"objectId":{"name":"${i.objectName}",},"x":${i.x},"y":${i.y},},`,
      )
      .join("\n");
    return `{"name":"${layerName}","resourceType":"GMRInstanceLayer","instances":[\n${instances}\n],},`;
  }).join("\n");
  return `{
    "name":"rm_fidelity",
    "roomSettings":{"Width":1920,"Height":1080,},
    "layers":[
${layers}
    ],
  }`;
}

describe("GMS2 room import: instance placement is a genuine 1:1 mapping", () => {
  let dir: string;
  let out: string;

  beforeAll(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "gms2-room-fidelity-"));
    out = await fs.mkdtemp(path.join(os.tmpdir(), "gms2-room-fidelity-out-"));

    const resourceEntries = [
      ...OBJECT_NAMES.map(
        (name) =>
          `{"id":{"name":"${name}","path":"objects/${name}/${name}.yy",},},`,
      ),
      `{"id":{"name":"rm_fidelity","path":"rooms/rm_fidelity/rm_fidelity.yy",},},`,
    ].join("\n");

    await fs.writeFile(
      path.join(dir, "project.yyp"),
      `{
        "%Name":"Room Fidelity Test",
        "resources":[
${resourceEntries}
        ],
      }`,
      "utf-8",
    );

    for (const name of OBJECT_NAMES) {
      const objDir = path.join(dir, "objects", name);
      await fs.mkdir(objDir, { recursive: true });
      await fs.writeFile(
        path.join(objDir, `${name}.yy`),
        `{"name":"${name}",}`,
        "utf-8",
      );
    }

    const roomDir = path.join(dir, "rooms", "rm_fidelity");
    await fs.mkdir(roomDir, { recursive: true });
    await fs.writeFile(
      path.join(roomDir, "rm_fidelity.yy"),
      buildRoomYy(),
      "utf-8",
    );

    await importGMS2Project(path.join(dir, "project.yyp"), out, {
      verbose: false,
    });
  });

  afterAll(async () => {
    await fs.rm(dir, { recursive: true, force: true });
    await fs.rm(out, { recursive: true, force: true });
  });

  it("preserves every single instance's exact x/y and source layer order — no drops, no scrambles", async () => {
    // Independently re-parse the source room .yy (not via buildRoomSceneJSON
    // — via convertGms2Room, the lower-level parse step) as the ground truth
    // to compare the generated output against.
    const sourceRoom = await convertGms2Room(
      path.join(dir, "rooms", "rm_fidelity", "rm_fidelity.yy"),
    );

    // Flatten the source room the same way buildRoomSceneJSON documents
    // doing: per layer, in layer order, per instance, in instance order.
    const expectedFlat = sourceRoom.layers.flatMap((layer) =>
      layer.instances.map((inst) => ({
        prefab: { name: inst.objectName, props: { x: inst.x, y: inst.y } },
      })),
    );

    // Sanity: the fixture itself actually has all 20 instances and 3 layers
    // as intended — a failure here means the fixture is wrong, not the
    // importer.
    expect(FIXTURE_INSTANCES).toHaveLength(20);
    expect(sourceRoom.layers).toHaveLength(3);
    expect(expectedFlat).toHaveLength(20);

    const raw = await fs.readFile(
      path.join(out, "rooms", "rm_fidelity.scene.json"),
      "utf-8",
    );
    const scene = JSON.parse(raw) as {
      name: string;
      entities: Array<{
        id: string;
        prefab: { name: string; props: { x: number; y: number } };
      }>;
    };

    expect(scene.name).toBe("rm_fidelity");
    // Full, ordered, exact-value equality — not a sample, not a subset, not
    // a "same set" comparison that would let a scramble slip through.
    expect(scene.entities).toHaveLength(20);
    expect(scene.entities.map(({ prefab }) => ({ prefab }))).toEqual(
      expectedFlat,
    );
    // Every entity carries a unique stable id.
    expect(new Set(scene.entities.map((e) => e.id)).size).toBe(20);

    // Belt-and-suspenders: also verify directly against the hand-authored
    // fixture data (not just against the re-parsed source), so a bug shared
    // between convertGms2Room and buildRoomSceneJSON couldn't hide by both
    // sides agreeing with each other.
    let cursor = 0;
    for (const layerName of LAYER_NAMES) {
      const layerInstances = FIXTURE_INSTANCES.filter(
        (i) => i.layer === layerName,
      );
      for (const inst of layerInstances) {
        const actual = scene.entities[cursor];
        expect(actual).toBeDefined();
        expect(actual?.prefab.name).toBe(inst.objectName);
        expect(actual?.prefab.props.x).toBe(inst.x);
        expect(actual?.prefab.props.y).toBe(inst.y);
        cursor++;
      }
    }
    expect(cursor).toBe(20);

    // No two instances' positions got swapped with each other: every
    // (objectName, x, y) triple in the fixture appears exactly once in the
    // output, and vice versa.
    const expectedTriples = FIXTURE_INSTANCES.map(
      (i) => `${i.objectName}|${i.x}|${i.y}`,
    ).sort();
    const actualTriples = scene.entities
      .map((p) => `${p.prefab.name}|${p.prefab.props.x}|${p.prefab.props.y}`)
      .sort();
    expect(actualTriples).toEqual(expectedTriples);
  });
});
