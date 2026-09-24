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
  let out = gml;

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
    /\bglobal\.(\w+)\s*=\s*([^;\n]+);?/g,
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
  // which branch runs. Only handles conditions without their own nested
  // parens (the overwhelmingly common real shape — a flat chain of
  // `(x > y) && (a < b)`-style clauses); a condition with nested parens
  // inside one of the chained groups is rare enough, and safe enough to
  // leave for manual review, that this doesn't try to handle it.
  out = out.replace(
    /\bif\s*(\([^()]*\)(?:\s*(?:&&|\|\|)\s*\([^()]*\))+)/g,
    (_m, cond: string) => `if (${cond})`,
  );

  // GML's `div` (integer division) infix operator has no JS/TS equivalent
  // operator — `a div b` must become `Math.floor(a / b)`. Handles both a
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

  // audio_play_sound(snd, priority, loop)
  out = out.replace(
    /\baudio_play_sound\s*\(\s*([^,)]+)\s*,\s*[^,)]+\s*,\s*([^)]+)\s*\)\s*;?/g,
    (_m, _snd: string, loop: string) =>
      `// audioSystem.play('sound_name', { loop: ${loop.trim()} });`,
  );

  // room_goto(rm_next)
  out = out.replace(
    /\broom_goto\s*\(\s*([^)]+)\s*\)\s*;?/g,
    (_m, rm: string) => `// sceneManager.load('${rm.trim()}');`,
  );

  // draw_sprite
  out = out.replace(
    /\bdraw_sprite\s*\([^)]*\)\s*;?/g,
    "// Sprite component handles drawing declaratively",
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
