import { describe, it, expect } from "vitest";
import {
  json_encode,
  json_decode,
  base64_encode,
  base64_decode,
  point_in_circle,
  is_string,
  is_undefined,
  window_set_cursor,
  window_get_cursor,
  cr_none,
  cr_default,
  get_timer,
  sin,
  cos,
  tan,
  sqrt,
  power,
  string_insert,
} from "../compat/gml.js";

describe("compat/gml.ts — JSON/base64 round trips", () => {
  it("json_encode/json_decode round-trips a plain struct", () => {
    const value = { hp: 5, name: "player", tags: [1, 2, 3] };
    const m = json_decode(json_encode(value));
    expect(m).toBeInstanceOf(Map);
    expect(m.get("hp")).toBe(5);
    expect(m.get("tags")).toEqual([1, 2, 3]);
    // A Map (GML ds_map) re-encodes to the same JSON.
    expect(json_encode(m)).toBe(json_encode(value));
  });

  it("base64_encode/base64_decode round-trips a plain string", () => {
    const str = "hello, world! GML save data 123";
    expect(base64_decode(base64_encode(str))).toBe(str);
  });

  it("base64_encode/base64_decode round-trips a real json_encode payload (the real save-file chain)", () => {
    const value = { hp: 10, x: 1.5, dead: false };
    const encoded = base64_encode(json_encode(value));
    const decoded = json_decode(base64_decode(encoded));
    expect(decoded.get("x")).toBe(1.5);
    expect(decoded.get("dead")).toBe(false);
  });

  it("base64 round-trips strings whose length isn't a multiple of 3", () => {
    for (const s of ["a", "ab", "abc", "abcd", ""]) {
      expect(base64_decode(base64_encode(s))).toBe(s);
    }
  });
});

describe("compat/gml.ts — misc built-ins", () => {
  it("point_in_circle is a real geometric containment test", () => {
    expect(point_in_circle(0, 0, 0, 0, 5)).toBe(true);
    expect(point_in_circle(10, 0, 0, 0, 5)).toBe(false);
    expect(point_in_circle(5, 0, 0, 0, 5)).toBe(true);
  });

  it("is_string/is_undefined are real runtime type checks", () => {
    expect(is_string("x")).toBe(true);
    expect(is_string(1)).toBe(false);
    expect(is_undefined(undefined)).toBe(true);
    expect(is_undefined(0)).toBe(false);
  });

  it("window_set_cursor/window_get_cursor round-trip whatever was stored", () => {
    window_set_cursor(cr_none);
    expect(window_get_cursor()).toBe(cr_none);
    window_set_cursor(cr_default);
    expect(window_get_cursor()).toBe(cr_default);
  });

  it("get_timer returns a real, monotonically non-decreasing elapsed value", () => {
    const a = get_timer();
    const b = get_timer();
    expect(b).toBeGreaterThanOrEqual(a);
  });

  it("sin/cos/tan operate in radians, not degrees (unlike lengthdir_x/_y)", () => {
    expect(sin(0)).toBeCloseTo(0);
    expect(sin(Math.PI / 2)).toBeCloseTo(1);
    expect(cos(0)).toBeCloseTo(1);
    expect(cos(Math.PI)).toBeCloseTo(-1);
    expect(tan(0)).toBeCloseTo(0);
  });

  it("sqrt/power are plain, exact wrappers", () => {
    expect(sqrt(16)).toBe(4);
    expect(power(2, 10)).toBe(1024);
  });

  it("string_insert inserts at a 1-based index, clamping a low index to the start", () => {
    expect(string_insert("> ", "hello", 0)).toBe("> hello");
    expect(string_insert("XX", "hello", 3)).toBe("heXXllo");
  });
});

describe("gmlNum", () => {
  it("coerces numbers, booleans, numeric strings and nullish; passes text and objects through", async () => {
    const { gmlNum } = await import("../compat/gmlInstanceVars.js");
    expect(gmlNum(5)).toBe(5);
    expect(gmlNum(undefined)).toBe(0);
    expect(gmlNum(null)).toBe(0);
    expect(gmlNum(true)).toBe(1);
    expect(gmlNum("12.5")).toBe(12.5);
    expect(gmlNum("hello")).toBe("hello");
    expect(gmlNum("")).toBe("");
    const m = new Map();
    expect(gmlNum(m)).toBe(m);
    const a = [1, 2];
    expect(gmlNum(a)).toBe(a);
  });
});

describe("gmlNum end-to-end with a stored sprite path", () => {
  it("does not break a stored sprite-path comparison", async () => {
    const { gmlNum, setGmlVar, getGmlVar } =
      await import("../compat/gmlInstanceVars.js");
    const { Scene } = await import("../Scene.js");
    const { definePrefab } = await import("../Prefab.js");
    const path = "./assets/sprites/spr_x/frame_0.png";
    const scene = new Scene();
    const entity = scene.spawn(definePrefab("Thing", []));
    const ctx = { scene };
    setGmlVar(entity, ctx, "spr", path);
    // Mirrors the transpiled `spr == spr_x` read: gmlNum(getGmlVar(...)).
    expect((gmlNum(getGmlVar(entity, ctx, "spr")) as unknown) === path).toBe(
      true,
    );
    expect((gmlNum(getGmlVar(entity, ctx, "spr")) as unknown) == 0).toBe(false);
    // Documents the numeric-looking-name edge: it coerces.
    expect(gmlNum("1e3")).toBe(1000);
  });
});

describe("json_decode on invalid input", () => {
  it("returns an empty map instead of throwing", async () => {
    const { json_decode } = await import("../compat/gml.js");
    const m = json_decode("");
    expect(m).toBeInstanceOf(Map);
    expect(m.size).toBe(0);
    expect(json_decode("{not json").size).toBe(0);
  });
});
