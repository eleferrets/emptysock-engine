import { describe, it, expect, beforeEach } from "vitest";
import { Scene } from "../Scene.js";
import { CameraSystem } from "../systems/CameraSystem.js";
import { Transform } from "../components/Transform.js";
import { Meta } from "../components/Meta.js";
import type { GmlActionContext } from "../compat/gmlActions.js";
import type { GmlCameraContext } from "../compat/gmlCamera.js";
import { migrateSceneV1ToV2 } from "../SceneMigrations.js";
import type { SceneFileV1View } from "../SceneMigrations.js";
import {
  camera_create,
  camera_create_view,
  camera_destroy,
  camera_get_active,
  camera_get_view_x,
  camera_get_view_y,
  camera_get_view_width,
  camera_get_view_height,
  camera_get_view_angle,
  camera_get_view_speed_x,
  camera_get_view_speed_y,
  camera_set_view_pos,
  camera_set_view_size,
  camera_set_view_angle,
  camera_set_view_speed,
  view_get_camera,
  view_set_camera,
  view_get_visible,
  view_set_visible,
  view_get_enabled,
  view_set_enabled,
  view_get_xport,
  view_get_wport,
  camera_get_view_border_x,
  camera_get_view_border_y,
  camera_set_view_border,
  camera_get_view_target,
  camera_set_view_target,
  view_get_surface_id,
  view_set_surface_id,
  clearGmlCameraState,
  configureGmlViewsFromRoom,
  stepGmlCameraFollow,
  stepAllGmlCameraFollows,
  buildActiveGmlCameraViewports,
  _getGmlCameraHandle,
} from "../compat/gmlCamera.js";

function makeCtx(camera?: CameraSystem): GmlCameraContext {
  const scene = new Scene();
  const base: GmlActionContext = { scene };
  return camera === undefined ? { ...base } : { ...base, camera };
}

/** Room views are authored in the v1 flat shape in these fixtures and go through `migrateSceneV1ToV2` (which is what the runtime does for old files) before reaching the v2 `configureGmlViewsFromRoom`. */
function configure(
  ctx: Parameters<typeof configureGmlViewsFromRoom>[0],
  views: readonly SceneFileV1View[],
  viewsEnabled: boolean,
): void {
  configureGmlViewsFromRoom(
    ctx,
    migrateSceneV1ToV2({ sceneName: "t", views }).room?.views ?? [],
    viewsEnabled,
  );
}

