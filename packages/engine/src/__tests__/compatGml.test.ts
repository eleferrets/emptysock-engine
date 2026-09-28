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
    expect(json_decode(json_encode(value))).toEqual(value);
  });

  it("base64_encode/base64_decode round-trips a plain string", () => {
    const str = "hello, world! GML save data 123";
    expect(base64_decode(base64_encode(str))).toBe(str);
  });

  it("base64_encode/base64_decode round-trips a real json_encode payload (the real save-file chain)", () => {
    const value = { hp: 10, x: 1.5, dead: false };
    const encoded = base64_encode(json_encode(value));
    const decoded = json_decode(base64_decode(encoded));
    expect(decoded).toEqual(value);
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
