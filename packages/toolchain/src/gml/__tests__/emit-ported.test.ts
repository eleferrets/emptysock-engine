/**
 * Behaviors ported from the deleted regex transpiler's test suite. Each case
 * runs a GML snippet through the AST emitter (`emit-shim.ts` builds the
 * `ProjectSymbols` the old module-level `setGml*` state used to stand for) and
 * checks the same output property. Cases whose expectation was a regex-pass
 * formatting artefact (text the old passes produced, not behavior) were
 * dropped rather than ported.
 */
import { describe, expect, it } from "vitest";
import {
  transpileGML,
  setGmlMacros,
  setGmlEnumNames,
  setGmlObjectNames,
  setGmlSpriteNames,
  setGmlSoundNames,
  setGmlFontNames,
  setGmlRoomNames,
  setGmlShaderNames,
  setGmlCrossFileEntityRefFields,
} from "./emit-shim.js";

describe("transpileGML — place_meeting/collision query family", () => {
  it("place_meeting's all/noone special object references are not quoted as asset paths", () => {
    // 'all'/'noone' ARE bare identifiers syntactically, and bareOrQuoted
    // has no way to special-case them at the regex layer — they get quoted
    // into "all"/"noone" strings, which is exactly what
    // GmlCollisionQueries.ts's object-type resolution already expects (it
    // checks for the literal strings "all"/"noone" before falling back to
    // Meta.name resolution), so this is correct, not a gap.
    const out = transpileGML("place_meeting(x, y, all);");
    expect(out).toContain(
      'GmlActions.place_meeting(_entity, _ctx, (_entity.get(GmlActions.Transform)?.x ?? 0), (_entity.get(GmlActions.Transform)?.y ?? 0), "all");',
    );
  });
});

describe("transpileGML — GMS2 timelines (timeline_index/timeline_running/...)", () => {
  it("rewrites timeline_index = -1; into removing TimelineState (GameMaker's real 'no timeline' sentinel)", () => {
    const out = transpileGML("timeline_index = -1;");
    expect(out).toContain("_entity.remove(GmlActions.TimelineState);");
    expect(out).not.toContain("_entity.add(GmlActions.TimelineState");
  });

  it("rewrites timeline_running/timeline_speed/timeline_loop/timeline_position writes", () => {
    const out = transpileGML(
      "timeline_running = true;\ntimeline_speed = 2;\ntimeline_loop = true;\ntimeline_position = 0;",
    );
    expect(out).toContain(
      "const _tl = _entity.get(GmlActions.TimelineState); if (_tl) _tl.running = true;",
    );
    expect(out).toContain(
      "const _tl = _entity.get(GmlActions.TimelineState); if (_tl) _tl.speed = 2;",
    );
    expect(out).toContain(
      "const _tl = _entity.get(GmlActions.TimelineState); if (_tl) _tl.loop = true;",
    );
    expect(out).toContain(
      "const _tl = _entity.get(GmlActions.TimelineState); if (_tl) _tl.position = 0;",
    );
  });

  it("rewrites a bare read of timeline_running/timeline_position to a safe optional-chained default", () => {
    const out = transpileGML(
      "if (timeline_running && timeline_position > 30) { x += 1; }",
    );
    expect(out).toContain(
      "(_entity.get(GmlActions.TimelineState)?.running ?? false)",
    );
    expect(out).toContain(
      "(_entity.get(GmlActions.TimelineState)?.position ?? 0) > 30",
    );
  });
});

describe("transpileGML — GMS2 rendering built-ins (sprite_index/image_*)", () => {
  it("does not leave the sprite-asset identifier as an unresolved bare read (the real reported bug)", () => {
    const out = transpileGML(
      "if (hug) {\n  sprite_index = spr_dad_hug;\n}\nelse {\n  sprite_index = spr_dad_idle;\n}",
    );
    expect(out).not.toMatch(/=\s*spr_dad_hug\s*;/);
    expect(out).not.toMatch(/=\s*spr_dad_idle\s*;/);
  });

  it("rewrites a bare read of sprite_index to a safe optional-chained Sprite.texturePath read", () => {
    const out = transpileGML(
      "if (sprite_index == other.sprite_index) { x += 1; }",
    );
    expect(out).toContain(
      '(_entity.get(GmlActions.Sprite)?.texturePath ?? "")',
    );
  });

  it("rewrites image_angle writes/reads onto Transform.rotation with a degrees<->radians conversion", () => {
    const out = transpileGML("image_angle = 45;\ny = image_angle;");
    expect(out).toContain(
      "const _t = _entity.get(GmlActions.Transform); if (_t) _t.rotation = -(45) * Math.PI / 180;",
    );
    // GameMaker angles are counter-clockwise; Transform.rotation is
    // clockwise (y-down), so both directions negate.
    expect(out).toContain(
      "(-(_entity.get(GmlActions.Transform)?.rotation ?? 0) * 180 / Math.PI)",
    );
  });

  it("rewrites image_alpha writes/reads onto Sprite.alpha", () => {
    const out = transpileGML("image_alpha = 0.5;\ny = image_alpha;");
    expect(out).toContain(
      "const _sp = _entity.get(GmlActions.Sprite); if (_sp) _sp.alpha = 0.5;",
    );
    expect(out).toContain("(_entity.get(GmlActions.Sprite)?.alpha ?? 1)");
  });

  it("rewrites image_blend writes/reads onto Sprite.tint with the same BGR<->RGB conversion action_sprite_color uses", () => {
    const out = transpileGML("image_blend = c_red;\ny = image_blend;");
    expect(out).toContain("const _bl = (GmlActions.c_red);");
    expect(out).toContain(
      "const _bb = (_bl >> 16) & 0xff; const _gg = (_bl >> 8) & 0xff; const _rr = _bl & 0xff; _sp.tint = (_rr << 16) | (_gg << 8) | _bb;",
    );
    expect(out).toContain(
      "((_t & 0xff) << 16) | (_t & 0xff00) | ((_t >> 16) & 0xff)",
    );
  });

  it("rewrites image_index/image_speed onto real Sprite.currentFrame/frameSpeed fields (superseding the old setGmlVar honest-gap behaviour — see CLAUDE.md's GMS2 rendering built-ins entry)", () => {
    const out = transpileGML("image_index = 0;\nimage_speed = 1;");
    expect(out).toContain(
      "const _sp = _entity.get(GmlActions.Sprite); if (_sp) _sp.currentFrame = 0;",
    );
    expect(out).toContain(
      "const _sp = _entity.get(GmlActions.Sprite); if (_sp) _sp.frameSpeed = 1;",
    );
  });

  describe("depth — GameMaker draw-order variable, sign-flipped onto Sprite.depth", () => {
    // manual.gamemaker.io's Depth reference page is explicit: a *lower*
    // `depth` value draws that instance *in front of* one with a higher
    // `depth` (its own canonical example: depth -100 draws in front of
    // depth 0). This engine's `Sprite.depth` sorts the opposite way —
    // `RenderPipeline` writes `pixiSprite.zIndex = sprite.depth` straight
    // through, and PixiJS's `zIndex` convention is "higher draws on top" —
    // so the transpiled write/read must apply a `-` sign flip to preserve
    // GameMaker's real visual semantic rather than just copying the value.
    it("rewrites depth = -100; into a real Sprite.depth write with the sign flipped (draws in front -> higher Sprite.depth)", () => {
      const out = transpileGML("depth = -100;");
      expect(out).toContain(
        "const _sp = _entity.get(GmlActions.Sprite); if (_sp) _sp.depth = -(-100);",
      );
    });

    it("rewrites a positive depth write with the same flip (draws behind -> lower Sprite.depth)", () => {
      const out = transpileGML("depth = 50;");
      expect(out).toContain(
        "const _sp = _entity.get(GmlActions.Sprite); if (_sp) _sp.depth = -(50);",
      );
    });

    it("round-trips a bare read of depth back through the same flip", () => {
      const out = transpileGML("depth = -100;\ny = depth;");
      expect(out).toContain("(-(_entity.get(GmlActions.Sprite)?.depth ?? 0))");
    });

    it("is valid syntax as the body of a bare (brace-less) if statement", () => {
      const gml = "if (a) depth = -100;\nif (b)\n{\n  foo();\n}\n";
      const out = transpileGML(gml);
      expect(() => new Function(out)).not.toThrow();
    });
  });

  describe("compound assignment (+=/-=/etc.) — real gap found in obj_playerw/obj_bullet/obj_footstep", () => {
    it("image_xscale -= works the same way", () => {
      const out = transpileGML("image_xscale -= 0.1;");
      expect(out).toContain(
        "const _t = _entity.get(GmlActions.Transform); if (_t) _t.scaleX -= 0.1;",
      );
    });

    it("image_alpha -= is a real Sprite.alpha -= write — real gap found in obj_footstep's Step_0.gml", () => {
      const out = transpileGML("image_alpha -= 0.01;");
      expect(out).toContain(
        "const _sp = _entity.get(GmlActions.Sprite); if (_sp) _sp.alpha -= 0.01;",
      );
      expect(() => new Function(out)).not.toThrow();
    });

    it("timeline_speed += is a real TimelineState.speed += write", () => {
      const out = transpileGML("timeline_speed += 0.5;");
      expect(out).toContain(
        "const _tl = _entity.get(GmlActions.TimelineState); if (_tl) _tl.speed += 0.5;",
      );
    });
  });

  describe("image_index / image_speed — multi-frame sprite animation", () => {
    it("rewrites a plain image_index assignment onto Sprite.currentFrame", () => {
      const out = transpileGML("image_index = 0;");
      expect(out).toContain(
        "const _sp = _entity.get(GmlActions.Sprite); if (_sp) _sp.currentFrame = 0;",
      );
    });

    it("rewrites a bare read of image_index", () => {
      const out = transpileGML("var frame = image_index;");
      expect(out).toContain(
        "(_entity.get(GmlActions.Sprite)?.currentFrame ?? 0)",
      );
    });

    it("rewrites image_index += with no unit conversion", () => {
      const out = transpileGML("image_index += 1;");
      expect(out).toContain(
        "const _sp = _entity.get(GmlActions.Sprite); if (_sp) _sp.currentFrame += 1;",
      );
      expect(() => new Function(out)).not.toThrow();
    });

    it("rewrites a plain image_speed assignment onto Sprite.frameSpeed", () => {
      const out = transpileGML("image_speed = 0.5;");
      expect(out).toContain(
        "const _sp = _entity.get(GmlActions.Sprite); if (_sp) _sp.frameSpeed = 0.5;",
      );
    });

    it("rewrites a bare read of image_speed", () => {
      const out = transpileGML("var s = image_speed;");
      expect(out).toContain(
        "(_entity.get(GmlActions.Sprite)?.frameSpeed ?? 1)",
      );
    });

    it("does not misfire on a stray apostrophe in a nearby comment", () => {
      const out = transpileGML(
        "// The player's animation frame\nimage_index = 0;\nimage_speed = 1;",
      );
      expect(out).toContain("_sp.currentFrame = 0;");
      expect(out).toContain("_sp.frameSpeed = 1;");
    });

    it("produces valid, runnable JS for a real image_index=0; image_speed=1; Create-event shape", () => {
      const out = transpileGML("image_index = 0;\nimage_speed = 1;");
      expect(() => new Function("_entity", "GmlActions", out)).not.toThrow();
    });
  });
});

