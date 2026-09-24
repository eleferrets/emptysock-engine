import { describe, expect, it } from "vitest";
import { Scene } from "../Scene.js";
import { Projection3D } from "../components/Projection3D.js";
import {
  clearGmlProjectionState,
  d3d_set_projection_ortho,
  d3d_set_projection_perspective,
  d3d_transform_clear,
  d3d_transform_set_identity,
  d3d_transform_set_rotation_x,
  d3d_transform_set_rotation_y,
  d3d_transform_set_rotation_z,
  d3d_transform_set_scaling,
  d3d_transform_set_translation,
} from "../compat/gmlProjection.js";

/**
 * These expected values are hand-derived from the exact same, unambiguous
 * math `gmlProjection.ts`'s own doc comments claim: a plain axis-aligned
 * translation/rotation of a corner quad (or, for
 * `d3d_set_projection_perspective`, a trapezoid with a fixed
 * `PERSPECTIVE_FAR_SCALE`), rotated with the standard 2D rotation matrix
 * `rotateAround()` documents (screen-space, clockwise-positive). Every case
 * below was computed independently of the implementation (by hand, using
 * `cos`/`sin` at angles chosen so the trig terms are exact or
 * floating-point-negligible: 0°, 90°, 45°, 30°, 180°) and only then compared
 * against `Projection3D`'s resulting corners — this is what actually
 * exercises whether the code's trig is right, not just self-consistent.
 */
function readCorners(entity: ReturnType<Scene["spawn"]>) {
  const proj = entity.get(Projection3D);
  if (proj === undefined) throw new Error("expected a Projection3D");
  return {
    x0: proj.x0,
    y0: proj.y0,
    x1: proj.x1,
    y1: proj.y1,
    x2: proj.x2,
    y2: proj.y2,
    x3: proj.x3,
    y3: proj.y3,
  };
}

