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
});
