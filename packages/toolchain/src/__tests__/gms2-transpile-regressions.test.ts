import { describe, expect, it } from "vitest";
import { parseSync } from "rolldown/utils";
import { transpileSnippet } from "./helpers/transpileSnippet.js";

/**
 * Regression tests for the transpiler failures found by running the real
 * fixtures (docs/research/00b-fixture-triage.md, T-n / R-n; review question
 * Q1, Q9). Each input is a minimal synthetic GML snippet, not project code.
 * `it.fails` marks a case the current transpiler still gets wrong; the
 * marker is removed when the fix lands.
 */

/**
 * Syntax errors of `code` as a TypeScript module, from the same (oxc)
 * parser the module loader uses, so an invalid assignment target counts.
 */
function syntaxErrors(code: string): string[] {
  return parseSync("snippet.ts", code).errors.map((e) => e.message);
}

describe("transpiler regressions from the real-project fixtures", () => {
  it.fails("T-1: compound assignment and ++ on a cross-instance field", () => {
    const out = transpileSnippet(
      'obj_a.hp -= damage;\ndlg = instance_create_layer(0, 0, "L", obj_a);\ndlg.text_page++;',
      { objects: ["obj_a"], instanceVars: ["damage"] },
    );
    expect(syntaxErrors(out)).toEqual([]);
    expect(out).toContain("setGmlObjectVar");
    expect(out).not.toMatch(/\)\s*-=/);
    expect(out).not.toMatch(/\)\s*\+\+/);
  });

  it.fails(
    "T-2: a local named like another object's array stays local; a whole-variable assignment is a scalar write",
    () => {
      const out = transpileSnippet(
        "var array = argument0;\narray[0] = 1;\nplayerStartPressed = false;",
        { arrayVars: ["array", "playerStartPressed"] },
      );
      expect(syntaxErrors(out)).toEqual([]);
      expect(out).not.toContain('getGmlArrayVar(_entity, _ctx, "array")');
      expect(out).toContain(
        'GmlActions.setGmlVar(_entity, _ctx, "playerStartPressed", false)',
      );
    },
  );

  it("T-3: a multi-line var list declares every name", () => {
    const out = transpileSnippet('var str = "",\n    f = 1;\nx = f;');
    expect(syntaxErrors(out)).toEqual([]);
    expect(out).not.toContain('"f"');
  });

  it.fails("T-4: a local shadowing a sprite asset stays a local", () => {
    const out = transpileSnippet(
      "var w, tempsprite;\ntempsprite = 1;\nw = tempsprite;",
      {
        sprites: ["tempsprite"],
      },
    );
    expect(syntaxErrors(out)).toEqual([]);
    expect(out).not.toContain("./assets/sprites/tempsprite");
  });

  it.fails("T-5: a compound for-step stays one expression", () => {
    const out = transpileSnippet(
      "for (i = 0; i < n; x2 += chunk){\n  total += 1;\n}",
      { instanceVars: ["i", "n", "x2", "chunk", "total"] },
    );
    expect(syntaxErrors(out)).toEqual([]);
  });

  it.fails("T-6: a ds_map accessor on a global", () => {
    const out = transpileSnippet('v = global.map[? "k"];');
    expect(syntaxErrors(out)).toEqual([]);
    expect(out).not.toContain("[?");
  });

  it.fails(
    "T-7: ds_grid_create next to an instance variable named length",
    () => {
      const out = transpileSnippet("g = ds_grid_create(2, 3);", {
        instanceVars: ["length"],
      });
      expect(syntaxErrors(out)).toEqual([]);
    },
  );

  it.fails("T-8: the word with inside a string literal", () => {
    const out = transpileSnippet('text[1] = "Proceed with caution.";');
    expect(syntaxErrors(out)).toEqual([]);
    expect(out).toContain('"Proceed with caution."');
  });

  it.fails("T-9: an indexed legacy view array read", () => {
    const out = transpileSnippet(
      "var w = view_wport[0];\nvar h = view_hport[0];",
    );
    expect(syntaxErrors(out)).toEqual([]);
    expect(out).toContain("GmlActions.view_get_wport(_ctx, 0)");
  });

  it.fails("T-10: a compound assignment to a legacy view variable", () => {
    const out = transpileSnippet(
      "if (shake) {\n  view_xview += choose(-f, f);\n}\nview_xview = view_xview * 0.5;",
      { instanceVars: ["shake", "f"] },
    );
    expect(syntaxErrors(out)).toEqual([]);
  });

  it.fails(
    "T-12: a condition written without if still produces loadable code",
    () => {
      const out = transpileSnippet("place_free(x - 4, y) {x -= 4}");
      expect(syntaxErrors(out)).toEqual([]);
    },
  );

  it.fails(
    "R-1: an unknown built-in call is a warning stub, not a bare global",
    () => {
      const out = transpileSnippet("audio_emitter_create();\nwindow_center();");
      expect(syntaxErrors(out)).toEqual([]);
      expect(out).not.toMatch(/(^|[^.\w])audio_emitter_create\(/);
      expect(out).not.toMatch(/(^|[^.\w])window_center\(/);
    },
  );

  it.fails(
    "R-2: an array-valued instance variable is indexed without gmlNum",
    () => {
      const out = transpileSnippet("grid = [[1]];\nv = grid[0][0];");
      expect(syntaxErrors(out)).toEqual([]);
      expect(out).not.toMatch(
        /gmlNum\(GmlActions\.getGmlVar\(_entity, _ctx, "grid"\)\)\[/,
      );
    },
  );

  it.fails("R-4: an alarm set on another object", () => {
    const out = transpileSnippet("obj_x.alarm[0] = 5;", { objects: ["obj_x"] });
    expect(syntaxErrors(out)).toEqual([]);
    expect(out).not.toMatch(/\)\[0\]\s*=/);
    expect(out).toContain("alarm");
  });

  it.fails(
    "Q1: a local named like an object is the local, not the object",
    () => {
      const out = transpileSnippet(
        "var wall = instance_place(x, y, wall);\nif (wall != noone) { x = wall.x; }",
        { objects: ["wall"] },
      );
      expect(syntaxErrors(out)).toEqual([]);
      expect(out).not.toContain('getGmlObjectVar(_entity, _ctx, "wall"');
    },
  );

  it.fails(
    "Q9: sprite_index assigned from a non-asset variable is not a texture path",
    () => {
      const out = transpileSnippet("sprite_index = my_sprite;", {
        sprites: ["spr_a"],
        instanceVars: ["my_sprite"],
      });
      expect(out).not.toContain("./assets/sprites/my_sprite");
    },
  );
});
