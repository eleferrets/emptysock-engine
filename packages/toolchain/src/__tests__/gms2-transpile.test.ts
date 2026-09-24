import { describe, expect, it } from "vitest";
import { transpileGML } from "../gms2-transpile.js";

describe("transpileGML", () => {
  it("does not emit `export` inside a function body for a global assignment", () => {
    const out = transpileGML("global.kills = 1;");
    expect(out).not.toContain("export let");
    expect(out).toContain('TODO: migrate GML global variable "kills"');
  });

  it("handles a global assignment reached via a non-`;`-terminated expr", () => {
    const out = transpileGML("global.kills = file_text_read_real(file);");
    expect(out).not.toContain("export");
  });

  it("keeps instance_create_layer valid when used as a sub-expression", () => {
    // A real GML shape: passed straight into `with(...)`, not as its own
    // standalone statement.
    const out = transpileGML(
      'with (instance_create_layer(x, y, "Instances", obj_x))\n{\n  foo = 1;\n}',
    );
    // Must not produce a bare `//` line comment sitting inside an argument
    // list — that would comment out everything after it on the line.
    expect(out).not.toMatch(/\(\s*\/\//);
  });

  it("rewrites a GML with(...) block instead of emitting the reserved `with` keyword", () => {
    const out = transpileGML("with (other_instance) { x = 1; }");
    // Strip the explanatory comment before asserting: the message itself
    // legitimately mentions "with (" as plain text.
    const code = out.replace(/\/\*.*?\*\//gs, "");
    expect(code).not.toMatch(/\bwith\s*\(/);
    expect(out).toContain("if (true)");
  });

  it("wraps an if condition chained with bare && / || GML allows without an outer paren", () => {
    const out = transpileGML("if (a < b) && (c > d)\n{\n  foo();\n}");
    expect(out).toContain("if ((a < b) && (c > d))");
  });

  it("converts the GML `div` integer-division operator", () => {
    const out = transpileGML("x = (a - b) div (c * 1.5);");
    expect(out).toContain("Math.floor((a - b) / (c * 1.5))");
  });

  it("rewrites #region/#endregion so they don't break TS parsing", () => {
    const out = transpileGML("#region Foo\nx = 1;\n#endregion");
    expect(out).not.toMatch(/^#region/m);
    expect(out).not.toMatch(/^#endregion/m);
    expect(out).toContain("// #region Foo");
    expect(out).toContain("// #endregion");
  });

  it("does not conflate a global comparison (==) with an assignment", () => {
    const out = transpileGML("if (global.hasgun == false) instance_destroy();");
    // Must not garble into "= = false" — the second `=` of `==` used to
    // get swallowed into the captured right-hand-side expression text.
    expect(out).not.toContain("= = ");
  });

  it("wraps an if chain whose clause has a nested function call operand", () => {
    const out = transpileGML(
      "if (point_distance(a, 0) > 0.2) || (point_distance(b, 0) > 0.2)\n{\n  foo();\n}",
    );
    expect(out).toContain(
      "if ((point_distance(a, 0) > 0.2) || (point_distance(b, 0) > 0.2))",
    );
  });

  it("wraps a bare (unparenthesised) if condition anchored by a following brace", () => {
    const out = transpileGML(
      "if place_meeting(x, y, obj_wall)\n{\n  foo();\n}",
    );
    expect(out).toContain("if (place_meeting(x, y, obj_wall))");
  });

  it("wraps a bare if !expr condition (not just the already-parenthesised if !(expr) case)", () => {
    const out = transpileGML(
      "if !place_meeting(x, y, obj) && cond2\n{\n  foo();\n}",
    );
    expect(out).toContain("if (!place_meeting(x, y, obj) && cond2)");
  });

  it("does not treat the word 'if' inside a // comment as a condition to wrap", () => {
    const gml =
      "// checking if we are within range\nif (a) && (b)\n{\n  foo();\n}";
    const out = transpileGML(gml);
    // The comment text itself must survive unmangled, and the real `if`
    // below it must still get its own, separate, correct wrap.
    expect(out).toContain("// checking if we are within range");
    expect(out).toContain("if ((a) && (b))");
  });

  it("converts the GML `mod` operator", () => {
    const out = transpileGML("x = a mod b;");
    expect(out).toContain("(a % b)");
  });

  it("neutralises a real, closed block comment before any other pass runs", () => {
    // A real GML block comment can itself contain code this transpiler
    // would otherwise rewrite (e.g. room_goto) — rewriting text that's
    // actually still inside a not-yet-neutralised source comment risks a
    // nested /* */ comment, which is invalid JS/TS.
    const out = transpileGML("/* room_goto(target); */\nx = 1;");
    expect(out).not.toContain("room_goto");
    expect(out).toContain("[GML comment/dead code omitted]");
    expect(out).toContain("x = 1;");
  });

  it("reports a whole-file unterminated block comment as inert instead of transpiling it", () => {
    const out = transpileGML("/* this whole event was disabled\nx = 1;");
    expect(out).not.toContain("x = 1");
    expect(out).toMatch(/entirely inert/);
  });

  it("keeps room_goto/audio_play_sound/draw_sprite valid as an unbraced if-body", () => {
    const out = transpileGML("if (cond) room_goto(rm_next);");
    // Must not leave the `if` with no statement body at all.
    expect(out).toMatch(/if \(cond\)\s*\(undefined/);
  });

  it("handles audio_play_sound with a nested-call first argument", () => {
    const out = transpileGML(
      "audio_play_sound(choose(snd_a, snd_b), 1, false);",
    );
    expect(out).not.toMatch(/\(\s*\/\//);
  });
});
