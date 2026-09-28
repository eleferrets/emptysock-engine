import { describe, it, expect } from "vitest";
import { Scene } from "../Scene.js";
import { Meta } from "../components/Meta.js";
import { Transform } from "../components/Transform.js";
import type { GmlActionContext } from "../compat/gmlActions.js";
import { setGmlVar, getGmlVar } from "../compat/gmlInstanceVars.js";
import {
  getGmlObjectVar,
  setGmlObjectVar,
  getGmlRefVar,
  setGmlRefVar,
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

describe("gmlCrossInstance — local-variable-held instance references", () => {
  it("getGmlRefVar/setGmlRefVar resolve a local var's stored Entity, not by object-type scan", () => {
    const scene = new Scene();
    const ctx: GmlActionContext = { scene };
    const spawner = scene.spawn();
    const spawned = scene.spawn();
    setGmlVar(spawner, ctx, "my_gun", spawned);

    setGmlRefVar(spawner, ctx, "my_gun", "hp", 5);
    expect(getGmlRefVar(spawner, ctx, "my_gun", "hp")).toBe(5);
    // The written value lives on the *spawned* entity's own side-table,
    // not the spawner's.
    expect(getGmlVar(spawned, ctx, "hp")).toBe(5);
  });

  it("x/y route through the referenced entity's real Transform, not the generic side-table", () => {
    const scene = new Scene();
    const ctx: GmlActionContext = { scene };
    const spawner = scene.spawn();
    const spawned = scene.spawn();
    spawned.add(Transform, { x: 1, y: 2 });
    setGmlVar(spawner, ctx, "owner", spawned);

    setGmlRefVar(spawner, ctx, "owner", "x", 42);
    expect(spawned.get(Transform)?.x).toBe(42);
    expect(getGmlRefVar(spawner, ctx, "owner", "x")).toBe(42);
  });

  it("honestly no-ops when the local var never held a live Entity", () => {
    const scene = new Scene();
    const ctx: GmlActionContext = { scene };
    const spawner = scene.spawn();
    expect(getGmlRefVar(spawner, ctx, "never_set", "hp")).toBeUndefined();
    expect(() =>
      setGmlRefVar(spawner, ctx, "never_set", "hp", 1),
    ).not.toThrow();
  });

  it("honestly no-ops when the referenced entity was since destroyed", () => {
    const scene = new Scene();
    const ctx: GmlActionContext = { scene };
    const spawner = scene.spawn();
    const spawned = scene.spawn();
    setGmlVar(spawner, ctx, "my_gun", spawned);
    scene.destroy(spawned);
    expect(getGmlRefVar(spawner, ctx, "my_gun", "hp")).toBeUndefined();
  });
});
