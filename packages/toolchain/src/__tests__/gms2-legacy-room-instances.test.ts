import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { importGMS2Project } from "../gms2-import.js";

// ---------------------------------------------------------------------------
// A legacy-format .yyp (predating the `resources: [{ id: { name, path } }]`
// shape) serialises resources as `{ Key: <guid>, Value: { id, resourcePath,
// resourceType } }` entries (see gms2-parse.ts's
// `LegacyYypResourceEntry`/`buildLegacyResourceGuidMap` doc comments), and a
// legacy room's own `.yy` instances reference their object by a bare
// `objId: "<guid>"` matching that entry's `Key` — never the newer
// `objectId: { name, path }` shape. Confirmed against a real legacy-format
// GMS2 project: without resolving `objId` back to an object name via the
// project's own resource `Key`s, `buildRoomSceneJSON` silently produced a
// `.scene.json` with zero prefab-instance entities, even though the room's `.yy`
// genuinely listed one. Fully synthetic fixture — no real project data.
// ---------------------------------------------------------------------------

describe("legacy .yyp room instances (bare objId GUID, no objectId.name)", () => {
  let dir: string;
  let out: string;

  beforeAll(async () => {
    dir = await fs.mkdtemp(
      path.join(os.tmpdir(), "gms2-legacy-room-instances-"),
    );
    out = path.join(dir, "out");

    const objectGuid = "36741919-1407-46f5-8db2-11b653587080";

    await fs.writeFile(
      path.join(dir, "test.yyp"),
      `{
        "%Name": "Legacy Test Project",
        "resources": [
          {"Key": "${objectGuid}", "Value": {"id": "72af9f82-2158-490d-9cec-4f28ec5a123d", "resourcePath": "objects\\\\obj_legacy\\\\obj_legacy.yy", "resourceType": "GMObject"}},
          {"Key": "8c2618d5-97af-461f-83c2-174b34903c4e", "Value": {"id": "afe5578c-54cf-4138-9b53-785b27bb30be", "resourcePath": "rooms\\\\rm_test\\\\rm_test.yy", "resourceType": "GMRoom"}},
        ],
        "defaultScriptType": 0,
      }`,
      "utf-8",
    );

    const objDir = path.join(dir, "objects", "obj_legacy");
    await fs.mkdir(objDir, { recursive: true });
    await fs.writeFile(
      path.join(objDir, "obj_legacy.yy"),
      `{"name": "obj_legacy",}`,
      "utf-8",
    );

    const roomDir = path.join(dir, "rooms", "rm_test");
    await fs.mkdir(roomDir, { recursive: true });
    await fs.writeFile(
      path.join(roomDir, "rm_test.yy"),
      `{
        "name": "rm_test",
        "roomSettings": {"Width": 1024, "Height": 768},
        "layers": [
          {
            "name": "Instances",
            "resourceType": "GMRInstanceLayer",
            "instances": [
              {"name": "inst_1", "objId": "${objectGuid}", "x": 480, "y": 224, "modelName": "GMRInstance", "mvc": "1.0"},
            ],
          },
        ],
      }`,
      "utf-8",
    );

    await importGMS2Project(path.join(dir, "test.yyp"), out, {
      verbose: false,
    });
  });

  afterAll(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("resolves the room instance's bare objId GUID back to its real object name", async () => {
    const sceneRaw = await fs.readFile(
      path.join(out, "rooms", "rm_test.scene.json"),
      "utf-8",
    );
    const scene = JSON.parse(sceneRaw) as {
      entities: {
        id: string;
        prefab: { name: string; props: { x: number; y: number } };
      }[];
    };
    expect(scene.entities).toHaveLength(1);
    // The instance's own editor name becomes its stable entity id.
    expect(scene.entities[0]?.id).toBe("inst_1");
    expect(scene.entities[0]?.prefab.name).toBe("obj_legacy");
    expect(scene.entities[0]?.prefab.props).toEqual({ x: 480, y: 224 });
  });
});
