import { describe, it, expect, afterEach } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { convertGms2Room } from "../gms2-room-import.js";

// ---------------------------------------------------------------------------
// A real GameMaker room .yy can place a `GMRInstance` whose `objectId` is a
// bare `null` — GameMaker's own on-disk shape for a placed instance whose
// object was deleted from the project after placement (the room-instance
// equivalent of the already-handled "stale/orphaned object.yy reference"
// case). `typeof null === "object"` in JS, so the pre-existing guard
// (`typeof inst.objectId === "object"`) matched this case and then crashed
// trying to read `.name` off `null` — confirmed against a real GameMaker
// project (a real project's rm_menuf, whose "Instances" layer has three
// such placeholder instances). The fix treats a null objectId the same as
// any other unresolvable instance reference: it falls through to
// `objectName: "Unknown"`, which callers already filter out via
// `knownObjects.has(...)` rather than emitting a broken prefab reference.
// ---------------------------------------------------------------------------

describe("convertGms2Room — instance with a null objectId", () => {
  let dir: string | undefined;

  afterEach(async () => {
    if (dir) await fs.rm(dir, { recursive: true, force: true });
    dir = undefined;
  });

  it("does not throw, and reports the instance as Unknown rather than crashing", async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "gms2-room-null-obj-"));
    const roomPath = path.join(dir, "rm_test.yy");
    await fs.writeFile(
      roomPath,
      `{
        "name": "rm_test",
        "roomSettings": {"Width": 1024, "Height": 768},
        "layers": [
          {"instances":[
              {"objectId":null,"x":768.0,"y":736.0,"name":"inst_orphan","resourceType":"GMRInstance",},
              {"objectId":{"name":"obj_real","path":"objects/obj_real/obj_real.yy",},"x":100.0,"y":200.0,"name":"inst_real","resourceType":"GMRInstance",},
            ],"visible":true,"depth":100,"name":"Instances","resourceType":"GMRInstanceLayer",},
        ],
      }`,
      "utf-8",
    );

    const room = await convertGms2Room(roomPath, {});
    const instances = room.layers.flatMap((l) => l.instances);
    expect(instances).toContainEqual({
      objectName: "Unknown",
      x: 768,
      y: 736,
    });
    expect(instances).toContainEqual({
      objectName: "obj_real",
      x: 100,
      y: 200,
    });
  });
});