describe("compat/gmlProjection.ts", () => {
  it("d3d_transform_set_translation moves the default 100x100 quad by (x, y), z accepted but inert", () => {
    const scene = new Scene();
    const entity = scene.spawn();
    d3d_transform_set_translation(entity, 50, 30, 999);

    expect(readCorners(entity)).toEqual({
      x0: 50,
      y0: 30,
      x1: 150,
      y1: 30,
      x2: 150,
      y2: 130,
      x3: 50,
      y3: 130,
    });
    expect(entity.get(Projection3D)?.active).toBe(true);
  });

  it("d3d_transform_set_rotation_z(90) rotates a 100x100 quad exactly 90 degrees about its own centre", () => {
    const scene = new Scene();
    const entity = scene.spawn();
    d3d_transform_set_rotation_z(entity, 90);

    // Hand-derived: rotating (0,0),(100,0),(100,100),(0,100) about (50,50)
    // by 90 degrees clockwise-positive (screen space) maps
    // top-left -> former top-right corner's position, etc.
    const c = readCorners(entity);
    expect(c.x0).toBeCloseTo(100, 5);
    expect(c.y0).toBeCloseTo(0, 5);
    expect(c.x1).toBeCloseTo(100, 5);
    expect(c.y1).toBeCloseTo(100, 5);
    expect(c.x2).toBeCloseTo(0, 5);
    expect(c.y2).toBeCloseTo(100, 5);
    expect(c.x3).toBeCloseTo(0, 5);
    expect(c.y3).toBeCloseTo(0, 5);
  });

  it("d3d_transform_set_rotation_x approximates tilt as a cos(angle) shrink of the top (far) edge, centred", () => {
    const scene = new Scene();
    const entity = scene.spawn();
    d3d_transform_set_rotation_x(entity, 45);

    // shrink = |cos(45deg)| = 0.70710678..., inset = 100*(1-shrink)/2
    const shrink = Math.cos((45 * Math.PI) / 180);
    const inset = (100 * (1 - shrink)) / 2;
    const c = readCorners(entity);
    expect(c.x0).toBeCloseTo(inset, 5);
    expect(c.y0).toBeCloseTo(0, 5);
    expect(c.x1).toBeCloseTo(100 - inset, 5);
    expect(c.y1).toBeCloseTo(0, 5);
    // Bottom (near) edge stays full width — only the far edge recedes.
    expect(c.x2).toBeCloseTo(100, 5);
    expect(c.y2).toBeCloseTo(100, 5);
    expect(c.x3).toBeCloseTo(0, 5);
    expect(c.y3).toBeCloseTo(100, 5);
  });

  it("d3d_transform_set_rotation_y applies the same cos(angle) shrink to the left edge instead", () => {
    const scene = new Scene();
    const entity = scene.spawn();
    d3d_transform_set_rotation_y(entity, 30);

    const shrink = Math.cos((30 * Math.PI) / 180);
    const inset = (100 * (1 - shrink)) / 2;
    const c = readCorners(entity);
    expect(c.x0).toBeCloseTo(0, 5);
    expect(c.y0).toBeCloseTo(inset, 5);
    expect(c.x1).toBeCloseTo(100, 5);
    expect(c.y1).toBeCloseTo(0, 5);
    expect(c.x2).toBeCloseTo(100, 5);
    expect(c.y2).toBeCloseTo(100, 5);
    expect(c.x3).toBeCloseTo(0, 5);
    expect(c.y3).toBeCloseTo(100 - inset, 5);
  });

  it("d3d_transform_set_scaling scales the quad about its origin corner", () => {
    const scene = new Scene();
    const entity = scene.spawn();
    d3d_transform_set_scaling(entity, 2, 0.5, 123);

    expect(readCorners(entity)).toEqual({
      x0: 0,
      y0: 0,
      x1: 200,
      y1: 0,
      x2: 200,
      y2: 50,
      x3: 0,
      y3: 50,
    });
  });

  it("a combined call (rotation, then translation) REPLACES the transform rather than composing it, matching real GameMaker d3d_transform_set_* semantics", () => {
    const scene = new Scene();
    const entity = scene.spawn();
    d3d_transform_set_rotation_z(entity, 45);
    d3d_transform_set_translation(entity, 7, 11);

    // The translation call fully overwrites the prior rotation — the result
    // is exactly the plain, unrotated quad offset by (7, 11), never a
    // rotated-then-translated composite.
    expect(readCorners(entity)).toEqual({
      x0: 7,
      y0: 11,
      x1: 107,
      y1: 11,
      x2: 107,
      y2: 111,
      x3: 7,
      y3: 111,
    });
  });

  it("d3d_set_projection_perspective with a real angle produces a rotated trapezoid, verified by hand", () => {
    const scene = new Scene();
    const entity = scene.spawn();
    // width=200, height=100 -> inset = 200*(1-0.5)/2 = 50; unrotated raw
    // trapezoid corners: (50,0), (150,0), (200,100), (0,100). Rotated 180
    // degrees about the centre (100, 50): each point maps to its point
    // reflection through the centre.
    d3d_set_projection_perspective(entity, 0, 0, 200, 100, 180);

    const c = readCorners(entity);
    expect(c.x0).toBeCloseTo(150, 5); // reflect (50,0) through (100,50)
    expect(c.y0).toBeCloseTo(100, 5);
    expect(c.x1).toBeCloseTo(50, 5); // reflect (150,0)
    expect(c.y1).toBeCloseTo(100, 5);
    expect(c.x2).toBeCloseTo(0, 5); // reflect (200,100)
    expect(c.y2).toBeCloseTo(0, 5);
    expect(c.x3).toBeCloseTo(200, 5); // reflect (0,100)
    expect(c.y3).toBeCloseTo(0, 5);
  });

  it("d3d_set_projection_ortho(angle=0) is an exact, unrotated rectangle", () => {
    const scene = new Scene();
    const entity = scene.spawn();
    d3d_set_projection_ortho(entity, 10, 20, 80, 40);

    expect(readCorners(entity)).toEqual({
      x0: 10,
      y0: 20,
      x1: 90,
      y1: 20,
      x2: 90,
      y2: 60,
      x3: 10,
      y3: 60,
    });
  });

  it("d3d_transform_set_identity resets to the last known base quad size, untransformed and uncentred", () => {
    const scene = new Scene();
    const entity = scene.spawn();
    d3d_transform_set_translation(entity, 999, 999);
    d3d_transform_set_identity(entity);

    // Translation never changed the recorded base quad size (still the
    // 100x100 default), so identity resets to the plain 100x100 square at
    // the origin.
    expect(readCorners(entity)).toEqual({
      x0: 0,
      y0: 0,
      x1: 100,
      y1: 0,
      x2: 100,
      y2: 100,
      x3: 0,
      y3: 100,
    });
  });

  it("d3d_transform_set_identity resets using a size established by an earlier d3d_set_projection_* call", () => {
    const scene = new Scene();
    const entity = scene.spawn();
    d3d_set_projection_ortho(entity, 0, 0, 40, 60);
    d3d_transform_set_identity(entity);

    expect(readCorners(entity)).toEqual({
      x0: 0,
      y0: 0,
      x1: 40,
      y1: 0,
      x2: 40,
      y2: 60,
      x3: 0,
      y3: 60,
    });
  });

  it("d3d_transform_clear turns active off without touching stored corners", () => {
    const scene = new Scene();
    const entity = scene.spawn();
    d3d_transform_set_translation(entity, 5, 5);
    expect(entity.get(Projection3D)?.active).toBe(true);

    d3d_transform_clear(entity);
    expect(entity.get(Projection3D)?.active).toBe(false);
    // Corners themselves are untouched by clearing.
    expect(entity.get(Projection3D)?.x0).toBe(5);
  });

  it("d3d_transform_clear on an entity with no Projection3D is a safe no-op", () => {
    const scene = new Scene();
    const entity = scene.spawn();
    expect(() => d3d_transform_clear(entity)).not.toThrow();
    expect(entity.has(Projection3D)).toBe(false);
  });

  it("clearGmlProjectionState clears the per-entity base-quad side-table without throwing on re-derivation", () => {
    const scene = new Scene();
    const entity = scene.spawn();
    d3d_transform_set_scaling(entity, 3, 3);
    clearGmlProjectionState(entity);

    // A fresh d3d_transform_set_* call after clearing starts again from the
    // 100x100 default, not the previously-scaled 300x300 size.
    d3d_transform_set_identity(entity);
    expect(readCorners(entity)).toEqual({
      x0: 0,
      y0: 0,
      x1: 100,
      y1: 0,
      x2: 100,
      y2: 100,
      x3: 0,
      y3: 100,
    });
  });
});
