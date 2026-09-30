import { describe, expect, it } from "vitest";
import { parseSync } from "rolldown/utils";
import { emitEvent } from "../emit/index.js";
import { buildProjectSymbols, type ProjectInput } from "../project-symbols.js";

/**
 * Regression cases from running real projects through the importer: each input
 * is a minimal synthetic GML snippet, not project code. The output must be
 * syntactically valid TypeScript (checked with the same oxc parser the module
 * loader uses, so an invalid assignment target counts) and resolve names the
 * way GameMaker does.
 */

interface Ctx {
  objects?: string[];
  sprites?: string[];
  /** Other object events of the project, path -> text, so their assignments are known fields. */
  files?: Record<string, string>;
}

function emit(text: string, ctx: Ctx = {}): string {
  const file = {
    path: "objects/obj_self/Step_0.gml",
    text,
    object: "obj_self",
    kind: "object" as const,
  };
  const others = Object.entries(ctx.files ?? {}).map(([path, t]) => ({
    path,
    text: t,
    object: path.split("/")[1] ?? "",
    kind: "object" as const,
  }));
  const assets: ProjectInput["assets"] = {
    object: ["obj_self", ...(ctx.objects ?? [])],
    sprite: ctx.sprites ?? [],
  };
  const project = buildProjectSymbols({ assets, files: [file, ...others] });
  return emitEvent(file, {
    project,
    kind: "event",
    object: "obj_self",
    functionId: "fn",
    callables: new Map(),
  }).code;
}

function syntaxErrors(body: string): string[] {
  return parseSync(
    "snippet.ts",
    `function f(_entity, _ctx, _other) {\n${body}\n}`,
  ).errors.map((e) => e.message);
}

describe("emitter regressions from real-project shapes", () => {
  it("compound assignment and ++ on a cross-instance field", () => {
    const out = emit(
      'obj_a.hp -= damage;\ndlg = instance_create_layer(0, 0, "L", obj_a);\ndlg.text_page++;',
      { objects: ["obj_a"] },
    );
    expect(syntaxErrors(out)).toEqual([]);
    expect(out).not.toMatch(/\)\s*-=/);
    expect(out).not.toMatch(/\)\s*\+\+/);
  });

  it("a local named like another object's array stays local", () => {
    const out = emit(
      "var array = argument0;\narray[0] = 1;\nplayerStartPressed = false;",
      { files: { "objects/obj_b/Create_0.gml": "array = [1];" } },
    );
    expect(syntaxErrors(out)).toEqual([]);
    expect(out).not.toContain('"array"');
    expect(out).toContain(
      'GmlActions.setGmlVar(_entity, _ctx, "playerStartPressed", false)',
    );
  });

  it("a multi-line var list declares every name", () => {
    const out = emit('var str = "",\n    f = 1;\nx = f;');
    expect(syntaxErrors(out)).toEqual([]);
    expect(out).not.toContain('"f"');
  });

  it("a local shadowing a sprite asset stays a local", () => {
    const out = emit("var w, tempsprite;\ntempsprite = 1;\nw = tempsprite;", {
      sprites: ["tempsprite"],
    });
    expect(syntaxErrors(out)).toEqual([]);
    expect(out).not.toContain("./assets/sprites/tempsprite");
  });

  it("a compound for-step stays one expression", () => {
    const out = emit("for (i = 0; i < n; x2 += chunk){\n  total += 1;\n}");
    expect(syntaxErrors(out)).toEqual([]);
  });

  it("a ds_map accessor on a global", () => {
    const out = emit('v = global.map[? "k"];');
    expect(syntaxErrors(out)).toEqual([]);
    expect(out).not.toContain("[?");
  });

  it("ds_grid_create next to an instance variable named length", () => {
    const out = emit("g = ds_grid_create(2, 3);\nlength = 4;");
    expect(syntaxErrors(out)).toEqual([]);
  });

  it("the word with inside a string literal", () => {
    const out = emit('text[1] = "Proceed with caution.";');
    expect(syntaxErrors(out)).toEqual([]);
    expect(out).toContain('"Proceed with caution."');
  });

  it("an indexed legacy view array read", () => {
    const out = emit("var w = view_wport[0];\nvar h = view_hport[0];");
    expect(syntaxErrors(out)).toEqual([]);
    expect(out).toContain("GmlActions.view_get_wport(_ctx, 0)");
  });

  it("a compound assignment to a legacy view variable", () => {
    const out = emit(
      "if (shake) {\n  view_xview += choose(-f, f);\n}\nview_xview = view_xview * 0.5;",
    );
    expect(syntaxErrors(out)).toEqual([]);
  });

  it("an unknown built-in call is not emitted as a bare global", () => {
    const out = emit("audio_emitter_create();\nwindow_center();");
    expect(syntaxErrors(out)).toEqual([]);
    expect(out).not.toMatch(/(^|[^.\w])audio_emitter_create\(/);
    expect(out).not.toMatch(/(^|[^.\w])window_center\(/);
  });

  it("an array-valued instance variable is indexed without gmlNum", () => {
    const out = emit("grid = [[1]];\nv = grid[0][0];");
    expect(syntaxErrors(out)).toEqual([]);
    expect(out).not.toMatch(
      /gmlNum\(GmlActions\.getGmlVar\(_entity, _ctx, "grid"\)\)\[/,
    );
  });

  it("an alarm set on another object", () => {
    const out = emit("obj_x.alarm[0] = 5;", { objects: ["obj_x"] });
    expect(syntaxErrors(out)).toEqual([]);
    expect(out).not.toMatch(/\)\[0\]\s*=/);
    expect(out).toContain("alarm");
  });

  it("a local named like an object is the local, not the object", () => {
    const out = emit(
      "var wall = instance_place(x, y, wall);\nif (wall != noone) { x = wall.x; }",
      { objects: ["wall"] },
    );
    expect(syntaxErrors(out)).toEqual([]);
    expect(out).not.toContain('getGmlObjectVar(_entity, _ctx, "wall"');
  });

  it("sprite_index assigned from a non-asset variable is not a texture path", () => {
    const out = emit("sprite_index = my_sprite;\nmy_sprite = 3;", {
      sprites: ["spr_a"],
    });
    expect(out).not.toContain("./assets/sprites/my_sprite");
  });
});
