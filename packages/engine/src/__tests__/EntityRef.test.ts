import { describe, it, expect } from "vitest";
import {
  Scene,
  defineComponent,
  definePrefab,
  NO_REF,
  isEntityRef,
  type EntityRef,
} from "../index.js";

const Target = defineComponent("RefTestTarget", () => ({
  who: { $ref: 0 } as EntityRef,
}));
const Tag = defineComponent("RefTestTag", () => ({ n: 0 }));

describe("EntityRef", () => {
  it("idOf is stable, monotonic and lazy", () => {
    const scene = new Scene();
    const a = scene.spawn();
    const b = scene.spawn();
    const idB = scene.idOf(b);
    const idA = scene.idOf(a);
    expect(idB).toBe(1);
    expect(idA).toBe(2);
    expect(scene.idOf(a)).toBe(idA);
    expect(a.ref()).toEqual({ $ref: idA });
    expect(scene.refTo(b)).toEqual({ $ref: idB });
  });

  it("ids are never reused after destroy", () => {
    const scene = new Scene();
    const a = scene.spawn();
    const idA = scene.idOf(a);
    scene.destroy(a);
    const b = scene.spawn();
    expect(scene.idOf(b)).toBeGreaterThan(idA);
  });

  it("resolve returns the live entity and undefined for NO_REF/unknown", () => {
    const scene = new Scene();
    const a = scene.spawn();
    expect(scene.resolve(a.ref())?.eid).toBe(a.eid);
    expect(scene.resolve(NO_REF)).toBeUndefined();
    expect(scene.resolve({ $ref: 999 })).toBeUndefined();
    expect(scene.resolve(undefined)).toBeUndefined();
  });

  it("resolve of a destroyed entity is undefined", () => {
    const scene = new Scene();
    const a = scene.spawn();
    const ref = a.ref();
    scene.destroy(a);
    expect(scene.resolve(ref)).toBeUndefined();
  });

  it("pooled destroy invalidates the ref even though the handle stays alive", () => {
    const scene = new Scene();
    const proto = definePrefab("RefPooled", [{ def: Tag }]);
    const a = scene.spawn(proto, undefined, { pool: true });
    const ref = a.ref();
    scene.destroy(a);
    expect(a.isAlive).toBe(true);
    expect(scene.resolve(ref)).toBeUndefined();
    const b = scene.spawn(proto, undefined, { pool: true });
    expect(b.eid).toBe(a.eid);
    expect(scene.resolve(ref)).toBeUndefined();
    expect(b.ref().$ref).not.toBe(ref.$ref);
  });

  it("throws for destroyed or foreign entities", () => {
    const s1 = new Scene();
    const s2 = new Scene();
    const a = s1.spawn();
    expect(() => s2.idOf(a)).toThrow();
    s1.destroy(a);
    expect(() => a.ref()).toThrow();
  });

  it("a component holding a ref survives a JSON round trip", () => {
    const scene = new Scene();
    const a = scene.spawn();
    const b = scene.spawn();
    a.add(Target, { who: b.ref() });
    const json = JSON.stringify({ ...a.get(Target) });
    const parsed = JSON.parse(json) as { who: unknown };
    expect(isEntityRef(parsed.who)).toBe(true);
    expect(scene.resolve(parsed.who as EntityRef)?.eid).toBe(b.eid);
  });
});
