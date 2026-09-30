import { describe, it, expect } from "vitest";
import { CameraSystem } from "../systems/CameraSystem.js";

describe("CameraSystem", () => {
  it("initial state is origin, zoom 1", () => {
    const cam = new CameraSystem();
    const s = cam.state;
    expect(s.x).toBe(0);
    expect(s.y).toBe(0);
    expect(s.zoom).toBe(1);
    expect(s.rotation).toBe(0);
  });

  it("moveTo + update lerps toward target", () => {
    const cam = new CameraSystem();
    cam.setLerpFactor(1); // instant snap
    cam.moveTo(100, 200);
    cam.update(0.016);
    expect(cam.state.x).toBeCloseTo(100);
    expect(cam.state.y).toBeCloseTo(200);
  });

  it("zoomTo + update lerps zoom", () => {
    const cam = new CameraSystem();
    cam.setLerpFactor(1);
    cam.zoomTo(2);
    cam.update(0.016);
    expect(cam.state.zoom).toBeCloseTo(2);
  });

  it("zoomTo clamps to 0.1 minimum", () => {
    const cam = new CameraSystem();
    cam.setLerpFactor(1);
    cam.zoomTo(-5);
    cam.update(0.016);
    // With lerpFactor=1: new zoom = 1 + (0.1 - 1) * 1 = 0.1, floating-point may be 0.09999...
    expect(cam.state.zoom).toBeCloseTo(0.1, 5);
  });

  it("shake does not throw", () => {
    const cam = new CameraSystem();
    expect(() => cam.shake(10, 0.5)).not.toThrow();
    cam.update(0.016);
  });

  it("attach with null stage does not crash on update", () => {
    const cam = new CameraSystem();
    cam.moveTo(50, 50);
    expect(() => cam.update(0.016)).not.toThrow();
  });
});