describe("gmlCamera", () => {
  describe("default camera (id 0) mirrors a live CameraSystem", () => {
    let camera: CameraSystem;
    let ctx: GmlCameraContext;

    beforeEach(() => {
      camera = new CameraSystem();
      ctx = makeCtx(camera);
    });

    it("camera_set_view_pos moves the real CameraSystem and reads back", () => {
      camera_set_view_pos(ctx, 0, 100, 200);
      expect(camera.state.x).toBe(100);
      expect(camera.state.y).toBe(200);
      expect(camera_get_view_x(ctx, 0)).toBe(100);
      expect(camera_get_view_y(ctx, 0)).toBe(200);
    });

    it("camera_set_view_size resizes the real CameraSystem and reads back", () => {
      camera_set_view_size(ctx, 0, 640, 480);
      expect(camera.state.viewWidth).toBe(640);
      expect(camera.state.viewHeight).toBe(480);
      expect(camera_get_view_width(ctx, 0)).toBe(640);
      expect(camera_get_view_height(ctx, 0)).toBe(480);
    });

    it("camera_set_view_angle converts degrees to radians on the real CameraSystem", () => {
      camera_set_view_angle(ctx, 0, 90);
      expect(camera.state.rotation).toBeCloseTo(Math.PI / 2, 10);
      expect(camera_get_view_angle(ctx, 0)).toBeCloseTo(90, 10);
    });

    it("camera_set_view_speed round-trips without moving the camera (honest no-op for motion)", () => {
      camera_set_view_speed(ctx, 0, 4, 8);
      expect(camera_get_view_speed_x(ctx, 0)).toBe(4);
      expect(camera_get_view_speed_y(ctx, 0)).toBe(8);
      // No hidden motion side effect — position stays wherever it was.
      expect(camera.state.x).toBe(0);
      expect(camera.state.y).toBe(0);
    });

    it("camera_set_view_pos uses an immediate snap, not a smoothed move", () => {
      camera.setLerpFactor(0.01); // would take many update() calls to converge if it went through moveTo
      camera_set_view_pos(ctx, 0, 500, 500);
      // snapTo sets both current and target immediately, so a single update() does nothing further.
      camera.update(1 / 60);
      expect(camera.state.x).toBe(500);
      expect(camera.state.y).toBe(500);
    });
  });

  describe("default camera (id 0) without a live CameraSystem attached", () => {
    it("still stores and reads back view state honestly", () => {
      const ctx = makeCtx();
      camera_set_view_pos(ctx, 0, 10, 20);
      camera_set_view_size(ctx, 0, 300, 150);
      expect(camera_get_view_x(ctx, 0)).toBe(10);
      expect(camera_get_view_y(ctx, 0)).toBe(20);
      expect(camera_get_view_width(ctx, 0)).toBe(300);
      expect(camera_get_view_height(ctx, 0)).toBe(150);
    });
  });

  describe("camera_create / camera_create_view / camera_destroy", () => {
    it("camera_create allocates a fresh, non-zero id distinct from the default camera", () => {
      const ctx = makeCtx();
      const id = camera_create(ctx);
      expect(id).not.toBe(0);
      const id2 = camera_create(ctx);
      expect(id2).not.toBe(id);
    });

    it("camera_create_view seeds the handle's full view state", () => {
      const ctx = makeCtx();
      const id = camera_create_view(ctx, 10, 20, 800, 600, 45, 7, 2, 3, 16, 16);
      expect(camera_get_view_x(ctx, id)).toBe(10);
      expect(camera_get_view_y(ctx, id)).toBe(20);
      expect(camera_get_view_width(ctx, id)).toBe(800);
      expect(camera_get_view_height(ctx, id)).toBe(600);
      expect(camera_get_view_angle(ctx, id)).toBe(45);
      expect(camera_get_view_speed_x(ctx, id)).toBe(2);
      expect(camera_get_view_speed_y(ctx, id)).toBe(3);
      const handle = _getGmlCameraHandle(ctx, id);
      expect(handle?.targetObject).toBe(7);
      expect(handle?.borderX).toBe(16);
      expect(handle?.borderY).toBe(16);
    });

    it("a non-default camera never touches the live CameraSystem", () => {
      const camera = new CameraSystem();
      const ctx = makeCtx(camera);
      const id = camera_create(ctx);
      camera_set_view_pos(ctx, id, 999, 999);
      camera_set_view_size(ctx, id, 999, 999);
      expect(camera.state.x).toBe(0);
      expect(camera.state.y).toBe(0);
      expect(camera.state.viewWidth).not.toBe(999);
    });

    it("camera_destroy removes the handle; getters on a missing camera degrade to 0/-1 rather than throwing", () => {
      const ctx = makeCtx();
      const id = camera_create(ctx);
      camera_destroy(ctx, id);
      expect(camera_get_view_x(ctx, id)).toBe(0);
      expect(camera_get_view_speed_x(ctx, id)).toBe(-1);
      expect(() => camera_set_view_pos(ctx, id, 1, 1)).not.toThrow();
    });
  });

  describe("legacy view-slot bridge", () => {
    it("view_camera[0] defaults to the default camera id", () => {
      const ctx = makeCtx();
      expect(view_get_camera(ctx, 0)).toBe(0);
      for (let i = 1; i < 8; i++) {
        expect(view_get_camera(ctx, i)).toBe(-1);
      }
    });

    it("view_set_camera assigns a slot and reading it back matches", () => {
      const ctx = makeCtx();
      const id = camera_create(ctx);
      view_set_camera(ctx, 3, id);
      expect(view_get_camera(ctx, 3)).toBe(id);
      // Untouched slots stay as they were.
      expect(view_get_camera(ctx, 0)).toBe(0);
    });

    it("view_set_camera on slot 0 updates camera_get_active()'s approximation", () => {
      const ctx = makeCtx();
      const id = camera_create(ctx);
      expect(camera_get_active(ctx)).toBe(0);
      view_set_camera(ctx, 0, id);
      expect(camera_get_active(ctx)).toBe(id);
    });

    it("view_set_camera on a non-zero slot does not change camera_get_active()", () => {
      const ctx = makeCtx();
      const id = camera_create(ctx);
      view_set_camera(ctx, 4, id);
      expect(camera_get_active(ctx)).toBe(0);
    });

    it("out-of-range slot indices clamp into 0-7 rather than throwing or writing out of bounds", () => {
      const ctx = makeCtx();
      expect(() => view_set_camera(ctx, 99, 5)).not.toThrow();
      expect(view_get_camera(ctx, 7)).toBe(5);
      expect(() => view_set_camera(ctx, -5, 6)).not.toThrow();
      expect(view_get_camera(ctx, 0)).toBe(6);
    });

    it("view_visible[] and view_enabled round-trip per slot / room-wide", () => {
      const ctx = makeCtx();
      expect(view_get_visible(ctx, 2)).toBe(false);
      view_set_visible(ctx, 2, true);
      expect(view_get_visible(ctx, 2)).toBe(true);
      expect(view_get_visible(ctx, 3)).toBe(false);

      expect(view_get_enabled(ctx)).toBe(false);
      view_set_enabled(ctx, true);
      expect(view_get_enabled(ctx)).toBe(true);
    });
  });

  describe("per-scene isolation", () => {
    it("two scenes never share camera/view state", () => {
      const ctxA = makeCtx();
      const ctxB = makeCtx();
      camera_set_view_pos(ctxA, 0, 111, 222);
      view_set_enabled(ctxA, true);
      expect(camera_get_view_x(ctxB, 0)).toBe(0);
      expect(view_get_enabled(ctxB)).toBe(false);
    });
  });

  describe("clearGmlCameraState", () => {
    it("resets a scene's registry back to defaults", () => {
      const ctx = makeCtx();
      camera_set_view_pos(ctx, 0, 50, 50);
      view_set_enabled(ctx, true);
      clearGmlCameraState(ctx.scene);
      expect(camera_get_view_x(ctx, 0)).toBe(0);
      expect(view_get_enabled(ctx)).toBe(false);
    });
  });

  describe("configureGmlViewsFromRoom — real room camera/view setup", () => {
    it("wires every view slot into the registry: enabled flag, camera binding, visibility, screen rect", () => {
      const camera = new CameraSystem();
      const ctx = makeCtx(camera);
      const views: SceneFileV1View[] = [
        {
          visible: true,
          worldX: 10,
          worldY: 20,
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
        },
        {
          visible: true,
          worldX: 100,
          worldY: 200,
          worldWidth: 320,
          worldHeight: 240,
          screenX: 640,
          screenY: 0,
          screenWidth: 320,
          screenHeight: 240,
          borderX: 0,
          borderY: 0,
          speedX: -1,
          speedY: -1,
        },
      ];

      configure(ctx, views, true);

      expect(view_get_enabled(ctx)).toBe(true);
      // Slot 0 mirrors onto the default (id 0) camera, which also drives the
      // live CameraSystem.
      expect(view_get_visible(ctx, 0)).toBe(true);
      expect(camera_get_view_x(ctx, 0)).toBe(10);
      expect(camera_get_view_y(ctx, 0)).toBe(20);
      expect(camera.state.x).toBe(10);
      expect(camera.state.y).toBe(20);
      expect(view_get_xport(ctx, 0)).toBe(0);
      expect(view_get_wport(ctx, 0)).toBe(640);

      // Slot 1 gets its own distinct camera handle, bound and readable back.
      expect(view_get_visible(ctx, 1)).toBe(true);
      const camid1 = view_get_camera(ctx, 1);
      expect(camid1).not.toBe(0);
      expect(camera_get_view_x(ctx, camid1)).toBe(100);
      expect(view_get_xport(ctx, 1)).toBe(640);
      expect(view_get_wport(ctx, 1)).toBe(320);

      const active = buildActiveGmlCameraViewports(ctx);
      expect(active).toHaveLength(2);
      expect(active.map((v) => v.screenWidth).sort()).toEqual([320, 640]);
    });
  });

  describe("stepGmlCameraFollow — GameMaker's real border-follow algorithm", () => {
    function spawnFollowTarget(
      scene: Scene,
      name: string,
      x: number,
      y: number,
    ) {
      const entity = scene.spawn();
      entity.add(Transform, { x, y });
      entity.add(Meta, { name });
      return entity;
    }

    it("does not move the view while the target stays within the border", () => {
      const ctx = makeCtx();
      spawnFollowTarget(ctx.scene, "obj_player", 300, 300);
      const camid = camera_create_view(
        ctx,
        0,
        0,
        640,
        480,
        0,
        -1,
        -1,
        -1,
        32,
        32,
      );
      const handle = _getGmlCameraHandle(ctx, camid);
      expect(handle).toBeDefined();
      // Manually mark the follow target the way configureGmlViewsFromRoom does.
      configure(
        ctx,
        [
          {
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
            speedX: -1,
            speedY: -1,
            followObject: "obj_player",
          },
        ],
        true,
      );
      stepGmlCameraFollow(ctx, 0);
      // Target at (300,300) is well within [32, 608]x[32, 448] — no motion.
      expect(camera_get_view_x(ctx, 0)).toBe(0);
      expect(camera_get_view_y(ctx, 0)).toBe(0);
    });

    it("snaps instantly (speed -1) once the target crosses the border", () => {
      const ctx = makeCtx();
      spawnFollowTarget(ctx.scene, "obj_player", 700, 20);
      configure(
        ctx,
        [
          {
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
            speedX: -1,
            speedY: -1,
            followObject: "obj_player",
          },
        ],
        true,
      );
      stepGmlCameraFollow(ctx, 0);
      // target.x (700) > view.x + width - borderX (0 + 640 - 32 = 608), so
      // desiredX = 700 - 640 + 32 = 92; snapped instantly (speed -1).
      expect(camera_get_view_x(ctx, 0)).toBe(92);
      // target.y (20) < view.y + borderY (32) => desiredY = 20 - 32 = -12.
      expect(camera_get_view_y(ctx, 0)).toBe(-12);
    });

    it("caps per-step motion at speedX/speedY instead of snapping when a real speed is set", () => {
      const ctx = makeCtx();
      spawnFollowTarget(ctx.scene, "obj_player", 700, 20);
      configure(
        ctx,
        [
          {
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
            speedX: 5,
            speedY: 5,
            followObject: "obj_player",
          },
        ],
        true,
      );
      stepGmlCameraFollow(ctx, 0);
      // desiredX is 92 (as above), but speedX caps movement to 5px/step.
      expect(camera_get_view_x(ctx, 0)).toBe(5);
      expect(camera_get_view_y(ctx, 0)).toBe(-5);

      stepGmlCameraFollow(ctx, 0);
      expect(camera_get_view_x(ctx, 0)).toBe(10);
    });

    it("no-ops when the followed object type has no live instance", () => {
      const ctx = makeCtx();
      configure(
        ctx,
        [
          {
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
            speedX: -1,
            speedY: -1,
            followObject: "obj_ghost",
          },
        ],
        true,
      );
      expect(() => stepGmlCameraFollow(ctx, 0)).not.toThrow();
      expect(camera_get_view_x(ctx, 0)).toBe(0);
    });

    it("stepAllGmlCameraFollows steps every configured camera handle, not just the default", () => {
      const ctx = makeCtx();
      spawnFollowTarget(ctx.scene, "obj_a", 700, 20);
      spawnFollowTarget(ctx.scene, "obj_b", -50, 900);
      configure(
        ctx,
        [
          {
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
            speedX: -1,
            speedY: -1,
            followObject: "obj_a",
          },
          {
            visible: true,
            worldX: 0,
            worldY: 0,
            worldWidth: 320,
            worldHeight: 240,
            screenX: 640,
            screenY: 0,
            screenWidth: 320,
            screenHeight: 240,
            borderX: 16,
            borderY: 16,
            speedX: -1,
            speedY: -1,
            followObject: "obj_b",
          },
        ],
        true,
      );
      const camid1 = view_get_camera(ctx, 1);
      stepAllGmlCameraFollows(ctx);
      expect(camera_get_view_x(ctx, 0)).not.toBe(0);
      expect(camera_get_view_x(ctx, camid1)).not.toBe(0);
    });
  });

  describe("legacy e__VW view-script accessors — border/target/surface", () => {
    it("camera_get/set_view_border round-trips per axis", () => {
      const ctx = makeCtx();
      camera_create_view(ctx, 0, 0, 100, 100);
      camera_set_view_border(ctx, 0, 5, 9);
      expect(camera_get_view_border_x(ctx, 0)).toBe(5);
      expect(camera_get_view_border_y(ctx, 0)).toBe(9);
    });

    it("camera_get/set_view_target stores a numeric target faithfully", () => {
      const ctx = makeCtx();
      camera_create_view(ctx, 0, 0, 100, 100);
      camera_set_view_target(ctx, 0, 7);
      expect(camera_get_view_target(ctx, 0)).toBe(7);
    });

    it("camera_set_view_target(camid, -1) clears the follow-object-name too", () => {
      const ctx = makeCtx();
      camera_create_view(ctx, 0, 0, 100, 100);
      camera_set_view_target(ctx, 0, "obj_player");
      camera_set_view_target(ctx, 0, -1);
      expect(camera_get_view_target(ctx, 0)).toBe(-1);
    });

    it("view_get/set_surface_id round-trips per view slot, honestly, with no backing surface", () => {
      const ctx = makeCtx();
      expect(view_get_surface_id(ctx, 0)).toBe(-1);
      view_set_surface_id(ctx, 0, 3);
      expect(view_get_surface_id(ctx, 0)).toBe(3);
      expect(view_get_surface_id(ctx, 1)).toBe(-1);
    });
  });
});
