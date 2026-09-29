import { describe, expect, it } from "vitest";
import { Scene } from "../Scene.js";
import { definePrefab } from "../Prefab.js";
import {
  getGmlVar,
  setGmlVar,
  hasGmlVar,
  clearGmlInstanceVars,
} from "../compat/gmlInstanceVars.js";
import type { GmlActionContext } from "../compat/gmlActions.js";

function makeCtx(scene: Scene): GmlActionContext {
  return { scene };
}

// ---------------------------------------------------------------------------
// A GML instance's implicit (undeclared-`var`) field — e.g. `cam =
// view_camera[0];` in a Create event, read back by name in Step — must
// persist for the whole entity lifetime, the same way a real GameMaker
// instance variable does. This is what compat/gmlInstanceVars.ts provides;
// see its own doc comment for the real, confirmed regression (a real project
// Backup's obj_camera) this fixes.
// ---------------------------------------------------------------------------

describe("GmlInstanceVars (getGmlVar/setGmlVar)", () => {
  it("persists a value set in one call and read back in a later, separate call — the real cross-event persistence gap this fixes", () => {
    const scene = new Scene();
    const prefab = definePrefab("Thing", []);
    const entity = scene.spawn(prefab);
    const ctx = makeCtx(scene);

    // Simulates a Create event...
    setGmlVar(entity, ctx, "cam", 42);
    // ...and a later Step event reading it back, as two independent calls.
    expect(getGmlVar(entity, ctx, "cam")).toBe(42);
  });

  it("returns undefined for a name that was never set", () => {
    const scene = new Scene();
    const prefab = definePrefab("Thing", []);
    const entity = scene.spawn(prefab);
    const ctx = makeCtx(scene);
    expect(getGmlVar(entity, ctx, "never_set")).toBeUndefined();
    expect(hasGmlVar(entity, ctx, "never_set")).toBe(false);
  });

  it("keeps two entities' same-named instance variable fully independent", () => {
    const scene = new Scene();
    const prefab = definePrefab("Thing", []);
    const a = scene.spawn(prefab);
    const b = scene.spawn(prefab);
    const ctx = makeCtx(scene);

    setGmlVar(a, ctx, "shake_remain", 5);
    setGmlVar(b, ctx, "shake_remain", 9);
    expect(getGmlVar(a, ctx, "shake_remain")).toBe(5);
    expect(getGmlVar(b, ctx, "shake_remain")).toBe(9);
  });

  it("supports arbitrary value types, not just numbers — a real GML instance field can hold any type", () => {
    const scene = new Scene();
    const prefab = definePrefab("Thing", []);
    const entity = scene.spawn(prefab);
    const ctx = makeCtx(scene);

    setGmlVar(entity, ctx, "follow", entity);
    setGmlVar(entity, ctx, "label", "hello");
    expect(getGmlVar(entity, ctx, "follow")).toBe(entity);
    expect(getGmlVar(entity, ctx, "label")).toBe("hello");
  });

  it("clearGmlInstanceVars (called from Scene.destroy) prevents a pooled entity's reused id from inheriting stale values", () => {
    const scene = new Scene();
    const prefab = definePrefab("Thing", []);
    const entity = scene.spawn(prefab, undefined, { pool: true });
    const ctx = makeCtx(scene);
    setGmlVar(entity, ctx, "cam", 100);

    scene.destroy(entity);
    // Same World; a pooled entity's bitECS id is never released back to
    // bitECS's own recycling, so a fresh spawn from the same prefab reuses
    // this exact eid — clearGmlInstanceVars (wired into Scene.destroy) must
    // have already wiped it, or the new occupant would inherit the old
    // instance's stale "cam" value.
    const respawned = scene.spawn(prefab, undefined, { pool: true });
    expect(respawned.eid).toBe(entity.eid);
    expect(hasGmlVar(respawned, ctx, "cam")).toBe(false);
  });

  it("clearGmlInstanceVars is a safe no-op for an entity/world with nothing stored", () => {
    const scene = new Scene();
    expect(() => clearGmlInstanceVars(scene.world, 999)).not.toThrow();
  });
});
