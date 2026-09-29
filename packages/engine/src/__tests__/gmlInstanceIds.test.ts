import { describe, it, expect } from "vitest";
import { Scene } from "../Scene.js";
import { Meta } from "../components/Meta.js";
import { Transform } from "../components/Transform.js";
import type { GmlActionContext } from "../compat/gmlActions.js";
import { setGmlVar } from "../compat/gmlInstanceVars.js";
import {
  gmlInstanceId,
  gmlInstanceFromId,
  getGmlRefVar,
  getGmlEntityField,
  GML_INSTANCE_ID_BASE,
} from "../compat/gmlCrossInstance.js";
import {
  instance_find,
  instance_nearest,
  instance_furthest,
} from "../compat/gmlCollisionQueries.js";

function make(scene: Scene, name: string, x: number, y: number) {
  const e = scene.spawn();
  e.add(Meta, { name });
  e.add(Transform, { x, y });
  return e;
}

describe("gml instance ids and instance_find", () => {
  it("numeric id round trips and is above the base", () => {
    const scene = new Scene();
    const ctx: GmlActionContext = { scene };
    const a = make(scene, "obj_a", 0, 0);
    const id = gmlInstanceId(a);
    expect(id).toBeGreaterThan(GML_INSTANCE_ID_BASE);
    expect(gmlInstanceId(a)).toBe(id);
    expect(gmlInstanceFromId(ctx, id)?.eid).toBe(a.eid);
    expect(gmlInstanceFromId(ctx, 5)).toBeUndefined();
    scene.destroy(a);
    expect(gmlInstanceFromId(ctx, id)).toBeUndefined();
  });

  it("a var holding a numeric id or EntityRef reads through ref.field; dangling is undefined", () => {
    const scene = new Scene();
    const ctx: GmlActionContext = { scene };
    const t = make(scene, "obj_t", 7, 8);
    const holder = scene.spawn();
    setGmlVar(holder, ctx, "tgt", gmlInstanceId(t));
    expect(getGmlRefVar(holder, ctx, "tgt", "x")).toBe(7);
    setGmlVar(holder, ctx, "tgt", t.ref());
    expect(getGmlRefVar(holder, ctx, "tgt", "y")).toBe(8);
    expect(getGmlEntityField(ctx, gmlInstanceId(t), "x")).toBe(7);
    scene.destroy(t);
    expect(getGmlRefVar(holder, ctx, "tgt", "x")).toBeUndefined();
  });

  it("instance_find indexes instances of a type; out of range is noone", () => {
    const scene = new Scene();
    const ctx: GmlActionContext = { scene };
    const c = scene.spawn();
    const a0 = make(scene, "obj_a", 0, 0);
    const a1 = make(scene, "obj_a", 10, 0);
    make(scene, "obj_b", 5, 5);
    expect(instance_find(c, ctx, "obj_a", 0)).toMatchObject({ eid: a0.eid });
    expect(instance_find(c, ctx, "obj_a", 1)).toMatchObject({ eid: a1.eid });
    expect(instance_find(c, ctx, "obj_a", 2)).toBe("noone");
    expect(instance_find(c, ctx, "all", 2)).not.toBe("noone");
    expect(instance_find(c, ctx, "noone", 0)).toBe("noone");
  });

  it("instance_nearest and instance_furthest pick by distance", () => {
    const scene = new Scene();
    const ctx: GmlActionContext = { scene };
    const c = scene.spawn();
    const near = make(scene, "obj_a", 1, 0);
    const far = make(scene, "obj_a", 100, 0);
    expect(instance_nearest(c, ctx, 0, 0, "obj_a")).toMatchObject({
      eid: near.eid,
    });
    expect(instance_furthest(c, ctx, 0, 0, "obj_a")).toMatchObject({
      eid: far.eid,
    });
    expect(instance_nearest(c, ctx, 0, 0, "obj_zzz")).toBe("noone");
  });
});
