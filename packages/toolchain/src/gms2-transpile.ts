import fs from "fs/promises";

// ---------------------------------------------------------------------------
// GML pattern-level transpiler
// ---------------------------------------------------------------------------

/**
 * Apply regex-based pattern replacements to a GML source string and return
 * the resulting TypeScript snippet.
 *
 * Transformations are applied in order; later passes do not re-process text
 * produced by earlier ones (single-pass sequential replacement).
 */
export function transpileGML(gml: string): string {
  // A real GML source file can be entirely, permanently dead code — a
  // developer opened a `/* ...` block comment to disable a whole event and
  // never added the closing `*/` (GameMaker's own parser is lenient about
  // an unterminated block comment: it just consumes to end of file, so this
  // is valid, inert GML, not a project error). Passed straight through,
  // that same unterminated `/*` is a hard TypeScript parse error — and
  // because it never closes, it can swallow every later pass's own output
  // for the rest of the file too. A simple unpaired-marker count (more
  // `/*` than `*/` in the raw source) is enough to catch the actual shape
  // this takes in practice — the whole file being one big commented-out
  // block — without needing a real GML lexer. When it's unpaired, the
  // event is reported as inert dead code instead of being transpiled: its
  // real content genuinely never ran in GameMaker either, so there's
  // nothing lost by not transpiling it, and doing so would just be a
  // second, TypeScript-flavoured way to break parsing where GML's own
  // leniency didn't.
  const openMarkers = (gml.match(/\/\*/g) ?? []).length;
  const closeMarkers = (gml.match(/\*\//g) ?? []).length;
  if (openMarkers > closeMarkers) {
    return "// [GML source event is entirely inert — its body is one big unterminated /* block comment in the original .gml file, so none of it ever ran in GameMaker either. Nothing to migrate.]";
  }

  let out = gml;

  // Neutralise every real, properly-closed `/* ... */` block comment in the
  // source before any other pass runs. This matters for two separate
  // reasons: (1) real GML source code inside a `/* ... */` block is dead
  // code in GameMaker too — transpiling and emitting it as live code would
  // misrepresent something that never actually ran; (2) several passes
  // below (with, instance_create_layer/instance_destroy, room_goto, …)
  // inject their own `/* TODO: ... */`-style explanatory comment in place
  // of unmodelled GML. If that injection happens to land inside a source
  // comment this pass hasn't neutralised yet, the result is a *nested*
  // block comment — invalid in JS/TS, since the first `*/` found (which
  // could belong to either the original source comment or an injected one)
  // closes the outer comment early and leaves whatever follows as bare,
  // unparseable code up until the next stray `*/`. Collapsing every real
  // source comment to one fixed, content-free placeholder first removes
  // that hazard entirely — nothing injected by a later pass can ever be
  // sitting inside pre-existing comment markers, because none survive past
  // this point.
  out = out.replace(
    /\/\*[\s\S]*?\*\//g,
    "/* [GML comment/dead code omitted] */",
  );

  // -- Variable declarations -------------------------------------------------
  // global.x = expr  →  a TODO comment, not an active statement.
  //
  // GML's `global.x = expr` can legally appear anywhere a statement can —
  // inside onCreate, inside onUpdate, inside a nested if/switch — and GML
  // itself makes no syntactic distinction between "first declaration" and
  // "later reassignment" of a global: both are just `global.x = expr`. A
  // previous version of this pass emitted `export let x = expr;`, which is
  // invalid TypeScript the moment it appears inside a function body (every
  // generated event handler is one), and would also throw a duplicate-
  // declaration error if the same global were assigned more than once in
  // the same file — both real, common shapes in real GML source. There is
  // also no single "the shared global store" concept this engine defines to
  // route it through automatically (unlike `VariableStore`'s numbered
  // switches, a GML global is an arbitrary named value). Left as a
  // commented-out TODO instead, the same "surface for manual review, don't
  // fake it" rule genuinely unmodelled GML already follows elsewhere in
  // this file — it keeps the emitted file syntactically valid TypeScript
  // and doesn't silently misrepresent global (cross-object) state as a
  // function-local variable.
  out = out.replace(
    // `(?!=)` after the `=` keeps this from matching `global.x == y` (a
    // comparison, not an assignment) — without it, `global.x == y` matched
    // "assignment" starting at the first `=`, leaving the second `=` to be
    // swallowed into the captured right-hand-side text, producing garbled
    // output like `= = y`.
    /\bglobal\.(\w+)\s*=(?!=)\s*([^;\n]+);?/g,
    (_m, varName: string, expr: string) =>
      `// TODO: migrate GML global variable "${varName}" (was: global.${varName} = ${expr.trimEnd()};) — wire it to your own shared state.`,
  );
  // var x = expr  →  let x = expr;
  out = out.replace(/\bvar\b(\s+\w+\s*=)/g, "let$1");

  // -- Control flow ----------------------------------------------------------
  // repeat(n) { ... }  →  for (let _i = 0; _i < n; _i++) { ... }
  out = out.replace(
    /\brepeat\s*\(([^)]+)\)/g,
    (_m, n: string) => `for (let _i = 0; _i < ${n.trim()}; _i++)`,
  );
  // for loops: var → let inside for initialiser
  out = out.replace(/\bfor\s*\(\s*var\b/g, "for (let");
  // exit  →  return;
  out = out.replace(/\bexit\b/g, "return;");

  // #region / #endregion — GameMaker's IDE code-folding directives. `#` has
  // no meaning as a line-comment marker in JS/TS (only a `#!` shebang on a
  // file's very first line is special-cased, and this never appears there),
  // so left as-is these are a hard parse failure, not just an "unresolved
  // identifier" type error — the same severity `with` (above) has, and for
  // the same reason: it can take down parsing of the entire file, not just
  // flag the one line for review. Rewritten to the `//` comment form so the
  // region name/marker is preserved for a human reader, just without a
  // meaning the TS parser tries to interpret.
  out = out.replace(/^([ \t]*)#region\b(.*)$/gm, "$1// #region$2");
  out = out.replace(/^([ \t]*)#endregion\b(.*)$/gm, "$1// #endregion$2");

  // if (a) && (b) [&& (c) ...]  →  if ((a) && (b) [&& (c) ...])
  //
  // GML's `if` never requires its condition to be one single parenthesised
  // group — `if a && b { ... }` and `if (a) && (b) { ... }` are both valid
  // GML, since GML only requires *an* expression, parenthesised however the
  // author liked, right after `if`. JS/TS's `if` syntax is stricter: the
  // entire condition must be one parenthesised group immediately after
  // `if`. Left untouched, `if (a) && (b) { ... }` parses in JS as `if (a)`
  // followed by a dangling `&& (b) { ... }` expression statement — not a
  // parse error, so this shape doesn't even surface as an "unresolved
  // identifier" the way genuinely unmodelled GML does; it silently changes
  // which branch runs. Each clause allows up to one level of nested parens
  // (a bare function call used as one clause — `Math.abs(x) > 0.2`,
  // `mouse_check_button(mb_left)` — is a common real shape); a clause with
  // parens nested two or more levels deep is rare enough, and safe enough
  // to leave for manual review, that this doesn't try to handle it.
  // A "clause" allows up to two levels of nested parens — real conditions
  // routinely nest that deep (`Math.round(x + (y / 2)) > z` is a function
  // call, itself containing a further parenthesised sub-expression, used as
  // one clause). A clause nested three or more levels deep is rare enough,
  // and safe enough to leave for manual review, that this doesn't try to
  // handle it.
  const IF_CLAUSE = String.raw`\((?:[^()]|\((?:[^()]|\([^()]*\))*\))*\)`;
  out = out.replace(
    new RegExp(
      `\\bif\\s*(${IF_CLAUSE}(?:\\s*(?:&&|\\|\\|)\\s*${IF_CLAUSE})+)`,
      "g",
    ),
    (_m, cond: string) => `if (${cond})`,
  );

  // if !(a) { ... }  →  if (!(a)) { ... } — same underlying issue as the
  // bare `&&`/`||` chain above (GML's `if` doesn't require its condition to
  // be one single enclosing paren; JS/TS's does), just for a leading `!`
  // instead of a chained boolean operator.
  out = out.replace(
    new RegExp(`\\bif\\s*(!\\s*${IF_CLAUSE})`, "g"),
    (_m, cond: string) => `if (${cond})`,
  );

  // if <bare expr, no enclosing paren at all> { ... }  →  if (<expr>) { ... }
  //
  // The most general form of the same GML/JS `if`-condition gap: GML's
  // `if place_meeting(x, y, obj) { ... }` (a bare call, no parens around
  // the condition at all) and `if !place_meeting(...) && cond2 { ... }`
  // (a bare `!`-prefixed chain, not the already-parenthesised `!(...)`
  // case above) are both real, valid GML. This pass only fires when the
  // condition isn't already paren-led (the negative lookahead) and only
  // when it can find a `{` shortly after the condition (on the same line,
  // or as the very next non-blank line) to anchor where the condition
  // actually ends — the same real, common "braced multi-line if" shape
  // every case seen in practice takes. A single-line, brace-less
  // `if cond statement;` is deliberately left alone rather than risking
  // swallowing the statement into the wrapped condition: with no `{` to
  // anchor against, there's no reliable regex-only way to tell where the
  // condition ends and the statement begins.
  //
  // The negative lookbehind additionally guards against matching the word
  // "if" inside an ordinary `//` line comment ("// checking if we are
  // within range" is real, common GML commentary) — this pass's own
  // condition-capture group can span multiple lines, so an unguarded match
  // starting inside a comment would keep consuming text across the
  // newline, right through a real `if` statement below it, and wrap the
  // wrong (much larger, comment-plus-code) span entirely. (Real `/* ... */`
  // block comments can't trigger this: the dead-code-comment pass above
  // already collapsed every one of those to fixed placeholder text with no
  // "if" in it, before this pass ever runs.)
  out = out.replace(
    /(?<!\/\/[^\n]*)\bif\s+(?!\()([\s\S]+?)(?=\r?\n\s*\{|[ \t]+\{)/g,
    (_m, cond: string) => `if (${cond.trim()})`,
  );

  // GML's `div` (integer division) and `mod` (modulo) infix operators have
  // no JS/TS operator equivalent — `a div b` must become
  // `Math.floor(a / b)`, `a mod b` must become `a % b`. Handles both a
  // parenthesised left/right operand (`(x - y) div (z * 1.5)`) and a bare
  // identifier/number/member-access operand (`total div count`); a more
  // complex operand shape (a full nested expression on one side with no
  // enclosing parens) is left for manual review rather than risking eating
  // the wrong operand boundary.
  const OPERAND = String.raw`(?:\([^()]*\)|[\w.]+(?:\([^()]*\))?)`;
  out = out.replace(
    new RegExp(`(${OPERAND})\\s+div\\s+(${OPERAND})`, "g"),
    (_m, a: string, b: string) => `Math.floor(${a} / ${b})`,
  );
  out = out.replace(
    new RegExp(`(${OPERAND})\\s+mod\\s+(${OPERAND})`, "g"),
    (_m, a: string, b: string) => `(${a} % ${b})`,
  );

  // GML's data-structure accessor syntax — `arr[| i]` (ds_list), `arr[# c,
  // r]` (ds_grid), `arr[? key]` (ds_map) — uses a marker character right
  // after `[` that has no meaning in JS/TS array/member indexing at all,
  // and is a hard parse error left in place. There's no real ds_list/
  // ds_grid/ds_map runtime behind a plain JS array in this engine to
  // preserve the original semantics of, so this only fixes the syntax
  // (plain index access) and leaves a comment flagging the original
  // accessor kind for manual review, rather than silently reinterpreting
  // "list accessor" as "array index" without saying so.
  out = out.replace(/\[\s*\|\s*/g, "[/* was ds_list accessor: arr[| i] */ ");
  out = out.replace(/\[\s*#\s*/g, "[/* was ds_grid accessor: arr[# c, r] */ ");
  out = out.replace(/\[\s*\?\s*/g, "[/* was ds_map accessor: arr[? key] */ ");

  // GML's `with (instances) { body }` iterates every instance matching
  // `instances`, running `body` with `self`/bare-identifier scope switched
  // to each one in turn — there's no bare-identifier-rescoping mechanism to
  // fake that in generated TypeScript, and `with` also happens to be a real
  // JS/TS *reserved word*: every generated event handler lives inside an ES
  // module, which is always strict mode, and the `with` statement is a
  // syntax error in strict mode regardless of what's inside its parens.
  // Left untouched, this isn't just an honestly-surfaced "unresolved
  // identifier" (a type error) the way other unmodelled GML is — it's a
  // hard parse failure that breaks the *entire* file, including every
  // other, unrelated, successfully-transpiled function in it. `if (true)`
  // keeps the block's braces (and its body, for manual review) syntactically
  // valid without claiming to run the real per-instance iteration. The
  // target expression is deliberately not echoed into the comment: an
  // earlier pass (instance_create_layer, above) can itself have already
  // rewritten part of that expression into a `/* ... */` block comment, and
  // embedding that inside a second `/* ... */` would produce a nested block
  // comment — invalid in JS/TS, since the first `*/` closes the outer
  // comment early and leaves the rest as bare, unparseable code.
  out = out.replace(
    /\bwith\s*\(((?:[^()]|\([^()]*\))*)\)/g,
    () =>
      `if (true) /* TODO: migrate this GML "with (...)" block — iterate matching instances yourself */`,
  );

  // -- GML built-ins → EmptySock / JS equivalents ---------------------------

  // instance_create_layer / instance_destroy — GML allows both to appear as
  // a sub-expression, not just a standalone statement: `my_gun =
  // instance_create_layer(...)` (assigned) and `with
  // (instance_create_layer(...))` (passed as an argument) are both real,
  // common shapes. A line-comment substitution (`// ...`) is only safe when
  // the call is the entire statement — used inside `with(...)` or an
  // assignment's right-hand side, it comments out everything after it on
  // the same line, corrupting the enclosing statement's syntax (e.g.
  // leaving `with(` with no matching `)`). A block comment wrapped around a
  // real `undefined` expression stays valid in both statement and
  // expression position.
  out = out.replace(
    /\binstance_create_layer\s*\([^)]*\)(\s*;)?/g,
    (_m, semi?: string) =>
      `(undefined /* TODO: scene.createEntity() and add ObjX component */)${semi ?? ""}`,
  );
  out = out.replace(
    /\binstance_destroy\s*\(\s*\)(\s*;)?/g,
    (_m, semi?: string) => `(undefined /* entity.destroy(); */)${semi ?? ""}`,
  );

  // audio_play_sound(snd, priority, loop) / room_goto(rm_next) / draw_sprite
  // — GML allows any of these to be the sole (unbraced) body of an `if`/
  // `else` with no surrounding block: `if (cond) room_goto(rm_next);` is
  // real, common GML. A `// ...` line-comment substitution leaves that
  // `if` with no statement body at all — a hard parse error, not the
  // "honestly unresolved" case a bare identifier would be — the same
  // expression-vs-statement issue `instance_create_layer`/
  // `instance_destroy` (above) already had to be fixed for. A value-
  // returning `(undefined /* ... */)` stays a valid statement (and a valid
  // sub-expression, for the same reason) in every position a genuine
  // function call could have appeared in.
  // The whole argument list is captured as one raw, unparsed string (up to
  // one level of nested parens — a real, common shape is a sound-choosing
  // sub-call as the first argument, e.g.
  // `audio_play_sound(choose(snd_a, snd_b), 1, false)`) rather than split
  // into snd/priority/loop positionally: a naive `[^,)]+`-per-argument
  // split breaks the moment any argument itself contains a comma, like that
  // sub-call's own argument list does.
  out = out.replace(
    /\baudio_play_sound\s*\(((?:[^()]|\([^()]*\))*)\)(\s*;)?/g,
    (_m, args: string, semi?: string) =>
      `(undefined /* audioSystem.play('sound_name', { ...(${args.trim()}) }); */)${semi ?? ""}`,
  );
  out = out.replace(
    /\broom_goto\s*\(\s*([^)]+)\s*\)(\s*;)?/g,
    (_m, rm: string, semi?: string) =>
      `(undefined /* sceneManager.load('${rm.trim()}'); */)${semi ?? ""}`,
  );
  out = out.replace(
    /\bdraw_sprite\s*\([^)]*\)(\s*;)?/g,
    (_m, semi?: string) =>
      `(undefined /* Sprite component handles drawing declaratively */)${semi ?? ""}`,
  );

  // draw_set_colour/draw_rectangle/draw_circle/draw_text/draw_line — real
  // targets during a GmlBehaviorSystem onDraw/onDrawGui dispatch (see
  // CLAUDE.md's "What draw_* actually draws into now"): `GmlActionContext`
  // carries a `drawTarget: GmlDrawTarget | undefined` set only for the
  // duration of one draw dispatch call. Rewritten to call straight into
  // `_ctx.drawTarget` (optional-chained, so a `draw_*` call left in a
  // non-draw event — Create/Step/Destroy — is a safe, honest no-op instead
  // of an unresolved-identifier crash) rather than a bare `GmlActions.*`
  // call — `compat/gml.ts`'s draw_* functions themselves aren't part of
  // @emptysock/engine's one export surface, only the `GmlDrawTarget`
  // interface type is, so there is nothing importable to call there.
  out = out.replace(
    /\bdraw_set_colour\s*\(\s*([^)]+)\s*\)\s*;?/g,
    (_m, hex: string) => `_ctx.drawTarget?.setColor(${hex.trim()});`,
  );
  out = out.replace(
    /\bdraw_rectangle\s*\(\s*([^,]+),\s*([^,]+),\s*([^,]+),\s*([^,]+),\s*([^)]+)\s*\)\s*;?/g,
    (_m, x1: string, y1: string, x2: string, y2: string, outline: string) =>
      `_ctx.drawTarget?.rect(${x1.trim()}, ${y1.trim()}, ${x2.trim()}, ${y2.trim()}, ${outline.trim()});`,
  );
  out = out.replace(
    /\bdraw_circle\s*\(\s*([^,]+),\s*([^,]+),\s*([^,]+),\s*([^)]+)\s*\)\s*;?/g,
    (_m, x: string, y: string, r: string, outline: string) =>
      `_ctx.drawTarget?.circle(${x.trim()}, ${y.trim()}, ${r.trim()}, ${outline.trim()});`,
  );
  out = out.replace(
    /\bdraw_text\s*\(\s*([^,]+),\s*([^,]+),\s*([^)]+)\s*\)\s*;?/g,
    (_m, x: string, y: string, text: string) =>
      `_ctx.drawTarget?.text(${x.trim()}, ${y.trim()}, ${text.trim()});`,
  );
  out = out.replace(
    /\bdraw_line\s*\(\s*([^,]+),\s*([^,]+),\s*([^,]+),\s*([^)]+)\s*\)\s*;?/g,
    (_m, x1: string, y1: string, x2: string, y2: string) =>
      `_ctx.drawTarget?.line(${x1.trim()}, ${y1.trim()}, ${x2.trim()}, ${y2.trim()});`,
  );

  // alarm[n] = expr
  out = out.replace(
    /\balarm\s*\[\s*\d+\s*\]\s*=\s*([^;\n]+)/g,
    (_m, expr: string) =>
      `// entity.startCoroutine(waitFrames(${expr.trimEnd()}));`,
  );

  // show_message(msg)
  out = out.replace(
    /\bshow_message\s*\(\s*([^)]+)\s*\)\s*;?/g,
    (_m, msg: string) => `console.log(${msg.trim()});`,
  );

  // Math helpers — order matters: more specific first
  out = out.replace(
    /\birandom_range\s*\(\s*([^,)]+)\s*,\s*([^)]+)\s*\)/g,
    (_m, a: string, b: string) =>
      `Math.floor(Math.random() * (${b.trim()} - ${a.trim()} + 1)) + ${a.trim()}`,
  );
  out = out.replace(
    /\birandom\s*\(\s*([^)]+)\s*\)/g,
    (_m, n: string) => `Math.floor(Math.random() * (${n.trim()} + 1))`,
  );
  out = out.replace(
    /\brandom\s*\(\s*([^)]+)\s*\)/g,
    (_m, n: string) => `Math.random() * ${n.trim()}`,
  );

  out = out.replace(
    /\blerp\s*\(\s*([^,)]+)\s*,\s*([^,)]+)\s*,\s*([^)]+)\s*\)/g,
    (_m, a: string, b: string, t: string) =>
      `${a.trim()} + (${b.trim()} - ${a.trim()}) * ${t.trim()}`,
  );
  out = out.replace(
    /\bclamp\s*\(\s*([^,)]+)\s*,\s*([^,)]+)\s*,\s*([^)]+)\s*\)/g,
    (_m, v: string, lo: string, hi: string) =>
      `Math.min(Math.max(${v.trim()}, ${lo.trim()}), ${hi.trim()})`,
  );
  out = out.replace(
    /\babs\s*\(\s*([^)]+)\s*\)/g,
    (_m, x: string) => `Math.abs(${x.trim()})`,
  );
  out = out.replace(
    /\bfloor\s*\(\s*([^)]+)\s*\)/g,
    (_m, x: string) => `Math.floor(${x.trim()})`,
  );
  out = out.replace(
    /\bceil\s*\(\s*([^)]+)\s*\)/g,
    (_m, x: string) => `Math.ceil(${x.trim()})`,
  );
  out = out.replace(
    /\bround\s*\(\s*([^)]+)\s*\)/g,
    (_m, x: string) => `Math.round(${x.trim()})`,
  );
  out = out.replace(
    /\bsqrt\s*\(\s*([^)]+)\s*\)/g,
    (_m, x: string) => `Math.sqrt(${x.trim()})`,
  );
  out = out.replace(
    /\bpower\s*\(\s*([^,)]+)\s*,\s*([^)]+)\s*\)/g,
    (_m, x: string, y: string) => `Math.pow(${x.trim()}, ${y.trim()})`,
  );
  out = out.replace(
    /\blengthdir_x\s*\(\s*([^,)]+)\s*,\s*([^)]+)\s*\)/g,
    (_m, len: string, dir: string) =>
      `${len.trim()} * Math.cos(${dir.trim()} * Math.PI / 180)`,
  );
  out = out.replace(
    /\blengthdir_y\s*\(\s*([^,)]+)\s*,\s*([^)]+)\s*\)/g,
    (_m, len: string, dir: string) =>
      `${len.trim()} * Math.sin(${dir.trim()} * Math.PI / 180)`,
  );
  out = out.replace(
    /\bpoint_distance\s*\(\s*([^,)]+)\s*,\s*([^,)]+)\s*,\s*([^,)]+)\s*,\s*([^)]+)\s*\)/g,
    (_m, x1: string, y1: string, x2: string, y2: string) =>
      `Math.hypot(${x2.trim()} - ${x1.trim()}, ${y2.trim()} - ${y1.trim()})`,
  );
  out = out.replace(
    /\bstring_length\s*\(\s*([^)]+)\s*\)/g,
    (_m, s: string) => `${s.trim()}.length`,
  );
  out = out.replace(
    /\bstring\s*\(\s*([^)]+)\s*\)/g,
    (_m, v: string) => `String(${v.trim()})`,
  );

  // -- GM8.1 drag-and-drop action-library compat ----------------------------
  // Real implementations live in `@emptysock/engine`'s `compat/gmlActions.ts`
  // (see CLAUDE.md's "GMS2 DnD action-library compat" entry) — every action
  // is imperative and entity-affecting, so it needs the entity plus a
  // `GmlActionContext` threaded to it. `gms2-codegen.ts` gives every
  // generated event handler a trailing `_ctx: GmlActionContext` parameter
  // specifically so these calls have something to receive.
  //
  // Actions that take only plain-data arguments (numbers/strings/booleans —
  // no callback) are threaded and rewritten in place. `action_if_mouse` and
  // `action_if_question` are deliberately excluded from this list — their
  // real signature needs a live predicate callback (`isDown`/`ask`) that a
  // bare GML source argument (an identifier or literal) cannot supply by
  // text substitution alone; those two are left untranspiled, the same
  // "surface as unresolved identifiers, don't fake it" rule this
  // transpiler already applies to genuinely unmodelled GML (e.g.
  // `gml_pragma`) — a developer wires those two calls to
  // `GmlActions.action_if_mouse`/`action_if_question` by hand, supplying a
  // real callback.
  const THREADED_ACTIONS = [
    "action_move_to",
    "action_move",
    "action_snap",
    "action_set_friction",
    "action_set_relative",
    "action_sprite_set",
    "action_sprite_color",
    "action_next_room",
    "action_another_room",
    "action_create_object",
    "instance_create",
    "action_kill_object",
    "action_set_alarm",
    "action_sound",
  ];
  for (const fn of THREADED_ACTIONS) {
    const re = new RegExp(`\\b${fn}\\s*\\(([^)]*)\\)\\s*;?`, "g");
    out = out.replace(re, (_m, args: string) => {
      const trimmed = args.trim();
      const threaded =
        trimmed.length > 0 ? `_entity, _ctx, ${trimmed}` : "_entity, _ctx";
      return `GmlActions.${fn}(${threaded});`;
    });
  }

  // -- GM8.1 "if" actions: real conditional nesting -------------------------
  // GameMaker's if-actions (action_if_collision/action_if_aligned/
  // action_if_empty) gate whether the *next* action in the original DnD
  // action list runs — a real control-flow feature, not just a boolean
  // helper (see CLAUDE.md). The transpiler emits one statement per line
  // (matching how a compiled DnD action list reads), so nesting is done as
  // a dedicated line-based pass: an if-action line consumes the next
  // non-empty line as its guarded body and wraps it in a real `if (...) {
  // ... }` block, rather than emitting a flat, non-conditional sequence.
  const NESTING_IF_ACTIONS: Record<string, true> = {
    action_if_collision: true,
    action_if_aligned: true,
    action_if_empty: true,
  };
  const lines = out.split("\n");
  const nested: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();
    const ifMatch = /^(action_if_\w+)\s*\(([^)]*)\)\s*;?$/.exec(trimmed);
    const fn = ifMatch?.[1];
    if (
      ifMatch !== null &&
      fn !== undefined &&
      NESTING_IF_ACTIONS[fn] === true
    ) {
      const argsStr = (ifMatch[2] ?? "").trim();
      const threaded =
        argsStr.length > 0 ? `_entity, _ctx, ${argsStr}` : "_entity, _ctx";
      const indentMatch = /^(\s*)/.exec(line);
      const pad = indentMatch?.[1] ?? "";
      let j = i + 1;
      while (j < lines.length && (lines[j] ?? "").trim() === "") j++;
      nested.push(`${pad}if (GmlActions.${fn}(${threaded})) {`);
      if (j < lines.length) {
        nested.push(`${pad}  ${(lines[j] ?? "").trim()}`);
        nested.push(`${pad}}`);
        i = j;
      } else {
        nested.push(`${pad}  // TODO: no following action found to gate`);
        nested.push(`${pad}}`);
      }
      continue;
    }
    nested.push(line);
  }
  out = nested.join("\n");

  return out;
}

/**
 * Attempt to read and transpile a GML event file. Returns the transpiled
 * method body lines (indented), or null if the file doesn't exist.
 */
export async function readAndTranspileGML(
  gmlPath: string,
): Promise<string | null> {
  try {
    const source = await fs.readFile(gmlPath, "utf-8");
    return transpileGML(source);
  } catch {
    return null;
  }
}

/**
 * Indent each non-empty line of a multi-line string by `spaces` spaces.
 */
export function indent(code: string, spaces: number): string {
  const pad = " ".repeat(spaces);
  return code
    .split("\n")
    .map((line) => (line.trim() === "" ? "" : pad + line))
    .join("\n");
}
