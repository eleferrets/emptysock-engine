import { describe, it, expect } from "vitest";
import { Scene } from "../Scene.js";
import { Meta } from "../components/Meta.js";
import { Transform } from "../components/Transform.js";
import type { GmlActionContext } from "../compat/gmlActions.js";
import { setGmlVar } from "../compat/gmlInstanceVars.js";
import {
  getGmlObjectVar,
  setGmlObjectVar,
} from "../compat/gmlCrossInstance.js";

describe("gmlCrossInstance", () => {
  it("getGmlObjectVar reads a generic field off the first live instance of that object type", () => {
    const scene = new Scene();
    const ctx: GmlActionContext = { scene };
    const target = scene.spawn();
    target.add(Meta, { name: "obj_input" });
    setGmlVar(target, ctx, "key_down", true);

    const reader = scene.spawn();
    expect(getGmlObjectVar(reader, ctx, "obj_input", "key_down")).toBe(true);
  });

  it("setGmlObjectVar writes a generic field onto the first live instance of that object type", () => {
    const scene = new Scene();
    const ctx: GmlActionContext = { scene };
    const target = scene.spawn();
    target.add(Meta, { name: "obj_player" });

    const writer = scene.spawn();
    setGmlObjectVar(writer, ctx, "obj_player", "hsp", 4);
    expect(getGmlObjectVar(writer, ctx, "obj_player", "hsp")).toBe(4);
  });

  it("x/y route through the real Transform component, not the generic side-table", () => {
    const scene = new Scene();
    const ctx: GmlActionContext = { scene };
    const target = scene.spawn();
    target.add(Meta, { name: "obj_player" });
    target.add(Transform, { x: 10, y: 20 });

    const reader = scene.spawn();
    expect(getGmlObjectVar(reader, ctx, "obj_player", "x")).toBe(10);
    expect(getGmlObjectVar(reader, ctx, "obj_player", "y")).toBe(20);

    setGmlObjectVar(reader, ctx, "obj_player", "x", 99);
    expect(target.get(Transform)?.x).toBe(99);
  });

  it("getGmlObjectVar returns undefined for an object type with no live instance", () => {
    const scene = new Scene();
    const ctx: GmlActionContext = { scene };
    const reader = scene.spawn();
    expect(
      getGmlObjectVar(reader, ctx, "obj_nothing", "field"),
    ).toBeUndefined();
  });

  it("setGmlObjectVar honestly no-ops (does not throw) for an object type with no live instance", () => {
    const scene = new Scene();
    const ctx: GmlActionContext = { scene };
    const writer = scene.spawn();
    expect(() =>
      setGmlObjectVar(writer, ctx, "obj_nothing", "field", 1),
    ).not.toThrow();
  });
});
