import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildScriptModule, buildObjectBehavior } from "../gms2-codegen.js";
import { importGMS2Project } from "../gms2-import.js";

// ---------------------------------------------------------------------------
// buildScriptModule (formerly scriptStub, which emitted an empty
// placeholder for every GML user-defined script instead of transpiling its
// body). These tests prove real GML scripts actually get transpiled, with a
// real signature (declared parameters, or a legacy argumentN fallback),
// real return-type inference, and real cross-script/object-to-script import
// wiring.
// ---------------------------------------------------------------------------

describe("buildScriptModule", () => {
  it("transpiles a script with named parameters and a return value", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "gms2-script-"));
    try {
      const scriptDir = path.join(dir, "scripts", "scr_add");
      await fs.mkdir(scriptDir, { recursive: true });
      await fs.writeFile(
        path.join(scriptDir, "scr_add.gml"),
        `function scr_add(a, b) {\n  return a + b;\n}`,
        "utf-8",
      );

      const content = await buildScriptModule("scr_add", dir, ["scr_add"]);

      expect(content).toContain(
        "export function scr_add(a: unknown, b: unknown): unknown {",
      );
      expect(content).toContain("return a + b;");
      expect(content).not.toContain("TODO: migrate GML script body");
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it("falls back to a variadic signature and rewrites argumentN for a legacy (no `function` wrapper) script", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "gms2-script-legacy-"));
    try {
      const scriptDir = path.join(dir, "scripts", "scr_legacy_sum");
      await fs.mkdir(scriptDir, { recursive: true });
      await fs.writeFile(
        path.join(scriptDir, "scr_legacy_sum.gml"),
        `return argument0 + argument1;`,
        "utf-8",
      );

      const content = await buildScriptModule("scr_legacy_sum", dir, [
        "scr_legacy_sum",
      ]);

      expect(content).toContain(
        "export function scr_legacy_sum(...args: unknown[]): unknown {",
      );
      expect(content).toContain("return args[0] + args[1];");
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it("infers a void return type when the script body never returns a value", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "gms2-script-void-"));
    try {
      const scriptDir = path.join(dir, "scripts", "scr_log");
      await fs.mkdir(scriptDir, { recursive: true });
      await fs.writeFile(
        path.join(scriptDir, "scr_log.gml"),
        `function scr_log(msg) {\n  show_debug_message(msg);\n}`,
        "utf-8",
      );

      const content = await buildScriptModule("scr_log", dir, ["scr_log"]);
      expect(content).toContain(
        "export function scr_log(msg: unknown): void {",
      );
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it("emits a real import for a script-calls-script chain (a calls b calls c)", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "gms2-script-chain-"));
    try {
      const scripts: Record<string, string> = {
        scr_a: `function scr_a(x) {\n  return scr_b(x) + 1;\n}`,
        scr_b: `function scr_b(x) {\n  return scr_c(x) * 2;\n}`,
        scr_c: `function scr_c(x) {\n  return x;\n}`,
      };
      for (const [name, body] of Object.entries(scripts)) {
        const scriptDir = path.join(dir, "scripts", name);
        await fs.mkdir(scriptDir, { recursive: true });
        await fs.writeFile(path.join(scriptDir, `${name}.gml`), body, "utf-8");
      }
      const known = Object.keys(scripts);

      const aContent = await buildScriptModule("scr_a", dir, known);
      expect(aContent).toContain('import { scr_b } from "./scr_b.js";');
      expect(aContent).not.toContain("scr_c");

      const bContent = await buildScriptModule("scr_b", dir, known);
      expect(bContent).toContain('import { scr_c } from "./scr_c.js";');
      expect(bContent).not.toContain("scr_a");

      const cContent = await buildScriptModule("scr_c", dir, known);
      expect(cContent).not.toContain("import {");
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it("falls back to a stub honestly when the script's .gml is genuinely missing (stale/orphaned reference)", async () => {
    const dir = await fs.mkdtemp(
      path.join(os.tmpdir(), "gms2-script-missing-"),
    );
    try {
      const content = await buildScriptModule("scr_ghost", dir, ["scr_ghost"]);
      expect(content).toContain("TODO: migrate GML script body");
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});

describe("buildObjectBehavior imports scripts it calls", () => {
  it("emits a real import when an object event calls a known script", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "gms2-obj-script-"));
    try {
      const scriptDir = path.join(dir, "scripts", "scr_double");
      await fs.mkdir(scriptDir, { recursive: true });
      await fs.writeFile(
        path.join(scriptDir, "scr_double.gml"),
        `function scr_double(x) {\n  return x * 2;\n}`,
        "utf-8",
      );

      const objDir = path.join(dir, "objects", "obj_thing");
      await fs.mkdir(objDir, { recursive: true });
      await fs.writeFile(
        path.join(objDir, "Create_0.gml"),
        `x = scr_double(5);`,
        "utf-8",
      );

      const behavior = await buildObjectBehavior("obj_thing", dir, [
        "scr_double",
      ]);
      expect(behavior).toContain(
        "import { scr_double } from '../scr_double.js';",
      );
      expect(behavior).toContain("scr_double(5)");
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it("emits no script import when an object's events call no known scripts", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "gms2-obj-no-script-"));
    try {
      const objDir = path.join(dir, "objects", "obj_plain");
      await fs.mkdir(objDir, { recursive: true });
      await fs.writeFile(path.join(objDir, "Create_0.gml"), `x = 1;`, "utf-8");

      const behavior = await buildObjectBehavior("obj_plain", dir, [
        "scr_double",
      ]);
      expect(behavior).not.toContain("scr_double");
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});

describe("importGMS2Project end-to-end: script + object-calling-script wiring", () => {
  it("writes a real transpiled script module and a wired object behavior file", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "gms2-e2e-script-"));
    const out = await fs.mkdtemp(
      path.join(os.tmpdir(), "gms2-e2e-script-out-"),
    );
    try {
      await fs.writeFile(
        path.join(dir, "project.yyp"),
        `{
          "%Name":"Script E2E Test",
          "resources":[
            {"id":{"name":"scr_triple","path":"scripts/scr_triple/scr_triple.yy",},},
            {"id":{"name":"obj_user","path":"objects/obj_user/obj_user.yy",},},
          ],
        }`,
        "utf-8",
      );

      const scriptDir = path.join(dir, "scripts", "scr_triple");
      await fs.mkdir(scriptDir, { recursive: true });
      await fs.writeFile(
        path.join(scriptDir, "scr_triple.gml"),
        `function scr_triple(n) {\n  return n * 3;\n}`,
        "utf-8",
      );

      const objDir = path.join(dir, "objects", "obj_user");
      await fs.mkdir(objDir, { recursive: true });
      await fs.writeFile(
        path.join(objDir, "obj_user.yy"),
        `{"name":"obj_user",}`,
        "utf-8",
      );
      await fs.writeFile(
        path.join(objDir, "Create_0.gml"),
        `result = scr_triple(7);`,
        "utf-8",
      );

      const result = await importGMS2Project(
        path.join(dir, "project.yyp"),
        out,
        { verbose: false },
      );
      expect(result.converted).toBeGreaterThanOrEqual(2);

      const scriptOut = await fs.readFile(
        path.join(out, "scr_triple.ts"),
        "utf-8",
      );
      expect(scriptOut).toContain(
        "export function scr_triple(n: unknown): unknown {",
      );
      expect(scriptOut).toContain("return n * 3;");

      const behaviorOut = await fs.readFile(
        path.join(out, "obj_user.behavior.ts"),
        "utf-8",
      );
      expect(behaviorOut).toContain(
        "import { scr_triple } from '../scr_triple.js';",
      );
      expect(behaviorOut).toContain("scr_triple(7)");
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
      await fs.rm(out, { recursive: true, force: true });
    }
  });
});
