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
        "export function scr_add(_entity: Entity, _ctx: GmlActionContext, a: number, b: number): unknown {",
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
        "export function scr_legacy_sum(_entity: Entity, _ctx: GmlActionContext, ...args: unknown[]): unknown {",
      );
      expect(content).toContain(
        "return GmlActions.gmlNum(args[0]) + GmlActions.gmlNum(args[1]);",
      );
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
        "export function scr_log(_entity: Entity, _ctx: GmlActionContext, msg: number): void {",
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
      // `${name}.behavior.ts` and `${script}.ts` are both written at the
      // import output directory's root by `importGMS2Project` — a sibling
      // import, not a parent-directory one (a real bug this regression
      // test now guards against).
      expect(behavior).toContain(
        "import { scr_double } from './scr_double.js';",
      );
      expect(behavior).toContain("scr_double(_entity, _ctx, 5)");
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

describe("buildObjectBehavior: cross-event implicit instance variable persistence", () => {
  // Real, confirmed regression against a real project's own obj_camera: a
  // name set once in Create (cam = view_camera[0];) and only ever read —
  // never assigned — in Step (camera_set_view_pos(cam, ...)) used to be
  // left as a bare, undeclared identifier in Step's own generated function,
  // since each event is transpiled independently and Step's own body never
  // itself assigns "cam". scanGmlImplicitVars pre-scans every sibling event
  // file so a read-only occurrence in one event still resolves through
  // GmlInstanceVars, set by a sibling event.
  it("routes a Step-only read of a Create-only-assigned name through GmlInstanceVars", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "gms2-obj-crossevt-"));
    try {
      const objDir = path.join(dir, "objects", "obj_camera");
      await fs.mkdir(objDir, { recursive: true });
      await fs.writeFile(
        path.join(objDir, "Create_0.gml"),
        "cam = view_camera[0];",
        "utf-8",
      );
      await fs.writeFile(
        path.join(objDir, "Step_0.gml"),
        "camera_set_view_pos(cam, 0, 0);",
        "utf-8",
      );

      const behavior = await buildObjectBehavior("obj_camera", dir, []);
      expect(behavior).toContain(
        'GmlActions.setGmlVar(_entity, _ctx, "cam", GmlActions.view_get_camera(_ctx, 0));',
      );
      // The real point of this test: Step's own body never assigns "cam",
      // yet its read here must not be a bare, undeclared identifier.
      expect(behavior).toContain(
        'GmlActions.camera_set_view_pos(_ctx, GmlActions.gmlNum(GmlActions.getGmlVar(_entity, _ctx, "cam")), 0, 0);',
      );
      expect(behavior).not.toMatch(/[^.\w]cam[^"\w]/);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  // Real, confirmed regression, same object: instance_exists's object-
  // argument quoting used to assume every bare identifier is an object-
  // *type* name, quoting "follow" into the literal string "follow" instead
  // of leaving it as a read of the real instance-reference variable Create
  // set it to.
  it("leaves a known implicit-variable argument to instance_exists bare, not quoted as an object-type name", async () => {
    const dir = await fs.mkdtemp(
      path.join(os.tmpdir(), "gms2-obj-instexists-"),
    );
    try {
      const objDir = path.join(dir, "objects", "obj_camera2");
      await fs.mkdir(objDir, { recursive: true });
      await fs.writeFile(
        path.join(objDir, "Create_0.gml"),
        "follow = obj_player;",
        "utf-8",
      );
      await fs.writeFile(
        path.join(objDir, "Step_0.gml"),
        "if (instance_exists(follow))\n{\n  x = 1;\n}",
        "utf-8",
      );

      const behavior = await buildObjectBehavior("obj_camera2", dir, []);
      expect(behavior).toContain(
        'GmlActions.instance_exists(_entity, _ctx, GmlActions.gmlNum(GmlActions.getGmlVar(_entity, _ctx, "follow")))',
      );
      expect(behavior).not.toContain(
        'instance_exists(_entity, _ctx, "follow")',
      );
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  // Real, confirmed gap: GameMaker's `other` keyword inside a Collision
  // event refers to the other colliding instance — onCollideWith<Other>
  // already declares a real _other: Entity parameter (gms2-codegen.ts), but
  // nothing previously rewrote GML's bare `other` to reference it, leaving
  // it a bare, undeclared identifier (a hard ReferenceError at runtime,
  // and — before this fix — a candidate for being misidentified as this
  // object's own implicit instance field by the generic auto-var pass).
  it("rewrites GML's `other` keyword to the real _other parameter inside a collision handler", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "gms2-obj-other-"));
    try {
      const objDir = path.join(dir, "objects", "obj_enemy");
      await fs.mkdir(objDir, { recursive: true });
      await fs.writeFile(
        path.join(objDir, "Collision_obj_bullet.gml"),
        "hp -= other.damage;\nif (other.object_index == obj_bullet)\n{\n  x = 1;\n}",
        "utf-8",
      );

      const behavior = await buildObjectBehavior("obj_enemy", dir, []);
      expect(behavior).toContain(
        "export function onCollideWithObjBullet(_entity: Entity, _other: Entity, _ctx: GmlActionContext): void {",
      );
      // `other` -> `_other` is real, and a further pass now routes a
      // dotted `_other.<field>` read through the real getGmlEntityField
      // accessor (see CLAUDE.md's "GML local-variable-held instance
      // references" / `_other` entry) rather than leaving a bare,
      // type-broken property access on a real `Entity` object.
      expect(behavior).toContain(
        'GmlActions.getGmlEntityField(_ctx, _other, "damage")',
      );
      expect(behavior).toContain(
        'GmlActions.getGmlEntityField(_ctx, _other, "object_index")',
      );
      expect(behavior).not.toMatch(/[^_.\w]other\b/);
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
        "export function scr_triple(_entity: Entity, _ctx: GmlActionContext, n: number): unknown {",
      );
      expect(scriptOut).toContain("return n * 3;");

      const behaviorOut = await fs.readFile(
        path.join(out, "obj_user.behavior.ts"),
        "utf-8",
      );
      expect(behaviorOut).toContain(
        "import { scr_triple } from './scr_triple.js';",
      );
      expect(behaviorOut).toContain("scr_triple(_entity, _ctx, 7)");
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
      await fs.rm(out, { recursive: true, force: true });
    }
  });
});
