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
});
