import { describe, it, expect, beforeEach } from "vitest";
import { Scene } from "../Scene.js";
import { CameraSystem } from "../systems/CameraSystem.js";
import type { GmlActionContext } from "../compat/gmlActions.js";
import type { GmlCameraContext } from "../compat/gmlCamera.js";
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
  clearGmlCameraState,
  _getGmlCameraHandle,
} from "../compat/gmlCamera.js";

function makeCtx(camera?: CameraSystem): GmlCameraContext {
  const scene = new Scene();
  const base: GmlActionContext = { scene };
  return camera === undefined ? { ...base } : { ...base, camera };
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
});
