import { describe, expect, it } from "vitest";
import { scanImplicitVarsInText } from "../project-symbols.js";

const scalars = (t: string) => [...scanImplicitVarsInText(t).scalars].sort();
const arrays = (t: string) => [...scanImplicitVarsInText(t).arrays].sort();

describe("scanImplicitVarsInText", () => {
  it("statement boundaries: brace-less if/else, case labels, same-line blocks, then, for headers", () => {
    expect(scalars("if (a) m = 1; else n = 2;")).toEqual(["m", "n"]);
    expect(
      scalars("switch (t) { case 1: res = 5; break; default: res = 0; }"),
    ).toEqual(["res"]);
    expect(scalars("if (z) { vsp = 0; grav = 0; }")).toEqual(["grav", "vsp"]);
    expect(scalars("if a then p = 1")).toEqual(["p"]);
    expect(scalars("for (i = 0; i < 3; i++) { j = i; }")).toEqual(["i", "j"]);
  });

  it("excludes var/static/globalvar locals, parameters, comparisons and compound assignments", () => {
    expect(
      scalars("var a = 1, b = 2;\nvar c,\n  d = 4;\nhp = a + b + c + d;"),
    ).toEqual(["hp"]);
    expect(scalars("function f(p) { p = 1; q = 2; }")).toEqual(["q"]);
    expect(scalars("static s = 0; s = s + 1; globalvar g; g = 1;")).toEqual([]);
    expect(scalars("if (a == b) { ok = true; } cnt += 1; n2++;")).toEqual([
      "ok",
    ]);
  });

  it("keeps the historical contract: built-in, asset-like, with-body and constructor targets are all reported", () => {
    expect(scalars("speed = 4; sprite_index = 3;")).toEqual(
      ["speed", "sprite_index"].sort(),
    );
    expect(scalars("with (obj_x) { boss = other.id; }")).toEqual(["boss"]);
    expect(scalars("function C() constructor { field = 1; }")).toEqual([
      "field",
    ]);
  });

  it("ignores comments, strings, enum members and dotted targets", () => {
    expect(
      scalars(
        '// c = 1;\n/* d = 2; */ s = "e = 3;"; self.f = 1; o.g = 2; enum E { H = 1 }',
      ),
    ).toEqual(["s"]);
  });

  it("reserved JS/GML words are never implicit variables", () => {
    expect(scalars("class = 1; yield = 2; real = 3;")).toEqual(["real"]);
  });

  it("arrays: first-use indexed assignment, nested index, but not ds_list/ds_map accessors or compound ops", () => {
    expect(
      arrays(
        'grid[0] = 1;\nm[1][2] = 3;\nlist[| 0] = 2;\nmap[? "k"] = 3;\nz[0] += 1;',
      ),
    ).toEqual(["grid", "m"]);
    expect(arrays("var loc; loc[0] = 1; own[0] = 2;")).toEqual(["own"]);
  });

  it("legacy compat: [# and [$ accessors count as array-like, as the regex scan did", () => {
    expect(arrays('g[# 1, 2] = 3; s[$ "k"] = 4;')).toEqual(["g", "s"]);
  });

  it("return/throw arguments never define variables (= is a comparison there)", () => {
    expect(scalars("return a = b;")).toEqual([]);
  });

  it("recovery: an assignment inside a statement the parser had to skip is still reported", () => {
    expect(
      scalars(
        "x = = = ;\nwhile ((\n mywall = instance_create_layer(1, 2);\nlate = 5;",
      ),
    ).toEqual(expect.arrayContaining(["late", "x"]));
  });
});