describe("transpileGML", () => {
  it("global.x = expr routes through a real GlobalStore.set call, not a TODO comment", () => {
    const out = transpileGML("global.kills = 1;");
    expect(out).not.toContain("export let");
    expect(out).toContain('_ctx.game?.globals.set("kills", 1);');
  });

  it("a bare global.x read routes through a real GlobalStore.get call", () => {
    const out = transpileGML("if (global.hasgun == false) { x = 1; }");
    expect(out).toContain('(_ctx.game?.globals.get("hasgun"))');
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

  it("instance_destroy() threads into a real GmlActions.instance_destroy call, not an inert comment placeholder — severe real gap, confirmed used in 33 real files across two real projects", () => {
    const out = transpileGML("instance_destroy();");
    expect(out).toContain("GmlActions.instance_destroy(_entity, _ctx);");
    expect(out).not.toContain("undefined /* entity.destroy(); */");
  });

  it("does not touch an already-parenthesised switch subject", () => {
    const out = transpileGML("switch (x)\n{\n  case 1:\n    break;\n}");
    expect(out).toContain(
      "switch ((_entity.get(GmlActions.Transform)?.x ?? 0))",
    );
    expect(out).not.toContain("switch ((x))");
  });

  it("leaves a brace-less if's body statement-valid when its body is a lone global assignment — real gap found in obj_ear's Step_0.gml", () => {
    const out = transpileGML("if (global.gain > 1)\n\tglobal.gain = 1;");
    // global.x = expr is now a real GlobalStore.set() call, a real
    // statement on its own — no longer needs a leading `;` placeholder to
    // stay valid as the if's single-statement body.
    expect(out).toContain('_ctx.game?.globals.set("gain", 1);');
    expect(() => new Function(out)).not.toThrow();
  });

  it("show_message tolerates a nested call in its message argument — real gap found in action_create_object.gml", () => {
    const out = transpileGML(
      'show_message( "creating instance for non-existent object" + string(id) );',
    );
    // `id` (GameMaker's own instance-id built-in) is now a real rewrite onto
    // `_entity` — see the "GameMaker's `id` built-in" transpile pass; this
    // test's own point (a nested `string(id)` call inside show_message's
    // argument doesn't break the outer paren-balance scan) still holds.
    expect(out).toContain(
      'console.log("creating instance for non-existent object" + String(_entity));',
    );
  });

  it("does not rewrite image_angle/sprite_index-like text inside a // comment — real gap found in scr_wave.gml", () => {
    const out = transpileGML(
      "// image_angle = Wave(-45,45,1,0,0)  -> rock back and forth 90 degrees in a second\nx = 1;",
    );
    // Only asserting the real, confirmed bug is fixed (a Transform-field
    // IIFE spliced into the comment text) — other, unrelated word-level
    // rewrites (and/or/not -> &&/||/!) are a separate, pre-existing,
    // broader gap in comment-handling not in scope here.
    expect(out).not.toMatch(/\/\/[^\n]*_entity\.get\(GmlActions\.Transform\)/);
    expect(out).toContain("// image_angle = Wave(-45,45,1,0,0)");
    // The real code line *after* the comment is correctly rewritten — the
    // comment itself is inert, real code that follows it is not.
    expect(out).toContain("_t.x = 1;");
  });

  it("a global assignment sharing a physical line with real following code doesn't swallow it into a // comment — real gap found in obj_shop's Step_0.gml", () => {
    // A `//` line comment runs to end of line no matter what — it consumed
    // `canDraw = false; canEdit = false; }` (the block's own closing brace
    // included) into dead commentary, leaving the enclosing block
    // permanently unclosed.
    const out = transpileGML(
      "if (curPos == pos1[3]) { global.pause = false; canDraw = false; canEdit = false; }",
    );
    expect(out).toContain(
      'GmlActions.setGmlVar(_entity, _ctx, "canDraw", false);',
    );
    expect(out).toContain(
      'GmlActions.setGmlVar(_entity, _ctx, "canEdit", false);',
    );
    expect(out.trim().endsWith("}")).toBe(true);
  });

  it("handles audio_play_sound with a nested-call first argument", () => {
    const out = transpileGML(
      "audio_play_sound(choose(snd_a, snd_b), 1, false);",
    );
    expect(out).not.toMatch(/\(\s*\/\//);
  });

  it("turns the #macro directive line itself into a comment (fixing its own syntax error)", () => {
    const out = transpileGML("#macro VIEW view_camera[0]\nx = VIEW;");
    expect(out).not.toMatch(/^\s*#macro/m);
    expect(out).toContain("// #macro VIEW");
  });

  it("substitutes a real project-wide macro value at every use site — real gap: this used to leave every use site an undeclared bare identifier (ReferenceError)", () => {
    setGmlMacros(new Map([["SAVEFILE", '"game.sav"']]));
    try {
      const out = transpileGML(
        "var file = file_text_open_write(working_directory + SAVEFILE);",
      );
      expect(out).toContain('working_directory + ("game.sav")');
    } finally {
      setGmlMacros(new Map());
    }
  });

  it("keeps instance_create_layer valid with a nested-call argument", () => {
    const out = transpileGML(
      "instance_create_layer(random(room_width), 0, layer, obj_x);",
    );
    expect(out).not.toMatch(/,\s*0,\s*layer,\s*obj_x\);\s*$/m);
  });

  describe("ds_list", () => {
    it("transpiles the [| i] accessor to plain indexing in both read and write position", () => {
      // `list` here is genuinely undeclared (no prior `var list = ...`),
      // so once the `[| ]` accessor syntax is stripped to plain `[0]` it
      // is correctly picked up by the separate implicit-array-variable
      // pass and routed through `GmlActions.getGmlArrayVar` — the same
      // real behaviour a bare `endtext[0] = "...";` gets elsewhere in this
      // file's own implicit-array-var tests. This is not a regression:
      // declaring `list` first (`var list = [];`) keeps it a plain local
      // array with plain indexing, covered by the sibling test above.
      const readOut = transpileGML("var list = []; var v = list[| 0];");
      expect(readOut).toContain("var v = list[0];");
      const writeOut = transpileGML("list[| 0] = 5;");
      expect(writeOut).toContain(
        'GmlActions.getGmlArrayVar(_entity, _ctx, "list")[0] = 5;',
      );
    });
  });

  describe("GML built-in instance variables", () => {
    it("routes a bare assignment to a known built-in (e.g. shake_remain) through real per-instance persistence, not a function-scoped var", () => {
      // `image_speed`/`image_index` used to be this test's example, but
      // both are now rewritten onto real `Sprite.currentFrame`/`frameSpeed`
      // fields by a dedicated earlier pass (see the "image_index /
      // image_speed" describe block above) — by the time this generic
      // implicit-var pass runs, neither bare identifier exists in the text
      // any more to route through `setGmlVar`. `shake_remain` (a real,
      // project-defined camera-shake field from a real project's own
      // obj_camera) is a genuinely un-special-cased instance variable,
      // exercising the same real regression this test documents.
      const out = transpileGML("shake_remain = 0;\nvisible = true;");
      // A real, severe, previously-undiscovered regression this replaces:
      // a plain `var shake_remain = 0;` is scoped to *this one generated
      // event function* — a later event reading `shake_remain` would see a
      // fresh, undeclared identifier, never the value Create actually set.
      // GmlInstanceVars (compat/gmlInstanceVars.ts) is the real fix: a
      // per-(World, eid) side-table that genuinely persists for the whole
      // entity lifetime, the same way a real GameMaker instance field does.
      expect(out).toContain(
        'GmlActions.setGmlVar(_entity, _ctx, "shake_remain", 0);',
      );
      expect(out).toContain(
        'GmlActions.setGmlVar(_entity, _ctx, "visible", true);',
      );
      expect(() => new Function(out)).not.toThrow();
    });

    it("also routes a first bare assignment to a project-defined (non-built-in) instance variable through real persistence", () => {
      // Real, confirmed regression: `obj_crate`'s Create event does
      // `mywall = instance_create_layer(...);` — GML implicitly declares
      // `mywall` on this first assignment, and a real project's own
      // obj_camera reads several such implicit fields (cam, follow,
      // shake_remain, ...) every frame in Step after Create sets them —
      // real cross-event persistence, not just within-one-event validity.
      const out = transpileGML("mywall = 5;\nmywall = mywall + 1;");
      expect(out).toContain(
        'GmlActions.setGmlVar(_entity, _ctx, "mywall", 5);',
      );
      expect(out).toContain(
        'GmlActions.setGmlVar(_entity, _ctx, "mywall", GmlActions.gmlNum(GmlActions.getGmlVar(_entity, _ctx, "mywall")) + 1);',
      );
      expect(() => new Function(out)).not.toThrow();
    });

    it("does not redeclare a name that was already declared by an earlier pass (e.g. ds_list/ds_map/ds_grid create)", () => {
      const out = transpileGML("var list = ds_list_create();\nlist = list;");
      expect(out).toContain("var list = [];");
      // Second assignment must stay a plain assignment, not `var list = list;`.
      expect(out.match(/var list/g)?.length).toBe(1);
    });

    it("does not merge a bare (semicolon-omitted) statement into the next line's own statement — real gap found in obj_enemy.gml", () => {
      // Real, confirmed regression: obj_enemy's Step event has
      // `grounded = true\nshake_remain = 1;` — GML's `;` is optional, so the
      // bare newline alone ends the first statement. The multi-line-RHS fix
      // above (which must keep scanning past a newline for a genuinely
      // open call like `choose(a,\n b)`) initially over-corrected: it kept
      // scanning past *any* newline regardless of paren depth, merging
      // `shake_remain = 1;` straight into `grounded`'s own expression.
      // (`image_speed` was this test's original filler identifier; it now
      // has its own dedicated rewrite — see the "image_index / image_speed"
      // describe block above — so a genuinely un-special-cased built-in is
      // used here instead, to keep exercising this pass, not that one.)
      const out = transpileGML("grounded = true\nshake_remain = 1;");
      expect(out).toContain(
        'GmlActions.setGmlVar(_entity, _ctx, "grounded", true);',
      );
      expect(out).toContain(
        'GmlActions.setGmlVar(_entity, _ctx, "shake_remain", 1);',
      );
      expect(() => new Function(out)).not.toThrow();
    });
  });

  describe("real-project regressions found exercising GmsProjectRuntime end to end", () => {
    it("keeps GML `var` as `var`, not `let`, so a redeclared local in the same event does not throw", () => {
      // Real, confirmed regression: a compiled/unrolled Step event with
      // several near-identical blocks, each starting `var _pNumber = 0;` /
      // `var _pNumber = 1;` / ... (one per player index). GML's `var` is
      // function-scoped and explicitly tolerates redeclaring the same
      // local more than once in the same function body; JS `let` does not
      // — rewriting to `let` produced a hard `SyntaxError: Identifier
      // '_pNumber' has already been declared` at module load.
      const out = transpileGML(
        "var _pNumber = 0;\n_pNumber += 1;\nvar _pNumber = 1;\n_pNumber += 1;\n",
      );
      expect(out).not.toMatch(/\blet\b/);
      expect(out.match(/var _pNumber/g)?.length).toBe(2);
      expect(() => new Function(out)).not.toThrow();
    });

    it("converts a GML $RRGGBB hex-colour literal to a real JS 0x hex literal", () => {
      // Real, confirmed regression: `ltng_color = $fff0ee;` — GML's hex
      // colour literal syntax. Left untouched, `$fff0ee` parses as a bare
      // JS identifier (`$` is a legal identifier character), throwing
      // `ReferenceError: $fff0ee is not defined` at runtime.
      const out = transpileGML("ltng_color = $fff0ee;\n");
      expect(out).toContain("0xfff0ee");
      expect(out).not.toContain("$fff0ee");
      expect(() => new Function(out)).not.toThrow();
    });

    it("converts an 8-digit GML $AABBGGRR hex-colour literal too", () => {
      const out = transpileGML("c = $80fff0ee;\n");
      expect(out).toContain("0x80fff0ee");
    });

    it("does not mangle a dotted alarm assignment on another instance (creator.alarm[n] = ...)", () => {
      // Real, confirmed regression: `creator.alarm[1] = 1;` — GML's alarm-
      // migration-comment rewrite matched starting mid-expression at
      // "alarm" (ignoring the `creator.` prefix), leaving `creator.`
      // dangling with nothing after its `.` once the rest of the line
      // became a `//` comment — a hard `SyntaxError: Unexpected token ';'`.
      const out = transpileGML("creator.alarm[1] = 1;\n");
      expect(out).not.toMatch(/creator\.\s*(\r?\n|$)/);
      expect(() => new Function(out)).not.toThrow();
    });

    it("rewrites a bare (this-instance) alarm assignment onto the real action_set_alarm side-table (no longer a dead comment)", () => {
      const out = transpileGML("alarm[1] = 1;\n");
      expect(out).toContain(
        "GmlActions.action_set_alarm(_entity, _ctx, 1, GmlActions.gmlNum(1));",
      );
      expect(out).not.toContain("startCoroutine");
    });

    it("rewrites a bare alarm read onto get_gml_alarm, gmlNum-coerced", () => {
      const out = transpileGML("if (alarm[0] <= 0) { x = 1; }\n");
      expect(out).toContain(
        "GmlActions.gmlNum(GmlActions.get_gml_alarm(_entity, _ctx, 0))",
      );
    });

    describe("bare single-line if whose body is a rewritten GML built-in", () => {
      // Real, confirmed regression against a real GameMaker object's
      // Step_1.gml: `if (sign(hsp) != 0) image_xscale = sign(hsp) *
      // other.size;` — a bare (brace-less) single-line `if` whose already-
      // parenthesised condition is followed directly by an assignment that
      // this session's own `image_xscale`/`image_yscale`/etc. rewrite turns
      // into a multi-statement IIFE. The pre-existing "if (a) <trailing
      // condition continuation>" pass has no `{` on the same line to anchor
      // against, so its lazy match kept expanding *past* the body's own
      // `;`, across unrelated following statements, until it found some
      // later, wholly unrelated `{` — fusing the if's condition, its own
      // body, and an unrelated following statement into one broken,
      // unclosed `if (...)`. Confirmed via a real `tsc --noEmit` run
      // (`TS1005`/`TS1128`) before this fix; every case here is checked via
      // `new Function()` as a real syntax-validity proof, matching this
      // file's own existing pattern for the same class of bug.
      it("does not corrupt a bare if whose body rewrites to an image_xscale/image_yscale IIFE, with a later unrelated braced if in the same file", () => {
        const gml =
          "if (sign(hsp) != 0) image_xscale = sign(hsp) * other.size;\n" +
          "image_yscale = other.size;\n" +
          "if (place_meeting(x, y, obj_wall))\n{\n  hsp = 0;\n}\n";
        const out = transpileGML(gml);
        expect(() => new Function(out)).not.toThrow();
        // The condition keeps its own, single set of parens — no extra
        // unbalanced paren merged in from the (unrelated) following
        // statements. `hsp` is a real implicit instance variable (assigned
        // later via `hsp = 0;`), so its read here routes through
        // GmlInstanceVars like any other genuine read.
        expect(out).toMatch(
          /^if\ \(GmlActions\.sign\(GmlActions\.gmlNum\(GmlActions\.getGmlVar\(_entity,\ _ctx,\ "hsp"\)\)\)\ !=\ 0\)/,
        );
      });

      it("does not corrupt a bare if whose body rewrites to a sprite_index IIFE", () => {
        const gml =
          "if (a) sprite_index = spr_walk;\n" + "if (b)\n{\n  foo();\n}\n";
        const out = transpileGML(gml);
        expect(() => new Function(out)).not.toThrow();
      });

      it("does not corrupt a bare if whose body rewrites to an image_blend IIFE", () => {
        const gml = "if (a) image_blend = $ff00ff;\nif (b)\n{\n  foo();\n}\n";
        const out = transpileGML(gml);
        expect(() => new Function(out)).not.toThrow();
      });

      it("does not corrupt a bare if whose body rewrites to a timeline_index IIFE", () => {
        const gml = "if (a) timeline_index = tmFoo;\nif (b)\n{\n  foo();\n}\n";
        const out = transpileGML(gml);
        expect(() => new Function(out)).not.toThrow();
      });

      it("does not corrupt a bare if whose body is a threaded place_meeting call", () => {
        const gml =
          "if (a) place_meeting(x, y, obj_wall);\nif (b)\n{\n  foo();\n}\n";
        const out = transpileGML(gml);
        expect(() => new Function(out)).not.toThrow();
      });

      it("does not corrupt a bare if whose body is a threaded DnD action call", () => {
        const gml = "if (a) action_move(2, 4);\nif (b)\n{\n  foo();\n}\n";
        const out = transpileGML(gml);
        expect(() => new Function(out)).not.toThrow();
      });
    });

    it("does not double-declare the second declarator of a comma-continued multi-line var statement", () => {
      // Real, confirmed regression against a real GameMaker project's own
      // `scr_kill_player.gml`: `var x_ = x,\n        y_ = y;` — GML's real
      // multi-declarator `var` syntax, byte-for-byte the same as standard
      // JS/TS's own comma-separated declarator list and already valid
      // output on its own. The generic "auto-declare on first bare
      // assignment" pass, scanning purely line-by-line with no memory of
      // the previous line, mistook the continuation line `y_ = y;` for its
      // own fresh statement and re-prefixed it with a second `var`,
      // producing `var x_ = x,\n  var y_ = y;` — a `var` keyword sitting
      // right after a trailing comma, a hard `SyntaxError: Trailing comma
      // not allowed`.
      const out = transpileGML("var x_ = 1,\n    y_ = 2;\nfoo(x_, y_);\n");
      expect(out.match(/\bvar\s+y_/g)).toBeNull();
      expect(out).not.toMatch(/,\s*\n\s*var\b/);
      expect(() => new Function(out)).not.toThrow();
    });
  });
});

// ---------------------------------------------------------------------------
// GameMaker's colour constants and pure (non-entity) built-in functions —
// compat/gml.ts fully implements and exports ~20 of these (sign, lerp,
// random_range, choose, point_distance, c_white, c_black, ...) but nothing
// in this transpiler ever rewrote a bare call/reference to route through
// them — a real, confirmed, severe gap: a real project's own obj_camera
// calls sign(hsp)/random_range(...) every frame, and uses c_white/c_black/
// c_gray roughly 48 times across 20 files, every one left as a bare,
// undeclared identifier (a hard ReferenceError at runtime).
// ---------------------------------------------------------------------------

describe("transpileGML — GML colour constants and pure built-in functions", () => {
  it("rewrites a bare colour constant to the real GmlActions export", () => {
    const out = transpileGML("draw_set_colour(c_red);\nx = c_white;");
    expect(out).toContain("GmlActions.c_red");
    expect(out).toContain("GmlActions.c_white");
  });

  it("does not mis-rewrite string_length, already handled by its own dedicated pass, as a bare `string` reference", () => {
    const out = transpileGML("x = string_length(s);");
    expect(out).not.toContain("GmlActions.string(");
  });
});

describe("transpileGML — room_width/room_height bare built-in variables", () => {
  it("does not double-rewrite an already-function-call-shaped occurrence", () => {
    const out = transpileGML("surface_resize(surf, room_width, room_height);");
    expect(out).not.toContain("room_width()()");
  });
});

describe("transpileGML — GameMaker legacy d3d_* pseudo-3D projection compat", () => {
  it("threads the calling entity through d3d_set_projection_ortho/perspective", () => {
    const out = transpileGML(
      "d3d_set_projection_ortho(x, y, 64, 64, 0);\n" +
        "d3d_set_projection_perspective(x, y, 64, 64, 0);\n",
    );
    expect(out).toContain(
      "GmlActions.d3d_set_projection_ortho(_entity, (_entity.get(GmlActions.Transform)?.x ?? 0), (_entity.get(GmlActions.Transform)?.y ?? 0), 64, 64, 0)",
    );
    expect(out).toContain(
      "GmlActions.d3d_set_projection_perspective(_entity, (_entity.get(GmlActions.Transform)?.x ?? 0), (_entity.get(GmlActions.Transform)?.y ?? 0), 64, 64, 0)",
    );
  });

  it("threads the calling entity through every d3d_transform_set_* call, including zero-argument ones", () => {
    const out = transpileGML(
      "d3d_transform_set_identity();\n" +
        "d3d_transform_set_translation(x, y, 0);\n" +
        "d3d_transform_set_rotation_z(45);\n" +
        "d3d_transform_set_rotation_x(30);\n" +
        "d3d_transform_set_rotation_y(30);\n" +
        "d3d_transform_set_scaling(2, 2, 1);\n" +
        "d3d_transform_clear();\n",
    );
    expect(out).toContain("GmlActions.d3d_transform_set_identity(_entity)");
    expect(out).toContain(
      "GmlActions.d3d_transform_set_translation(_entity, (_entity.get(GmlActions.Transform)?.x ?? 0), (_entity.get(GmlActions.Transform)?.y ?? 0), 0)",
    );
    expect(out).toContain(
      "GmlActions.d3d_transform_set_rotation_z(_entity, 45)",
    );
    expect(out).toContain(
      "GmlActions.d3d_transform_set_rotation_x(_entity, 30)",
    );
    expect(out).toContain(
      "GmlActions.d3d_transform_set_rotation_y(_entity, 30)",
    );
    expect(out).toContain(
      "GmlActions.d3d_transform_set_scaling(_entity, 2, 2, 1)",
    );
    expect(out).toContain("GmlActions.d3d_transform_clear(_entity)");
  });
});

describe("transpileGML — GameMaker particle-function family (part_type_*/part_system_*/part_particles_*)", () => {
  it("rewrites pure, non-context particle functions with no _entity/_ctx threading", () => {
    const out = transpileGML(
      "part_type_create();\n" +
        "part_type_shape(1, 0);\n" +
        "part_type_size(1, 0.1, 0.3, 0, 0);\n" +
        "part_type_colour1(1, c_red);\n" +
        "part_type_blend(1, true);\n" +
        "part_system_create();\n" +
        "part_system_position(1, 4, 5);\n" +
        "part_particles_clear(1);\n",
    );
    expect(out).toContain("GmlActions.part_type_create()");
    expect(out).toContain("GmlActions.part_type_shape(1, 0)");
    expect(out).toContain("GmlActions.part_type_size(1, 0.1, 0.3, 0, 0)");
    expect(out).toContain("GmlActions.part_type_colour1(1, GmlActions.c_red)");
    expect(out).toContain("GmlActions.part_type_blend(1, true)");
    expect(out).toContain("GmlActions.part_system_create()");
    expect(out).toContain("GmlActions.part_system_position(1, 4, 5)");
    expect(out).toContain("GmlActions.part_particles_clear(1)");
    expect(() => new Function(out)).not.toThrow();
  });

  it("threads _ctx (not _entity) through part_system_destroy/part_particles_create/part_particles_create_colour", () => {
    const out = transpileGML(
      "part_particles_create(1, 4, 5, 2, 5);\n" +
        "part_particles_create_colour(1, 4, 5, 2, c_red, 5);\n" +
        "part_system_destroy(1);\n",
    );
    expect(out).toContain(
      "GmlActions.part_particles_create(_ctx, 1, 4, 5, 2, 5)",
    );
    expect(out).toContain(
      "GmlActions.part_particles_create_colour(_ctx, 1, 4, 5, 2, GmlActions.c_red, 5)",
    );
    expect(out).toContain("GmlActions.part_system_destroy(_ctx, 1)");
  });
});

describe("transpileGML — layer_sequence_create()", () => {
  it("threads with no arguments beyond _ctx when the call itself takes none", () => {
    const out = transpileGML("layer_sequence_create();");
    expect(out).toContain("GmlActions.layer_sequence_create(_ctx)");
  });
});

describe("transpileGML — GMS2.3+ array function family", () => {
  it("rewrites array_create/array_resize", () => {
    const out = transpileGML(
      "var arr = array_create(4, 0);\narray_resize(arr, 8);",
    );
    expect(out).toContain("GmlActions.array_create(4, 0)");
    expect(out).toContain("GmlActions.array_resize(arr, 8);");
  });
});

describe("transpileGML — GML `static` variable semantics", () => {
  it("rewrites `static x = 0;` into a valid-JS lazy-init against GmlActions.gmlStatics, not a SyntaxError-prone class-body static", () => {
    const out = transpileGML(
      "static counter = 0;\nreturn counter;",
      [],
      new Set(),
      false,
      "onUpdate",
    );
    expect(out).not.toMatch(/^\s*static\s/m);
    expect(out).toContain("GmlActions.gmlStatics");
    expect(out).toContain(
      'if (!("onUpdate::counter::0" in GmlActions.gmlStatics))',
    );
    // Must be real, executable JS — a direct `new Function` probe is the
    // same technique CLAUDE.md's own gap-writeup used to confirm the
    // *old* `SyntaxError`, so it's the right technique to prove the fix.
    expect(() => new Function(out)).not.toThrow();
  });

  it("a static var persists its value across two separate calls to the same generated function", () => {
    // Plain assignment (not `+=`) deliberately — the compound-assignment
    // rewrite emits a TypeScript `as` cast (matching this file's existing
    // GmlInstanceVars compound-assignment output), which real `new
    // Function` can't parse as plain JS; every other execution-based test
    // in this file sticks to plain assignment for the same reason.
    const body = transpileGML(
      "static counter = 0;\ncounter = counter + 1;\nreturn counter;",
      [],
      new Set(),
      false,
      "onUpdate",
    );
    const GmlActions = { gmlStatics: {} as Record<string, unknown> };
    const fn = new Function("GmlActions", body);
    expect(fn(GmlActions)).toBe(1);
    expect(fn(GmlActions)).toBe(2);
    expect(fn(GmlActions)).toBe(3);
  });

  it("a static var's initializer runs exactly once, not on every call", () => {
    const body = transpileGML(
      "static seen = 0;\nseen = seen + 1;\nreturn seen;",
      [],
      new Set(),
      false,
      "onCreate",
    );
    // `static seen = 0;` only ever assigns the literal `0` once, at
    // first-call time — a naive re-run-every-call rewrite would reset
    // `seen` back to 0 before the increment on every call, so this would
    // never climb past 1. Asserted the same way the "persists" test above
    // proves persistence, from the other direction.
    const GmlActions = { gmlStatics: {} as Record<string, unknown> };
    const fn = new Function("GmlActions", body);
    fn(GmlActions);
    fn(GmlActions);
    const result = fn(GmlActions);
    expect(result).toBe(3);
  });

  it("two different generated functions with a same-named static var don't collide", () => {
    const bodyA = transpileGML(
      "static x = 10;\nx = x + 1;\nreturn x;",
      [],
      new Set(),
      false,
      "onUpdate",
    );
    const bodyB = transpileGML(
      "static x = 100;\nx = x + 1;\nreturn x;",
      [],
      new Set(),
      false,
      "onCreate",
    );
    const GmlActions = { gmlStatics: {} as Record<string, unknown> };
    const fnA = new Function("GmlActions", bodyA);
    const fnB = new Function("GmlActions", bodyB);
    expect(fnA(GmlActions)).toBe(11);
    expect(fnB(GmlActions)).toBe(101);
    // Calling A again must not have been perturbed by B's own same-named
    // static — proves the two slots are genuinely independent, keyed by
    // `functionId`, not just by the bare variable name.
    expect(fnA(GmlActions)).toBe(12);
    expect(fnB(GmlActions)).toBe(102);
  });

  it("`static x;` (no initializer) defaults to undefined, matching GameMaker's own real default", () => {
    const body = transpileGML(
      "static x;\nreturn x;",
      [],
      new Set(),
      false,
      "onCreate",
    );
    const GmlActions = { gmlStatics: {} as Record<string, unknown> };
    const fn = new Function("GmlActions", body);
    expect(fn(GmlActions)).toBeUndefined();
  });
});

describe("transpileGML — x/y built-in position variables", () => {
  it("rewrites a bare read inside a call argument (place_meeting(x, y + 1, obj_wall))", () => {
    const out = transpileGML(
      "onground = place_meeting(x, y + 1, obj_wall);",
      [],
      new Set(),
      false,
      "fn",
    );
    expect(out).toContain("(_entity.get(GmlActions.Transform)?.x ?? 0)");
    expect(out).toContain("(_entity.get(GmlActions.Transform)?.y ?? 0) + 1");
  });

  it("rewrites plain assignment (y = 100;)", () => {
    const out = transpileGML("y = 100;", [], new Set(), false, "fn");
    expect(out).toContain("_t.y = 100;");
  });

  it("rewrites increment/decrement (x++; y--;)", () => {
    const out = transpileGML("x++;\ny--;", [], new Set(), false, "fn");
    expect(out).toContain("_t.x += 1");
    expect(out).toContain("_t.y -= 1");
  });

  it("does not corrupt code following a comment with a stray apostrophe (the real string-masking bug this fix closes)", () => {
    const src = [
      "// Taking away the player's control",
      "onground = place_meeting(x, y + 1, obj_wall);",
      "// Add the gun's direction to the bullet's direction",
      "onwall = place_meeting(x + 1, y, obj_wall);",
    ].join("\n");
    const out = transpileGML(src, [], new Set(), false, "fn");
    // Both calls — one before the odd-apostrophe-count comments, one
    // after two more of them — must be fully rewritten. Before the fix,
    // the pair of stray apostrophes across the two comments made the
    // masking regex swallow everything between them as one fake "string
    // literal", leaving `x`/`y` bare and unrewritten in the swallowed
    // region.
    const xHits = out.match(/_entity\.get\(GmlActions\.Transform\)\?\.x/g);
    expect(xHits?.length).toBe(2);
  });
});

describe("transpileGML — keyboard/gamepad/mouse input functions", () => {
  it("threads keyboard_check(vk) to GmlActions.keyboard_check(_ctx, ...)", () => {
    const out = transpileGML(
      "key_right = keyboard_check(vk_right);",
      [],
      new Set(),
      false,
      "fn",
    );
    expect(out).toContain(
      "GmlActions.keyboard_check(_ctx, GmlActions.vk_right)",
    );
  });

  it("threads keyboard_check_pressed and gamepad_axis_value", () => {
    const out = transpileGML(
      "key_jump = keyboard_check_pressed(vk_up);\nv = gamepad_axis_value(0, gp_axislh);",
      [],
      new Set(),
      false,
      "fn",
    );
    expect(out).toContain(
      "GmlActions.keyboard_check_pressed(_ctx, GmlActions.vk_up)",
    );
    expect(out).toContain(
      "GmlActions.gamepad_axis_value(_ctx, 0, GmlActions.gp_axislh)",
    );
  });

  it("threads display_get_gui_width/height and application_surface", () => {
    const out = transpileGML(
      "w = display_get_gui_width();\nh = display_get_gui_height();\nsurface_get_width(application_surface);",
      [],
      new Set(),
      false,
      "fn",
    );
    expect(out).toContain("GmlActions.display_get_gui_width(_ctx)");
    expect(out).toContain("GmlActions.display_get_gui_height(_ctx)");
    expect(out).toContain(
      "GmlActions.surface_get_width(_ctx, GmlActions.application_surface)",
    );
  });
});

describe("transpileGML — draw_set_color (American spelling alias)", () => {
  it("rewrites draw_set_color the same way draw_set_colour is rewritten", () => {
    const out = transpileGML(
      "draw_set_color(c_white);",
      [],
      new Set(),
      false,
      "fn",
    );
    expect(out).toContain("_ctx.drawTarget?.setColor(GmlActions.c_white);");
  });
});

describe("transpileGML — max/min/abs/ord and room", () => {
  it("threads max/min/abs as pure functions", () => {
    const out = transpileGML(
      "v = max(a, 0);\nw = min(b, 1);\nu = abs(-5);",
      [],
      new Set(),
      false,
      "fn",
    );
    expect(out).toContain("GmlActions.max(");
    expect(out).toContain("GmlActions.min(");
    // `abs` is rewritten by a separate, pre-existing pass straight to
    // `Math.abs` rather than `GmlActions.abs` — see the doc comment on
    // this file's `THREADED_PURE_FUNCTIONS` list for why `abs` isn't in
    // it.
    expect(out).toContain("Math.abs(");
  });

  it("threads ord()", () => {
    const out = transpileGML(
      'key_restart = keyboard_check_pressed(ord("R"));',
      [],
      new Set(),
      false,
      "fn",
    );
    expect(out).toContain('GmlActions.ord("R")');
  });

  it("rewrites a bare room read to GmlActions.room(_ctx)", () => {
    const out = transpileGML(
      "if (room == rm_menu) { x = 0; }",
      [],
      new Set(),
      false,
      "fn",
    );
    expect(out).toContain("GmlActions.room(_ctx)");
  });
});

describe("transpileGML — draw_set_halign/draw_set_valign/draw_set_font/draw_set_alpha and fa_* constants", () => {
  it("rewrites draw_set_halign(fa_center) to a drawTarget call with the fa_center constant threaded", () => {
    const out = transpileGML("draw_set_halign(fa_center);");
    expect(out).toContain(
      "_ctx.drawTarget?.setHalign?.(GmlActions.fa_center);",
    );
  });

  it("rewrites draw_set_valign(fa_bottom)", () => {
    const out = transpileGML("draw_set_valign(fa_bottom);");
    expect(out).toContain(
      "_ctx.drawTarget?.setValign?.(GmlActions.fa_bottom);",
    );
  });

  it("rewrites draw_set_alpha(0.5)", () => {
    const out = transpileGML("draw_set_alpha(0.5);");
    expect(out).toContain("_ctx.drawTarget?.setAlpha?.(0.5);");
  });

  it("rewrites every fa_* constant to a GmlActions reference", () => {
    const out = transpileGML(
      "a = fa_left; b = fa_center; c = fa_right; d = fa_top; e = fa_middle; f = fa_bottom;",
    );
    for (const name of [
      "fa_left",
      "fa_center",
      "fa_right",
      "fa_top",
      "fa_middle",
      "fa_bottom",
    ]) {
      expect(out).toContain(`GmlActions.${name}`);
    }
  });
});

describe("transpileGML — draw_self, instance_change, room_exists, audio_sound_pitch, display_get_width/height, window_set_size, surface_resize", () => {
  it("threads draw_self() to GmlActions.draw_self(_entity, _ctx)", () => {
    const out = transpileGML("draw_self();");
    expect(out).toContain("GmlActions.draw_self(_entity, _ctx)");
  });

  it("threads display_get_width/display_get_height", () => {
    const out = transpileGML(
      'str = "Display: " + String(display_get_width()) + " x " + String(display_get_height());',
    );
    expect(out).toContain("GmlActions.display_get_width(_ctx)");
    expect(out).toContain("GmlActions.display_get_height(_ctx)");
  });
});

describe("transpileGML — legacy e__VW view-script camera accessors", () => {
  it("threads view_get_surface_id/view_set_surface_id and the full view_*port family", () => {
    const out = transpileGML(
      "sid = view_get_surface_id(0); view_set_surface_id(0, 5); x1 = view_get_xport(0); y1 = view_get_yport(0); w1 = view_get_wport(0); h1 = view_get_hport(0);",
    );
    expect(out).toContain("GmlActions.view_get_surface_id(_ctx, 0)");
    expect(out).toContain("GmlActions.view_set_surface_id(_ctx, 0, 5)");
    expect(out).toContain("GmlActions.view_get_xport(_ctx, 0)");
    expect(out).toContain("GmlActions.view_get_yport(_ctx, 0)");
    expect(out).toContain("GmlActions.view_get_wport(_ctx, 0)");
    expect(out).toContain("GmlActions.view_get_hport(_ctx, 0)");
  });
});

describe("transpileGML — real project-defined GML enum declarations", () => {
  it("strips a known enum declaration and rewrites its dot-access references onto GmlEnums", () => {
    setGmlEnumNames(new Set(["TRANS_MODE"]));
    const out = transpileGML(
      "enum TRANS_MODE\n{\n\tOFF,\n\tNEXT,\n\tGOTO\n}\nmode = TRANS_MODE.NEXT;",
    );
    expect(out).not.toContain("enum TRANS_MODE {");
    expect(out).toContain("GmlEnums.TRANS_MODE.NEXT");
    setGmlEnumNames(new Set());
  });

  it("leaves an unknown enum-shaped name untouched", () => {
    setGmlEnumNames(new Set(["TRANS_MODE"]));
    const out = transpileGML("mode = OTHER_ENUM.NEXT;");
    expect(out).not.toContain("GmlEnums.OTHER_ENUM");
    setGmlEnumNames(new Set());
  });
});

describe("transpileGML — cross-instance dotted references (obj_x.field)", () => {
  it("rewrites a bare cross-instance read onto getGmlObjectVar", () => {
    setGmlObjectNames(new Set(["obj_input"]));
    const out = transpileGML("d = obj_input.key_down;");
    expect(out).toContain(
      'GmlActions.getGmlObjectVar(_entity, _ctx, "obj_input", "key_down")',
    );
    setGmlObjectNames(new Set());
  });

  it("rewrites a cross-instance assignment onto setGmlObjectVar", () => {
    setGmlObjectNames(new Set(["obj_player"]));
    const out = transpileGML("obj_player.hsp = 4;");
    expect(out).toContain(
      'GmlActions.setGmlObjectVar(_entity, _ctx, "obj_player", "hsp", 4);',
    );
    setGmlObjectNames(new Set());
  });

  it("does not rewrite a dotted access whose LHS is not a known object name", () => {
    setGmlObjectNames(new Set(["obj_player"]));
    const out = transpileGML("v = inst.image_xscale;");
    expect(out).not.toContain("GmlActions.getGmlObjectVar");
    setGmlObjectNames(new Set());
  });
});

describe("transpileGML — getGmlVar/getGmlObjectVar bare-read numeric cast", () => {
  it("casts a bare instance-variable read as number", () => {
    const out = transpileGML(
      "hsp = grav + 1;\ngrav = 0.3;",
      [],
      new Set(["grav"]),
    );
    expect(out).toContain(
      'GmlActions.gmlNum(GmlActions.getGmlVar(_entity, _ctx, "grav"))',
    );
  });

  it("casts a cross-instance bare read as number", () => {
    setGmlObjectNames(new Set(["obj_input"]));
    const out = transpileGML("d = obj_input.key_left + 1;");
    expect(out).toContain(
      'GmlActions.gmlNum(GmlActions.getGmlObjectVar(_entity, _ctx, "obj_input", "key_left"))',
    );
    setGmlObjectNames(new Set());
  });
});

describe("transpileGML — GML local-variable-held instance references", () => {
  it("rewrites a dotted assignment on a local var assigned from instance_place", () => {
    const out = transpileGML("t = instance_place(x, y, obj_wall);\nt.hp = 3;");
    expect(out).toContain(
      'GmlActions.setGmlRefVar(_entity, _ctx, "t", "hp", 3);',
    );
  });

  it("prefers the object-type-name rewrite over the local-ref rewrite for the same name", () => {
    setGmlObjectNames(new Set(["obj_gun"]));
    const out = transpileGML(
      'obj_gun = instance_create_layer(x, y, "Guns", obj_gun);\nv = obj_gun.hp;',
    );
    expect(out).toContain("GmlActions.getGmlObjectVar");
    expect(out).not.toContain("getGmlRefVar");
    setGmlObjectNames(new Set());
  });

  // `_other` — a collision handler's real `_other: Entity` parameter, or a
  // with-block's `const _other = _withCaller;` rescoping — is always a
  // genuine live Entity wherever it appears, so a dotted read/write on it
  // routes through the same getGmlRefVar/setGmlRefVar mechanism as any
  // other local-variable-held Entity reference, closing the previously-
  // untouched `other.image_angle`/`other.hp`-style dotted access gap (see
  // CLAUDE.md).
  it("rewrites a dotted read on _other inside a collision handler", () => {
    const out = transpileGML("hp -= other.damage;", [], new Set(), true);
    expect(out).toContain(
      'GmlActions.gmlNum(GmlActions.getGmlEntityField(_ctx, _other, "damage"))',
    );
  });

  it("rewrites a dotted assignment on _other inside a with-block", () => {
    const out = transpileGML("with (obj_enemy) { other.hp = 5; }");
    expect(out).toContain(
      'GmlActions.setGmlEntityField(_ctx, _other, "hp", 5);',
    );
  });
});

describe("transpileGML — bare asset-name identifiers used as plain values", () => {
  it("resolves a bare sprite-name value assigned to a non-sprite_index local", () => {
    setGmlSpriteNames(new Set(["spr_player_walk", "spr_player_stand"]));
    const out = transpileGML(
      "spr_ind = spr_player_stand;\nif (spr_ind == spr_player_walk) { spr_ind = spr_player_stand; }",
    );
    expect(out).toContain(
      '"spr_ind", "./assets/sprites/spr_player_stand/frame_0.png"',
    );
    expect(out).toContain('"./assets/sprites/spr_player_walk/frame_0.png"');
    setGmlSpriteNames(new Set());
  });

  it("resolves a bare sound-name value to its bare id string", () => {
    setGmlSoundNames(new Set(["snd_landing"]));
    const out = transpileGML("my_sound = snd_landing;");
    expect(out).toContain('"my_sound", "snd_landing"');
    setGmlSoundNames(new Set());
  });

  it("resolves a bare font-name value to its bare id string", () => {
    setGmlFontNames(new Set(["fnt_menu"]));
    const out = transpileGML("menu_font = fnt_menu;");
    expect(out).toContain('"menu_font", "fnt_menu"');
    setGmlFontNames(new Set());
  });

  it("resolves a bare room-name value compared against room", () => {
    setGmlRoomNames(new Set(["rm_init"]));
    const out = transpileGML("if (room == rm_init) room_goto_next();");
    expect(out).toContain('== "rm_init"');
    setGmlRoomNames(new Set());
  });

  it("does not double-handle sprite_index's own already-quoted equality comparison", () => {
    setGmlSpriteNames(new Set(["spr_dad_idle"]));
    const out = transpileGML("if (sprite_index == spr_dad_idle) { x = 1; }");
    // Exactly one occurrence of the quoted path, not a nested/doubled quote.
    const matches = out.match(/spr_dad_idle\/frame_0\.png/g) ?? [];
    expect(matches.length).toBe(1);
    expect(out).not.toContain('""./assets');
    setGmlSpriteNames(new Set());
  });

  it("does not corrupt a draw_sprite call's already-quoted sprite argument", () => {
    setGmlSpriteNames(new Set(["spr_foo"]));
    const out = transpileGML("draw_sprite(spr_foo, 0, x, y);");
    const matches = out.match(/spr_foo\/frame_0\.png/g) ?? [];
    expect(matches.length).toBe(1);
    setGmlSpriteNames(new Set());
  });

  it("does not rewrite a name inside a real string literal", () => {
    setGmlRoomNames(new Set(["rm_init"]));
    const out = transpileGML(
      'show_debug_message("please visit rm_init soon");',
    );
    expect(out).toContain('"please visit rm_init soon"');
    setGmlRoomNames(new Set());
  });

  it("resolves a bare object-name argument to action_create_object left unquoted by THREADED_ACTIONS", () => {
    setGmlObjectNames(new Set(["obj_gun"]));
    const out = transpileGML("instance_create(x, y, obj_gun);");
    expect(out).toContain('"obj_gun"');
    setGmlObjectNames(new Set());
  });

  it("produces valid runnable JS for a mix of resolved asset values", () => {
    setGmlSpriteNames(new Set(["spr_a"]));
    setGmlRoomNames(new Set(["rm_a"]));
    const out = transpileGML(
      "function f(_entity, _ctx) {\n  var s = spr_a;\n  if (room == rm_a) { s = spr_a; }\n  return s;\n}",
    );
    expect(() => new Function(out)).not.toThrow();
    setGmlSpriteNames(new Set());
    setGmlRoomNames(new Set());
  });
});

describe("transpileGML — project-wide cross-file entity-reference field names", () => {
  it("resolves a dotted read of a field with no same-function assignment, via the project-wide set (obj_Egun's real owner.x shape)", () => {
    setGmlCrossFileEntityRefFields(new Set(["owner"]));
    const out = transpileGML("x = owner.x;");
    expect(out).toContain(
      'GmlActions.getGmlRefVar(_entity, _ctx, "owner", "x")',
    );
    setGmlCrossFileEntityRefFields(new Set());
  });

  it("resolves a dotted write of a project-wide known field the same way a same-function local ref does", () => {
    setGmlCrossFileEntityRefFields(new Set(["owner"]));
    const out = transpileGML("owner.hp = 5;");
    expect(out).toContain(
      'GmlActions.setGmlRefVar(_entity, _ctx, "owner", "hp", 5);',
    );
    setGmlCrossFileEntityRefFields(new Set());
  });

  it("never treats a real project object-type name as a cross-file ref field, even if also in the set", () => {
    setGmlObjectNames(new Set(["obj_player"]));
    setGmlCrossFileEntityRefFields(new Set(["obj_player"]));
    const out = transpileGML("x = obj_player.x;");
    expect(out).toContain(
      'GmlActions.getGmlObjectVar(_entity, _ctx, "obj_player", "x")',
    );
    expect(out).not.toContain("getGmlRefVar");
    setGmlObjectNames(new Set());
    setGmlCrossFileEntityRefFields(new Set());
  });

  it("produces valid runnable JS", () => {
    setGmlCrossFileEntityRefFields(new Set(["owner"]));
    const out = transpileGML(
      "function f(_entity, _ctx) {\n  return owner.x;\n}",
    );
    expect(() => new Function(out)).not.toThrow();
    setGmlCrossFileEntityRefFields(new Set());
  });
});

describe("transpileGML — with-target entity-typed local var (my_gun/owner real shape)", () => {
  it("passes a same-function Entity-holding local var straight through with_each, not gmlNum-coerced", () => {
    const out = transpileGML(
      'my_gun = instance_create_layer(x, y, "Gun", obj_Egun);\nwith (my_gun) { owner = other.id; }',
    );
    expect(out).toContain(
      'GmlActions.with_each(_ctx, GmlActions.getGmlVar(_entity, _ctx, "my_gun"), (_entity) => {',
    );
    expect(out).not.toContain(
      'GmlActions.with_each(_ctx, GmlActions.gmlNum(GmlActions.getGmlVar(_entity, _ctx, "my_gun"))',
    );
    // `other.id` inside the with-body resolves to the plain with-caller
    // reference, not a dangling `.id` on a real `Entity`.
    expect(out).toContain(
      'GmlActions.setGmlVar(_entity, _ctx, "owner", _other);',
    );
    expect(() => new Function(out)).not.toThrow();
  });
});

describe("transpileGML — image_number (read-only bare built-in)", () => {
  it("rewrites a bare read to GmlActions.get_gml_image_number(_entity)", () => {
    const out = transpileGML("if (image_number > 1) { frame += 1; }");
    expect(out).toContain("GmlActions.get_gml_image_number(_entity)");
    expect(() => new Function(out)).not.toThrow();
  });

  it("does not rewrite a call-shaped or dotted occurrence", () => {
    const out = transpileGML("d = other.image_number;");
    expect(out).not.toContain("get_gml_image_number");
  });
});

describe("transpileGML — shader_set / shader_reset / uniforms", () => {
  it("does not resolve a name that is also a sprite (cross-kind ambiguity stays unresolved)", () => {
    setGmlShaderNames(new Set(["dup"]));
    setGmlSpriteNames(new Set(["dup"]));
    const out = transpileGML("var s = dup;");
    setGmlShaderNames(new Set());
    setGmlSpriteNames(new Set());
    expect(out).not.toContain('"dup"');
  });
});

describe("transpileGML — fresh-sweep batch (string-literal room, nested min/max, room_goto var, entity-ref locals)", () => {
  it("does not rewrite `room` inside a string literal", () => {
    const out = transpileGML('var r = save_data[? "room"];');
    expect(out).not.toContain('room(_ctx)"');
    expect(out).toContain('"room"');
  });

  it("rewrites min/max nested deeper than two paren levels", () => {
    const out = transpileGML("p = min(1.2, p + max(((1.2 - p) / 10), 0.005));");
    expect(out).toContain("GmlActions.min(1.2");
    expect(out).not.toMatch(/[^.]\bmin\(/);
  });
});

describe("transpileGML — ds_map accessor on an implicit instance variable, depth compound", () => {
  it("resolves `map[? k]` on an instance variable through gmlMap", () => {
    const out = transpileGML('map = scr_load_json("a");\nv = map[? "k"];');
    expect(out).toContain(
      'GmlActions.gmlMap(GmlActions.getGmlVar(_entity, _ctx, "map")).get(',
    );
  });

  it("compound depth write uses a reassignable binding", () => {
    const out = transpileGML("depth += 1;");
    expect(out).toContain("let _gmlDepth");
    expect(() => new Function("_entity", "GmlActions", out)).not.toThrow();
  });
});

describe("transpileGML — GMS2 cutout lighting (surfaces, blend modes, legacy view vars)", () => {
  const LIGHT = [
    "surface_set_target(surf);",
    "draw_clear(c_black);",
    "gpu_set_blendmode(bm_subtract);",
    "draw_ellipse_color(0, 0, 64, 64, c_orange, c_black, false);",
    "draw_triangle_color(0, 0, 8, 0, 8, 8, c_yellow, c_black, c_black, false);",
    "surface_reset_target();",
    "gpu_set_blendmode(bm_normal);",
    "draw_surface(surf, view_xview, view_yview);",
    "surf = surface_create(view_wview, view_hview);",
  ].join("\n");

  it("threads the real surface/blend/draw calls and constants", () => {
    const out = transpileGML(LIGHT);
    expect(out).toContain("GmlActions.surface_set_target(_ctx,");
    expect(out).toContain("GmlActions.draw_clear(_ctx, GmlActions.c_black)");
    expect(out).toContain(
      "GmlActions.gpu_set_blendmode(_ctx, GmlActions.bm_subtract)",
    );
    expect(out).toContain("GmlActions.surface_reset_target(_ctx)");
    expect(out).toContain("GmlActions.draw_surface(_ctx,");
    expect(out).toContain("GmlActions.surface_create(_ctx,");
    expect(out).toContain("GmlActions.draw_ellipse_color(_ctx.drawTarget,");
    expect(out).toContain("GmlActions.draw_triangle_color(_ctx.drawTarget,");
  });

  it("rewrites legacy view_xview/view_wview reads onto view 0's camera getters", () => {
    const out = transpileGML("var w = view_wview; var x0 = view_xview[0];");
    expect(out).toContain(
      "GmlActions.camera_get_view_width(_ctx, GmlActions.view_get_camera(_ctx, 0))",
    );
    expect(out).toContain(
      "GmlActions.camera_get_view_x(_ctx, GmlActions.view_get_camera(_ctx, 0))",
    );
    expect(out).not.toMatch(/\bview_xview\b/);
  });
});

describe("registry-backed getters are ctx-threaded", () => {
  it("threads _ctx into font_get_size, object_exists, asset_get_index, sprite_exists", () => {
    setGmlSpriteNames(new Set(["spr_a"]));
    const out = transpileGML(
      'a = font_get_size(fnt_x); b = object_exists(obj_y); c = asset_get_index("spr_a"); d = sprite_exists(spr_a);',
    );
    expect(out).toContain("GmlActions.font_get_size(_ctx,");
    expect(out).toContain("GmlActions.object_exists(_ctx,");
    expect(out).toContain("GmlActions.asset_get_index(_ctx,");
    expect(out).toContain("GmlActions.sprite_exists(_ctx,");
    setGmlSpriteNames(new Set());
  });

  it("threads the layer element GML calls", () => {
    const out = transpileGML(
      'g = layer_sprite_get_id("TitleAssets", "gGun"); layer_sprite_destroy(g);',
    );
    expect(out).toContain(
      'GmlActions.layer_sprite_get_id(_ctx, "TitleAssets", "gGun")',
    );
    expect(out).toContain("GmlActions.layer_sprite_destroy(_ctx,");
  });
});
