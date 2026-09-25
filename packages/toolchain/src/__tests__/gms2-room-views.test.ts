import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  convertGms2Room,
  buildRoomSceneFileViews,
} from "../gms2-room-import.js";

// ---------------------------------------------------------------------------
// Real GMS2 room `.yy` view/camera data — confirmed field names against the
// GameMaker manual's Cameras And Viewports reference pages, the
// NPC-Studio/yy-typings project, and ENIGMA's room_set_view compatibility
// docs (all three agree on the same field set this fixture uses:
// xview/yview/wview/hview, xport/yport/wport/hport, hborder/vborder,
// hspeed/vspeed, objectId, plus the room-wide viewSettings.enableViews
// switch). This was, before this pass, a completely untracked gap — zero
// references to "view"/"camera" anywhere in gms2-room-import.ts.
// ---------------------------------------------------------------------------

function buildRoomYyWithViews(): string {
  return `{
    "name": "rm_camera_test",
    "roomSettings": { "Width": 1024, "Height": 768 },
    "viewSettings": { "enableViews": true },
    "views": [
      {
        "visible": true,
        "xview": 0, "yview": 0, "wview": 640, "hview": 480,
        "xport": 0, "yport": 0, "wport": 640, "hport": 480,
        "hborder": 32, "vborder": 32,
        "hspeed": 4, "vspeed": 4,
        "objectId": { "name": "obj_player" },
      },
      {
        "visible": true,
        "xview": 640, "yview": 0, "wview": 640, "hview": 480,
        "xport": 640, "yport": 0, "wport": 640, "hport": 480,
        "hborder": 16, "vborder": 16,
        "hspeed": -1, "vspeed": -1,
        "objectId": null,
      },
      {
        "visible": false,
        "xview": 0, "yview": 0, "wview": 1280, "hview": 720,
        "xport": 0, "yport": 0, "wport": 1280, "hport": 720,
        "hborder": 32, "vborder": 32,
        "hspeed": -1, "vspeed": -1,
        "objectId": null,
      },
    ],
    "layers": [],
  }`;
}

function buildRoomYyNoViews(): string {
  return `{
    "name": "rm_no_views",
    "roomSettings": { "Width": 320, "Height": 240 },
    "layers": [],
  }`;
}

describe("convertGms2Room — real .yy view/camera data", () => {
  let dir: string;

  beforeAll(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "gms2-views-"));
  });
  afterAll(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("parses viewSettings.enableViews and every real view field, trailing commas and all", async () => {
    const p = path.join(dir, "rm_camera_test.yy");
    await fs.writeFile(p, buildRoomYyWithViews(), "utf-8");

    const room = await convertGms2Room(p);

    expect(room.viewsEnabled).toBe(true);
    expect(room.views).toHaveLength(3);

    const v0 = room.views[0];
    expect(v0).toBeDefined();
    if (v0 === undefined) throw new Error("expected view 0");
    expect(v0.visible).toBe(true);
    expect(v0.xview).toBe(0);
    expect(v0.yview).toBe(0);
    expect(v0.wview).toBe(640);
    expect(v0.hview).toBe(480);
    expect(v0.xport).toBe(0);
    expect(v0.wport).toBe(640);
    expect(v0.hborder).toBe(32);
    expect(v0.vborder).toBe(32);
    expect(v0.hspeed).toBe(4);
    expect(v0.vspeed).toBe(4);
    expect(v0.objectId).toBe("obj_player");

    const v1 = room.views[1];
    expect(v1).toBeDefined();
    if (v1 === undefined) throw new Error("expected view 1");
    expect(v1.xview).toBe(640);
    expect(v1.hspeed).toBe(-1);
    expect(v1.objectId).toBeUndefined();

    const v2 = room.views[2];
    expect(v2).toBeDefined();
    if (v2 === undefined) throw new Error("expected view 2");
    expect(v2.visible).toBe(false);
  });

  it("defaults to viewsEnabled: false and an empty views array when a room never touches its view settings", async () => {
    const p = path.join(dir, "rm_no_views.yy");
    await fs.writeFile(p, buildRoomYyNoViews(), "utf-8");

    const room = await convertGms2Room(p);
    expect(room.viewsEnabled).toBe(false);
    expect(room.views).toEqual([]);
  });
});

describe("buildRoomSceneFileViews — GameMaker short names -> SceneFileView", () => {
  it("renames every field onto the runtime-facing world*/screen* convention and carries followObject through", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "gms2-views2-"));
    try {
      const p = path.join(dir, "rm_camera_test.yy");
      await fs.writeFile(p, buildRoomYyWithViews(), "utf-8");
      const room = await convertGms2Room(p);

      const views = buildRoomSceneFileViews(room);
      expect(views).toHaveLength(3);

      expect(views[0]).toEqual({
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
        speedX: 4,
        speedY: 4,
        followObject: "obj_player",
      });

      // View 1 has no objectId — followObject must be genuinely absent, not
      // a fabricated empty string or -1 sentinel.
      const view1 = views[1];
      expect(view1).toBeDefined();
      if (view1 === undefined) throw new Error("expected view 1");
      expect(view1.followObject).toBeUndefined();
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});
