import fs from "fs/promises";

// ---------------------------------------------------------------------------
// GML pattern-level transpiler
// ---------------------------------------------------------------------------

/**
 * Splits a GML call's argument-list text (already captured up to the call's
 * own balanced closing paren — see `BALANCED_PARENS_ONE_LEVEL` below) into
 * up to `maxParts` top-level arguments, on commas that are not nested inside
 * their own parens or brackets. Real GML call sites routinely nest a further
 * call or array/ds accessor inside one argument (`draw_text(x, y, "a: " +
 * string(a) + "\n" + "b: " + string(b))`), so a naive split on every comma
 * would cut a nested call's own argument list apart. The trailing part
 * (index `maxParts - 1`) absorbs everything remaining, exactly like the
 * final capture group in a regex with a `$` argument.
 */
function splitTopLevelArgs(text: string, maxParts: number): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth--;
    if (ch === "," && depth === 0 && parts.length < maxParts - 1) {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts.map((p) => p.trim());
}

// Matches a call's argument-list text tolerating exactly one level of
// nested parens — enough for the common "a call as one argument" shape real
// GML source uses (`string(x)`, `choose(a, b)`, …) without needing a real
// parser. Two independently-nested calls inside the same argument list (e.g.
// two separate `string(...)` calls concatenated together, as in
// `draw_text(x, y, string(a) + string(b))`) both match fine here because
// each is its own top-level `(...)` group, not nested inside the other.
const BALANCED_PARENS_ONE_LEVEL = "(?:[^()]|\\([^()]*\\))*";

/**
 * Finds every `for (...)` header in `src` (by scanning with real paren-depth
 * tracking, since a header's own clauses can contain nested calls) and
 * strips one trailing `;` immediately before the header's closing paren, if
 * present. See the call site's comment for why this is needed at all.
 */
function stripTrailingSemicolonInForHeaders(src: string): string {
  let out = "";
  let i = 0;
  while (i < src.length) {
    const forMatch = /\bfor\s*\(/.exec(src.slice(i));
    if (!forMatch) {
      out += src.slice(i);
      break;
    }
    const forStart = i + forMatch.index;
    const parenOpen = forStart + forMatch[0].length - 1;
    out += src.slice(i, parenOpen + 1);
    let depth = 1;
    let j = parenOpen + 1;
    while (j < src.length && depth > 0) {
      if (src[j] === "(") depth++;
      else if (src[j] === ")") depth--;
      if (depth > 0) j++;
    }
    // src[parenOpen+1..j) is the header body; src[j] is the closing paren.
    let header = src.slice(parenOpen + 1, j);
    header = header.replace(/;\s*$/, "");
    out += header + (j < src.length ? src[j] : "");
    i = j + 1;
  }
  return out;
}

/**
 * Wraps a real GML brace-less, single-statement `if <cond> <stmt>;` — no
 * `{}` anywhere — in parens around just the condition, leaving the
 * statement untouched. Pure-regex approaches for this shape are unsafe: a
 * condition and a following bare-assignment statement can sit back to back
 * with nothing but whitespace between them (`if !surface_exists(surf) surf
 * = surface_create(...)` — a real, confirmed shape from a real project's
 * `obj_rainController`'s `Draw_0.gml`), so there is no fixed token that
 * reliably marks "condition ends, statement begins" for a single regex
 * character class to anchor on. This function instead scans forward from
 * each remaining brace-less `if` (only reachable once the brace-anchored
 * passes above have already run, so a `{` is never nearby) tracking paren
 * depth, and stops at the first of two real, unambiguous boundaries:
 *
 * 1. A top-level newline — real GML very commonly puts a brace-less if's
 *    single-statement body on its own following line (`if movement >=
 *    pi*2\nmovement = 0;`, `obj_sway`'s real `Step_0.gml`) — the newline
 *    itself is the separator, so the condition is exactly the text up to
 *    it.
 * 2. A top-level bare-assignment start (`ident = `/`ident += `/etc., not
 *    `==`/`!=`/`>=`/`<=`) when the whole thing is on one physical line —
 *    GML's own grammar means a *fresh* statement essentially always looks
 *    like this, and a condition containing a bare (non-comparison) `=`
 *    of its own is a vanishingly rare, not-worth-guessing-wrong edge case.
 *
 * If neither boundary is found before a top-level `;`/`{` (this `if`'s
 * shape isn't one of the two real cases this was built from), the `if` is
 * left completely untouched rather than guessing — the same "don't fake an
 * unresolvable rewrite" rule this file follows everywhere else.
 */
function wrapBareSingleStatementIf(src: string): string {
  const ASSIGN_START =
    /^([A-Za-z_]\w*(?:\[[^\]\n]*\])?\s*(?:\+=|-=|\*=|\/=|%=|=(?!=)))/;
  let out = "";
  let i = 0;
  while (i < src.length) {
    const m = /(?<!\/\/[^\n]*)\bif\s+(?!\()/.exec(src.slice(i));
    if (!m) {
      out += src.slice(i);
      break;
    }
    const ifStart = i + m.index;
    const condStart = ifStart + m[0].length;
    out += src.slice(i, condStart);

    let depth = 0;
    let j = condStart;
    let splitAt = -1;
    while (j < src.length) {
      const ch = src[j];
      if (ch === "(" || ch === "[") depth++;
      else if (ch === ")" || ch === "]") depth--;
      else if (depth === 0 && ch === "\n") {
        splitAt = j;
        break;
      } else if (depth === 0 && (ch === ";" || ch === "{")) {
        break;
      } else if (
        depth === 0 &&
        j !== condStart &&
        !/[A-Za-z0-9_$]/.test(src[j - 1] ?? "")
      ) {
        // Two guards on when this heuristic may even attempt a match:
        //
        // `j !== condStart` — GML overloads bare `=` for equality *inside a
        // condition too* (`if argument4 = 0 argument4 = current_time;`, a
        // real, confirmed shape from a real project's `scr_wave.gml` —
        // "if argument4 equals 0"). Without this guard, the very first
        // token of the condition itself (`argument4 = 0`) matched
        // `ASSIGN_START` immediately at `condStart`, producing an empty
        // captured condition (`if ()`).
        //
        // `src[j - 1]` not an identifier character — this scan tests
        // `ASSIGN_START` at every position, not just real token starts, so
        // without this guard the match above was *also* still reachable
        // one character late: at `j` pointing at "rgument4" (the second
        // character of the condition's own "argument4" token), `^[A-Za-z_]
        // \w*` happily matches "rgument4" as if it were its own fresh
        // identifier, re-introducing the exact same false split one
        // position over. Requiring the previous character to be a
        // non-identifier character (whitespace, an operator, a paren, the
        // very start of the string) is what actually restricts this
        // heuristic to real token boundaries.
        const rest = src.slice(j);
        const assign = ASSIGN_START.exec(rest);
        if (assign) {
          splitAt = j;
          break;
        }
      }
      j++;
    }

    if (splitAt === -1) {
      // No safe boundary found — leave this "if" untouched and resume
      // scanning right after it, so a later occurrence isn't skipped.
      i = condStart;
      continue;
    }
    const cond = src.slice(condStart, splitAt).trim();
    out += `(${cond})`;
    i = splitAt;
  }
  return out;
}

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
  // The placeholder text deliberately contains no `]` (or `)`) character.
  // Several later passes capture up to the next unmatched bracket with a
  // negated character class — most concretely the ds_map `[? key]` accessor
  // rewrite below, whose key capture is `[^\]]+` — and this placeholder can
  // land *inside* that captured span whenever the original source comment
  // sat inside the accessor's own brackets (`map[?chr(92)/* "\" */]`, a
  // real, confirmed shape from a real project's `keyboard_init.gml`). A `]`
  // inside the placeholder terminated that capture early, truncating the
  // key and leaving a dangling, unbalanced `]` in the output — a hard
  // SyntaxError. No bracket character anywhere in this text is what makes
  // it safe to sit inside any such later span, not just the ds_map one.
  out = out.replace(/\/\*[\s\S]*?\*\//g, "/* GML comment/dead code omitted */");

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
      // The leading `;` is a real, empty statement, not stray punctuation —
      // it's what keeps this replacement a valid *statement* on its own,
      // not just a comment. A GML `global.x = expr;` that is itself the
      // sole body of a brace-less `if`/`while` (a real, confirmed shape:
      // `if (global.gain > 1)\n\tglobal.gain = 1;`, from a real project's
      // `obj_ear`'s `Step_0.gml`) left the `if` with nothing but a comment
      // for a body once this pass ran — a hard SyntaxError, the opposite of
      // this comment's own "keeps the emitted file syntactically valid"
      // claim. `;` is a no-op in every other context this replacement can
      // land in (a plain statement position), so it's free everywhere else.
      //
      // A `/* ... */` block comment, not `//`: a `global.x = expr;`
      // assignment routinely shares its physical source line with further
      // real statements after it — real, confirmed shape (`if (curPos ==
      // pos1[3]) { global.pause = false; canDraw = false; canEdit = false;
      // }`, all on one line, from a real project's `obj_shop`'s
      // `Step_0.gml`). A `//` line comment runs to the end of the physical
      // line no matter what — it swallowed `canDraw = false; canEdit =
      // false; }` (including the block's own closing brace) into dead
      // commentary, leaving the block permanently unclosed. `/* ... */`
      // only consumes up to its own `*/`, so real code later on the same
      // line stays live. This can never itself create a *nested* block
      // comment the way an unguarded injection elsewhere in this file
      // could: every real source `/* ... */` was already neutralised to a
      // bracket-free placeholder at the very top of this function, before
      // any pass (this one included) ever runs.
      `; /* TODO: migrate GML global variable "${varName}" (was: global.${varName} = ${expr.trimEnd()};) — wire it to your own shared state. */`,
  );
  // GameMaker 8.1's legacy `globalvar a, b, c;` declaration statement (as
  // opposed to the modern `global.x = ...` assignment form handled just
  // above) declares one or more names as globals that every *other* line of
  // GML in the project then refers to bare (`a = 1;`, not `global.a = 1;`).
  // `globalvar` itself is not a JS/TS keyword at all — left alone it's a
  // hard parse error ("Unknown keyword or identifier"), not just an
  // unresolved-identifier warning. There's no reliable way for this
  // regex-based, single-file-at-a-time transpiler to also rewrite every
  // *other* bare reference to `a`/`b`/`c` across the whole project into
  // `global.a`/etc — that needs real cross-file symbol resolution — so this
  // only fixes the syntax at the declaration site itself and leaves an
  // honest TODO naming exactly which identifiers need manual global wiring,
  // the same "don't fake it" rule the `global.x = ...` rewrite above
  // already follows.
  out = out.replace(
    /\bglobalvar\s+([^;\n]+);?/g,
    (_m, names: string) =>
      `// TODO: migrate legacy "globalvar ${names.trim()};" declaration — every bare reference to ${names
        .split(",")
        .map((n) => `"${n.trim()}"`)
        .join(
          ", ",
        )} elsewhere in this project's GML needs to become real shared state.`,
  );

  // var x = expr  →  var x = expr (kept as `var`, not rewritten to `let`).
  // GML's `var` is function-scoped and — unlike JS `let` — explicitly
  // tolerates redeclaring the same local more than once in the same
  // function body (a real, common pattern: a compiled/unrolled event with
  // several near-identical blocks each starting `var _i = 0;`). A real
  // GMS2 project (a per-controller-index input-polling event, one `var
  // _pNumber = 0;`/`var _pNumber = 1;`/... block per player index in the
  // same Step event) hit exactly this: rewriting to `let` produced
  // `SyntaxError: Identifier '_pNumber' has already been declared` at
  // module load, since JS `let` forbids redeclaration within the same
  // block/function scope. `var` has the closest matching semantics.
  out = out.replace(/\bvar\b(\s+\w+\s*=)/g, "var$1");

  // GML's word-form boolean operators (`and`/`or`/`xor`/`not`, kept as
  // aliases for `&&`/`||`/`!==` (boolean-only in GameMaker — the closest
  // strict equivalent using only values already coerced boolean-ish by
  // surrounding comparisons)/`!` since GameMaker 8.1) have no meaning as
  // JS/TS operators at all — `and`/`or`/`not` parse as bare identifiers,
  // and `a and b` is a syntax error (two expressions with no operator
  // between them), not merely an unresolved-identifier warning. Run this
  // before the `if`-chain/bare-condition passes below so they see the real
  // `&&`/`||` operators when anchoring a condition's extent.
  out = out.replace(/(?<![\w.])\bnot\b[ \t]*/g, "!");
  out = out.replace(/\band\b/g, "&&");
  out = out.replace(/\bor\b/g, "||");
  out = out.replace(/\bxor\b/g, "!==");

  // -- Control flow ----------------------------------------------------------
  // repeat(n) { ... }  →  for (let _i = 0; _i < n; _i++) { ... }
  //
  // `n` commonly contains its own nested call — real, confirmed shape
  // (`repeat (string_length(str)) { ... }`, from a real project's
  // `scr_capword.gml`) — so the count capture must tolerate one level of
  // nested parens the same way `BALANCED_PARENS_ONE_LEVEL` already does for
  // every other single-argument-call rewrite in this file. A naive `[^)]+`
  // capture stopped at the nested call's own `)`, truncating `n` to
  // `string_length(str` and leaving the real closing `)` dangling —
  // confirmed to corrupt the generated `for` header into invalid syntax.
  out = out.replace(
    new RegExp(`\\brepeat\\s*\\((${BALANCED_PARENS_ONE_LEVEL})\\)`, "g"),
    (_m, n: string) => `for (let _i = 0; _i < ${n.trim()}; _i++)`,
  );

  // GML's `do { ... } until (cond);` — a real, confirmed shape (`do { xx =
  // random(room_width); yy = random(room_height); } until
  // (position_empty(xx, yy));`, from a real project's `whole_bunch.gml`) —
  // has no JS/TS equivalent keyword at all (JS only has `do...while`).
  // `until (cond)` is exactly the negation of `while (cond)` (loop until
  // the condition becomes true, rather than while it stays true), so this
  // is a real, lossless, mechanical rewrite — `} until (cond);` becomes
  // `} while (!(cond));` — not a "leave it unresolved" case the way a
  // genuinely un-modelled GML construct would be.
  out = out.replace(
    new RegExp(`\\}\\s*until\\s*\\((${BALANCED_PARENS_ONE_LEVEL})\\)`, "g"),
    (_m, cond: string) => `} while (!(${cond.trim()}))`,
  );

  // for loops: var → let inside for initialiser
  out = out.replace(/\bfor\s*\(\s*var\b/g, "for (let");

  // GameMaker tolerates (and real-world GML sometimes has) a stray trailing
  // `;` after a `for` header's third (increment) clause, e.g.
  // `for (var i = 0; i >= 0; --i;)` — the loop still runs fine in GameMaker
  // (an empty statement after the last real one), but JS/TS's `for` grammar
  // is exactly `for (init; cond; update)` with no fourth clause, so a
  // trailing `;` right before the closing paren is a hard parse error.
  // Scanned with explicit paren-depth tracking, not a single regex, because
  // a real for-header's own clauses routinely contain function calls with
  // their own parens (`for (var i = array_length_1d(arr) - 1; ...)`), which
  // a naive `[^)]*` match would stop at the first inner `)`.
  out = stripTrailingSemicolonInForHeaders(out);
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

  // #macro NAME value — GameMaker's textual-substitution compile-time
  // constant directive (define once, every other line in the project that
  // references NAME gets `value` substituted in at compile time — the same
  // idea as a C preprocessor `#define`). Like `#region`, a bare `#` is a
  // hard JS/TS parse error, not just an unresolved identifier. Unlike
  // `#region`, faithfully "migrating" a macro would mean finding and
  // rewriting every other reference to NAME across the whole project into
  // its substituted value or a real shared constant — real cross-file work
  // this single-file, regex-based transpiler pass has no way to do. Rewrite
  // the directive itself to a `//` comment (fixing the syntax error) and
  // leave a TODO naming the macro, the same "fix the syntax, be honest
  // about what still needs a human" rule `globalvar` (above) follows.
  out = out.replace(
    /^([ \t]*)#macro\s+(\S+)\s+(.*)$/gm,
    (_m, indent: string, name: string, value: string) =>
      `${indent}// TODO: migrate GML macro "${name}" (was: #macro ${name} ${value.trim()}) — every other reference to "${name}" in this project needs to become a real shared constant.`,
  );

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
    /(?<!\/\/[^\n]*)\bif\s+(?!\()([\s\S]+?)(?=\r?\n\s*\{|[ \t]*\{)/g,
    (_m, cond: string) => {
      // A trailing `// comment` on the condition's own line (real, common
      // GML — `if _argument == NULLVALUE // NO ARGUMENT PASSED`) must land
      // *after* the closing paren this pass adds, not inside it: a `//`
      // comments out everything to the end of its physical line, including
      // a `)` placed after it, which left the condition permanently
      // unclosed and broke the whole generated file (the exact bug that
      // motivated this fix). Keep it as a trailing comment on the emitted
      // `if (...)` line instead of silently dropping it.
      //
      // A *leading* comment — real GML has `if // LEFT TOGGLE HIGHLIGHTED`
      // on the `if`'s own line, with the actual condition only starting on
      // the *next* line (`(_mouseX > ... )`) — needs separate handling
      // first: naively looking for the first `//` anywhere in `cond` (the
      // approach above alone) finds this leading comment before any real
      // condition text, so `realCond` came out empty and the whole
      // condition got misfiled as "trailing comment" — confirmed against a
      // real project, emitting a hard-broken `if ()` followed by the actual
      // condition as a dangling, never-evaluated expression statement.
      let working = cond;
      let leadingComment = "";
      const leadingCommentMatch = /^[ \t]*\/\/[^\n]*\n/.exec(working);
      if (leadingCommentMatch !== null) {
        leadingComment = leadingCommentMatch[0].trim();
        working = working.slice(leadingCommentMatch[0].length);
      }
      const commentIdx = working.indexOf("//");
      const realCond =
        commentIdx === -1
          ? working.trim()
          : working.slice(0, commentIdx).trim();
      const trailingComment =
        commentIdx === -1 ? "" : working.slice(commentIdx).trimEnd();
      const comments = [leadingComment, trailingComment]
        .filter((c) => c.length > 0)
        .join(" ");
      // This pass's own doc comment above claims a brace-less `if cond
      // statement;` is "deliberately left alone" because the lazy `{`
      // anchor can't tell where the condition ends — but the lazy
      // `[\s\S]+?` capture doesn't actually stop at the *next* `{`, it
      // stops at the *first* `{` anywhere later in the whole event, which
      // is routinely much further away when the real brace-less `if` is
      // followed by ordinary unbraced statements before the next braced
      // block. Real, confirmed regression from `obj_rainController`'s real
      // `Draw_0.gml`: `if !surface_exists(surf) surf = surface_create(
      // room_width, room_height);` (a genuinely brace-less if) got fused
      // with its own body's `;` and wrapped into one broken
      // `if (!surface_exists(surf) surf = surface_create(...);)` because a
      // wholly unrelated `{` existed later in the same file. A real
      // condition never itself contains a top-level `;` — bailing out
      // whenever `realCond` does is the same guard the sibling "trailing
      // operator" pass below already uses for the identical reason, and it
      // only ever excludes a capture that was already wrong: an actually
      // brace-anchored condition can't contain a `;` either, so this never
      // rejects a genuine match.
      if (realCond.includes(";")) return _m;
      return comments === ""
        ? `if (${realCond})`
        : `if (${realCond}) ${comments}`;
    },
  );

  // GML's real brace-less single-statement `if` (no `{}` at all — the two
  // passes above both require a `{` somewhere to anchor against and
  // deliberately/necessarily skip this shape) is a real, common pattern,
  // confirmed independently in two separate real projects: `obj_sway`'s
  // `Step_0.gml` (`if movement >= pi*2\nmovement = 0;`, condition and body
  // on separate lines) and `obj_rainController`'s `Draw_0.gml` (`if
  // !surface_exists(surf) surf = surface_create(room_width, room_height);`,
  // both on one physical line with nothing but whitespace between them).
  // JS/TS itself already accepts a single bare statement as an `if`'s body
  // with no braces needed — the only real gap is the *condition* still
  // needing its own parens, which GML doesn't require. See
  // `wrapBareSingleStatementIf`'s own doc comment for why this needs a
  // manual scan rather than one more regex pass: the two real shapes above
  // have no single fixed separator token a regex character class could
  // anchor on.
  out = wrapBareSingleStatementIf(out);

  // GML's real `if (cond) stmt else stmt;` — a brace-less if/else with both
  // branches on one line — is valid GML but not valid JS/TS unless a `;`
  // separates the first branch's statement from `else`: JS/TS requires the
  // `if` branch to be a complete statement before `else` can follow. Real,
  // confirmed regression from `oPlayer`'s real `Step_0.gml`: `if
  // (place_meeting(x, y+5, oIce)) friction = 0.2 else hspeed = 0;` — no `;`
  // before `else` anywhere in the original GML (GML's own grammar doesn't
  // require one there). Only fires when a `;` isn't already present —
  // `if (cond) stmt; else stmt;` (the common, already-valid shape) must be
  // left completely untouched.
  out = out.replace(
    /\)\s*([^;{}\n]+?)\s+else\b/g,
    (m: string, stmt: string) => `) ${stmt.trim()}; else`,
  );

  // switch <bare expr, no enclosing paren at all> { ... }  →  switch (<expr>) { ... }
  //
  // GML's `switch` also allows the same paren-optional subject syntax as
  // `if`/`while` — confirmed against three separate real projects:
  // `switch _inputDevice { ... }` (LocalInputSystemFauxOperativeGames'
  // `scr_inputControlUpdateInputs.gml`), `switch toggleHighlight { ... }`
  // (MenuProject's `scr_drawCurrentMenu.gml`), and `switch
  // window_get_fullscreen() { ... }` (MenuProject's
  // `scr_setOptionVariableStrings.gml`). Unlike `if`/`while`, JS/TS's
  // `switch` syntax has no bare-condition form at all, so an unwrapped
  // `switch expr { case ...: }` is a hard SyntaxError (`switch` expects `(`
  // immediately). Same anchor-on-`{` approach as the `if`/`while` passes;
  // `switch`'s subject is always a plain expression with no `!`/`&&`/`||`
  // idiom worth a dedicated pass the way `if`'s condition has, so this one
  // pass covers the whole gap.
  out = out.replace(
    /(?<!\/\/[^\n]*)\bswitch\s+(?!\()([\s\S]+?)(?=\r?\n\s*\{|[ \t]*\{)/g,
    (_m, cond: string) => {
      let working = cond;
      let leadingComment = "";
      const leadingCommentMatch = /^[ \t]*\/\/[^\n]*\n/.exec(working);
      if (leadingCommentMatch !== null) {
        leadingComment = leadingCommentMatch[0].trim();
        working = working.slice(leadingCommentMatch[0].length);
      }
      const commentIdx = working.indexOf("//");
      const realCond =
        commentIdx === -1
          ? working.trim()
          : working.slice(0, commentIdx).trim();
      const trailingComment =
        commentIdx === -1 ? "" : working.slice(commentIdx).trimEnd();
      const comments = [leadingComment, trailingComment]
        .filter((c) => c.length > 0)
        .join(" ");
      return comments === ""
        ? `switch (${realCond})`
        : `switch (${realCond}) ${comments}`;
    },
  );

  // while <bare expr, no enclosing paren at all> { ... }  →  while (<expr>) { ... }
  //
  // GML's `while` has the exact same paren-optional condition syntax as its
  // `if` (both are just "a condition, optionally parenthesised" in GML's own
  // grammar) — confirmed against a real project script (`ini_read_inventory`
  // (`ini_read_inventory.gml`): `while ini_key_exists(_section, _name +
  // String(_i)) { ... }`, a real, common "how many indexed items exist"
  // idiom. Left unwrapped this is a hard `SyntaxError` at load time (`while`
  // followed by a bare call expression, then a dangling `{ ... }` block with
  // no controlling statement), the same failure mode the `if` version of
  // this bug already had before its own fix. Same anchor-on-`{` approach and
  // same leading/trailing `//` comment handling as the `if` pass just above
  // — reusing the identical logic here (rather than a shared helper) keeps
  // this pass trivially diffable against its `if` counterpart if that one's
  // comment-handling ever needs to change again.
  out = out.replace(
    /(?<!\/\/[^\n]*)\bwhile\s+(?!\()([\s\S]+?)(?=\r?\n\s*\{|[ \t]*\{)/g,
    (_m, cond: string) => {
      let working = cond;
      let leadingComment = "";
      const leadingCommentMatch = /^[ \t]*\/\/[^\n]*\n/.exec(working);
      if (leadingCommentMatch !== null) {
        leadingComment = leadingCommentMatch[0].trim();
        working = working.slice(leadingCommentMatch[0].length);
      }
      const commentIdx = working.indexOf("//");
      const realCond =
        commentIdx === -1
          ? working.trim()
          : working.slice(0, commentIdx).trim();
      const trailingComment =
        commentIdx === -1 ? "" : working.slice(commentIdx).trimEnd();
      const comments = [leadingComment, trailingComment]
        .filter((c) => c.length > 0)
        .join(" ");
      return comments === ""
        ? `while (${realCond})`
        : `while (${realCond}) ${comments}`;
    },
  );

  // if (a) <trailing operator + rhs, no further parens> { ... }
  //   →  if ((a) <trailing...>) { ... }
  //
  // A real GML condition can begin with one balanced parenthesised clause
  // and then keep going past its closing paren with more of the condition
  // — not joined by `&&`/`||` (the chain pass above already covers that),
  // just a plain trailing comparison against the rest of the expression.
  // Real, confirmed example: `if (_xAxis*_xAxis + _yAxis*+_yAxis) >=
  // gamepadDeadzoneSquared { ... }`. The three passes above all skip this
  // shape: the `&&`/`||`-chain pass needs a second parenthesised clause,
  // the `!(...)` pass needs a leading `!`, and the bare-expr pass
  // explicitly excludes anything starting with `(` (its `(?!\()`) since
  // that shape is exactly what looked, on its own, like an
  // already-complete `if (cond)`. Left unwrapped, this parses in JS as
  // `if (a)` followed by a dangling `>= gamepadDeadzoneSquared { ... }`
  // expression statement — a hard `SyntaxError` (an errant `>=` with no
  // preceding operand at statement position), not a silent misbehaviour,
  // but it still crashes the whole generated module at load time. Only
  // fires when there IS real trailing content between the clause and the
  // `{` — a plain `if (a) { ... }` has nothing to match here and is left
  // alone.
  out = out.replace(
    new RegExp(
      // The trailing content must *start* with a real operator character
      // (`>`, `<`, `=`, `!`, `&`, `|`, `+`, `-`, `*`, `/`, `%`) right after
      // the clause's closing paren — never a bare `[^{\s]` (any non-brace
      // character), which also matched the start of a wholly separate
      // following statement, not just a genuine boolean-expression
      // continuation. Real, confirmed regression: `if (max(argument0,
      // argument2) < view_xview[view_current] - 10) return 0` (already a
      // complete, correctly-parenthesised condition, from a real project's
      // `draw_lightning.gml`) matched this pass's old, too-broad character
      // class at "return"'s leading `r`, and tried to fuse the following
      // `return 0` statement into the condition as if it were more
      // boolean-expression text — producing `if ((max(...) < ...) return
      // 0)`, invalid on its own even before the newline-bail fix above.
      // Restricting to an operator-start character is what actually
      // distinguishes "the condition keeps going" (`>= b`) from "the
      // condition already ended, this is body code" (`return 0`).
      `\\bif\\s*(${IF_CLAUSE}[ \\t]*[><=!&|+\\-*/%][\\s\\S]*?)(?=\\r?\\n\\s*\\{|[ \\t]*\\{)`,
      "g",
    ),
    (m: string, cond: string) => {
      // A trailing `//` line comment on the same line as the condition is
      // not part of the expression — wrapping it inside the new parens
      // (`if ((a == 1) // a comment)`) would swallow the closing paren
      // into the comment and break the generated syntax. Split it off and
      // only wrap the code portion; if nothing but the comment trails the
      // already-complete clause (an earlier pass, e.g. the bare-if wrap
      // above, may have already produced a fully valid `if (cond)` with
      // just a comment after it), there is no real trailing expression to
      // wrap at all — leave the match untouched.
      const commentIdx = cond.indexOf("//");
      const code = (
        commentIdx === -1 ? cond : cond.slice(0, commentIdx)
      ).trim();
      const comment =
        commentIdx === -1 ? "" : ` ${cond.slice(commentIdx).trimEnd()}`;
      if (new RegExp(`^${IF_CLAUSE}$`).test(code)) return m;
      // A bare, brace-less `if (cond) stmt;` (GML's own single-statement
      // if, no braces at all) has no `{` anywhere on its own line for the
      // lookahead above to anchor against — the lazy `[\s\S]*?` then keeps
      // expanding *past* the body statement's own `;`, across any number of
      // following lines, until it finds some later, wholly unrelated `{`
      // (e.g. the next real braced `if`/block in the same event). That
      // over-reach doesn't just wrongly wrap the (already-valid) bare if —
      // for a body that a later pass turns into an IIFE (`sprite_index =
      // ...`, `place_meeting(...)`, `timeline_index = ...`, …), it also cuts
      // the IIFE's own text in half and reassembles it, and any *other*
      // intervening statement, inside one broken outer paren, producing a
      // hard `SyntaxError` (confirmed against a real project:
      // `if (sign(hsp) != 0) image_xscale = sign(hsp) * other.size;`
      // followed by an unrelated `image_yscale = other.size;` and a later
      // braced `if`, all fused into one corrupted `if (...)`). A genuine
      // trailing-condition continuation (the case this pass exists for,
      // `if (a) >= b { ... }`) is always itself an expression — it never
      // contains a `;` — so bailing out whenever the captured span contains
      // one is a safe, general guard: it only ever excludes cases that were
      // actually a full statement (or several), never a real dangling
      // condition clause.
      if (code.includes(";")) return m;
      // GML allows omitting the trailing `;` entirely (it's genuinely
      // optional, not just stylistically absent) — a real, confirmed
      // regression from `draw_lightning.gml`, whose four consecutive
      // semicolon-less `if (cond) return 0` lines have no `;` anywhere to
      // trip the bail guard above, so the lazy `[\s\S]*?` capture reached
      // straight through all four (and past the fourth's own real
      // "return 0") looking for the next `{`, fusing every one of them
      // into one broken `if (...)`. This pass's own documented real
      // example (`if (_xAxis*_xAxis + _yAxis*+_yAxis) >=
      // gamepadDeadzoneSquared { ... }`) is always a single physical
      // line — bailing whenever the captured span crosses a newline is
      // therefore a safe, general guard for the same reason the `;` one
      // is: it only ever excludes a capture that had already reached past
      // this pass's real, intended shape.
      if (code.includes("\n")) return m;
      return `if (${code})${comment}`;
    },
  );

  // GML's `$RRGGBB`/`$AABBGGRR` hex-colour literal syntax (`$fff0ee`) has no
  // JS/TS equivalent — `$` is not a valid numeric-literal prefix in either
  // language. Real, confirmed regression: `ltng_color = $fff0ee` left the
  // `$fff0ee` token completely untouched, which parses as a bare
  // JS identifier (`$` is a legal identifier character) — a
  // `ReferenceError: $fff0ee is not defined` at runtime, not a compile-time
  // signal. GML's hex-colour literal is otherwise byte-for-byte the same
  // digit sequence JS's own `0x` hex-numeric-literal syntax accepts, so
  // this is a real, mechanical, lossless rewrite (`$fff0ee` → `0xfff0ee`),
  // not a "leave it unresolved" case. Six or eight hex digits only (GML's
  // real two accepted widths — 0xRRGGBB or 0xAABBGGRR) avoids misfiring on
  // an unrelated `$name` some other, genuinely unmodelled GML construct
  // might contain.
  out = out.replace(
    /\$([0-9a-fA-F]{8}|[0-9a-fA-F]{6})\b/g,
    (_m, hex: string) => `0x${hex}`,
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

  // GML's ds_list/ds_map/ds_grid data structures and struct accessors get
  // real, working JS/TS equivalents, not a comment stub — GameMaker's own
  // documented semantics for each:
  //   ds_list: an ordered, numerically-indexed, growable list — a plain JS
  //   `Array` is a drop-in equivalent (`ds_list_add` ~ `.push`, the `[| i]`
  //   accessor ~ plain `arr[i]` indexing, which already supports both read
  //   and write natively, so the list accessor needs no position-aware
  //   handling at all).
  //   ds_map: an arbitrary key -> value store — a JS `Map` is the direct
  //   equivalent (`ds_map_add`/`ds_map_find_value` ~ `.set`/`.get`). Unlike
  //   a plain array, `Map` has no bracket-assignment syntax, so the `[? key]`
  //   accessor *is* position-sensitive: a read becomes `.get(key)`, a write
  //   becomes `.set(key, value)` — never `.get(key) = value`, which isn't
  //   valid JS (you cannot assign to a function call's return value).
  //   ds_grid: a fixed-size 2D grid, addressed `grid[# col, row]` — modelled
  //   as a plain nested `Array<Array<T>>` (`grid[col][row]`), which — like
  //   the list accessor — supports both read and write with the same plain
  //   indexing syntax, so it also needs no position-aware handling.
  //   GML struct literals (`{a: 1, b: 2}`, native syntax since GMS 2.3) are
  //   already valid JS object-literal syntax and pass through unchanged;
  //   only the `variable_struct_*` *function* API needs rewriting to plain
  //   bracket property access.
  //
  // Every ds_* function below is dispatched purely by name (`ds_list_add`,
  // `ds_map_set`, …), and every accessor purely by its own bracket marker
  // (`[|`/`[#`/`[?`) — never by inferring the base variable's declared type,
  // which this regex-based transpiler has no way to know. This is safe
  // because GameMaker's own accessor syntax already encodes which structure
  // kind it addresses in the bracket marker itself; two different ds kinds
  // never share a marker.

  // -- ds_list: real Array-backed replacements --------------------------
  out = out.replace(/\bds_list_create\s*\(\s*\)\s*/g, "[]");
  out = out.replace(
    new RegExp(`\\bds_list_add\\s*\\((${BALANCED_PARENS_ONE_LEVEL})\\)`, "g"),
    (_m, args: string) => {
      const [list, ...values] = splitTopLevelArgs(args, 99);
      return `${list}.push(${values.join(", ")})`;
    },
  );
  out = out.replace(
    new RegExp(
      `\\bds_list_insert\\s*\\((${BALANCED_PARENS_ONE_LEVEL})\\)`,
      "g",
    ),
    (_m, args: string) => {
      const [list, pos, value] = splitTopLevelArgs(args, 3);
      return `${list}.splice(${pos}, 0, ${value})`;
    },
  );
  out = out.replace(
    new RegExp(
      `\\bds_list_delete\\s*\\((${BALANCED_PARENS_ONE_LEVEL})\\)`,
      "g",
    ),
    (_m, args: string) => {
      const [list, pos] = splitTopLevelArgs(args, 2);
      return `${list}.splice(${pos}, 1)`;
    },
  );
  out = out.replace(
    new RegExp(
      `\\bds_list_find_value\\s*\\((${BALANCED_PARENS_ONE_LEVEL})\\)`,
      "g",
    ),
    (_m, args: string) => {
      const [list, pos] = splitTopLevelArgs(args, 2);
      return `${list}[${pos}]`;
    },
  );
  out = out.replace(
    new RegExp(`\\bds_list_set\\s*\\((${BALANCED_PARENS_ONE_LEVEL})\\)`, "g"),
    (_m, args: string) => {
      const [list, pos, value] = splitTopLevelArgs(args, 3);
      return `(${list}[${pos}] = ${value})`;
    },
  );
  out = out.replace(
    /\bds_list_size\s*\(\s*([^()]+)\s*\)/g,
    (_m, list: string) => `${list.trim()}.length`,
  );
  out = out.replace(
    /\bds_list_clear\s*\(\s*([^()]+)\s*\)/g,
    (_m, list: string) => `(${list.trim()}.length = 0)`,
  );
  // JS's garbage collector reclaims a plain Array on its own — ds_list_
  // destroy's manual-memory-management purpose has nothing left to do.
  out = out.replace(
    /\bds_list_destroy\s*\(\s*([^()]+)\s*\)\s*;?/g,
    () =>
      `(undefined /* ds_list_destroy: plain Array is GC'd automatically */);`,
  );

  // -- ds_map: real Map-backed replacements ------------------------------
  out = out.replace(/\bds_map_create\s*\(\s*\)\s*/g, "new Map()");
  out = out.replace(
    new RegExp(`\\bds_map_add\\s*\\((${BALANCED_PARENS_ONE_LEVEL})\\)`, "g"),
    (_m, args: string) => {
      const [map, key, value] = splitTopLevelArgs(args, 3);
      return `${map}.set(${key}, ${value})`;
    },
  );
  out = out.replace(
    new RegExp(
      `\\bds_map_replace\\s*\\((${BALANCED_PARENS_ONE_LEVEL})\\)`,
      "g",
    ),
    (_m, args: string) => {
      const [map, key, value] = splitTopLevelArgs(args, 3);
      return `${map}.set(${key}, ${value})`;
    },
  );
  out = out.replace(
    new RegExp(
      `\\bds_map_find_value\\s*\\((${BALANCED_PARENS_ONE_LEVEL})\\)`,
      "g",
    ),
    (_m, args: string) => {
      const [map, key] = splitTopLevelArgs(args, 2);
      return `${map}.get(${key})`;
    },
  );
  out = out.replace(
    new RegExp(`\\bds_map_exists\\s*\\((${BALANCED_PARENS_ONE_LEVEL})\\)`, "g"),
    (_m, args: string) => {
      const [map, key] = splitTopLevelArgs(args, 2);
      return `${map}.has(${key})`;
    },
  );
  out = out.replace(
    new RegExp(`\\bds_map_delete\\s*\\((${BALANCED_PARENS_ONE_LEVEL})\\)`, "g"),
    (_m, args: string) => {
      const [map, key] = splitTopLevelArgs(args, 2);
      return `${map}.delete(${key})`;
    },
  );
  out = out.replace(
    /\bds_map_size\s*\(\s*([^()]+)\s*\)/g,
    (_m, map: string) => `${map.trim()}.size`,
  );
  out = out.replace(
    /\bds_map_clear\s*\(\s*([^()]+)\s*\)/g,
    (_m, map: string) => `${map.trim()}.clear()`,
  );
  out = out.replace(
    /\bds_map_destroy\s*\(\s*([^()]+)\s*\)\s*;?/g,
    () => `(undefined /* ds_map_destroy: Map is GC'd automatically */);`,
  );

  // -- ds_grid: real nested-Array-backed replacements --------------------
  out = out.replace(
    new RegExp(
      `\\bds_grid_create\\s*\\((${BALANCED_PARENS_ONE_LEVEL})\\)`,
      "g",
    ),
    (_m, args: string) => {
      const [w, h] = splitTopLevelArgs(args, 2);
      return `Array.from({ length: (${w}) }, () => new Array(${h}).fill(0))`;
    },
  );
  out = out.replace(
    new RegExp(`\\bds_grid_get\\s*\\((${BALANCED_PARENS_ONE_LEVEL})\\)`, "g"),
    (_m, args: string) => {
      const [grid, c, r] = splitTopLevelArgs(args, 3);
      return `${grid}[${c}][${r}]`;
    },
  );
  out = out.replace(
    new RegExp(`\\bds_grid_set\\s*\\((${BALANCED_PARENS_ONE_LEVEL})\\)`, "g"),
    (_m, args: string) => {
      const [grid, c, r, value] = splitTopLevelArgs(args, 4);
      return `(${grid}[${c}][${r}] = ${value})`;
    },
  );
  out = out.replace(
    new RegExp(`\\bds_grid_clear\\s*\\((${BALANCED_PARENS_ONE_LEVEL})\\)`, "g"),
    (_m, args: string) => {
      const [grid, value] = splitTopLevelArgs(args, 2);
      return `${grid}.forEach((_col) => _col.fill(${value}))`;
    },
  );
  out = out.replace(
    /\bds_grid_width\s*\(\s*([^()]+)\s*\)/g,
    (_m, grid: string) => `${grid.trim()}.length`,
  );
  out = out.replace(
    /\bds_grid_height\s*\(\s*([^()]+)\s*\)/g,
    (_m, grid: string) => `(${grid.trim()}[0]?.length ?? 0)`,
  );
  out = out.replace(
    /\bds_grid_destroy\s*\(\s*([^()]+)\s*\)\s*;?/g,
    () =>
      `(undefined /* ds_grid_destroy: nested Array is GC'd automatically */);`,
  );

  // -- GML struct function API (struct *literal* syntax needs no rewrite) -
  out = out.replace(
    new RegExp(
      `\\bvariable_struct_get\\s*\\((${BALANCED_PARENS_ONE_LEVEL})\\)`,
      "g",
    ),
    (_m, args: string) => {
      const [struct, name] = splitTopLevelArgs(args, 2);
      return `${struct}[${name}]`;
    },
  );
  out = out.replace(
    new RegExp(
      `\\bvariable_struct_set\\s*\\((${BALANCED_PARENS_ONE_LEVEL})\\)`,
      "g",
    ),
    (_m, args: string) => {
      const [struct, name, value] = splitTopLevelArgs(args, 3);
      return `(${struct}[${name}] = ${value})`;
    },
  );
  out = out.replace(
    new RegExp(
      `\\bvariable_struct_exists\\s*\\((${BALANCED_PARENS_ONE_LEVEL})\\)`,
      "g",
    ),
    (_m, args: string) => {
      const [struct, name] = splitTopLevelArgs(args, 2);
      return `(${name} in ${struct})`;
    },
  );
  out = out.replace(
    new RegExp(
      `\\bvariable_struct_remove\\s*\\((${BALANCED_PARENS_ONE_LEVEL})\\)`,
      "g",
    ),
    (_m, args: string) => {
      const [struct, name] = splitTopLevelArgs(args, 2);
      return `delete ${struct}[${name}]`;
    },
  );

  // -- Accessor syntax: `arr[| i]` (ds_list), `arr[# c, r]` (ds_grid),
  // `arr[? key]` (ds_map) -- dispatched purely by bracket marker, per the
  // doc comment above.
  //
  // The ds_map `[? key]` accessor must be handled write-position-first:
  // `map[? key] = value` becomes `map.set(key, value)`, never
  // `map.get(key) = value` (not valid JS — you cannot assign into a
  // function call's result). Only a plain `=` counts as a write (the
  // negative lookahead excludes `==`); anything left after this write pass
  // runs is a read, and becomes `.get(key)`.
  //
  // The key capture (`DS_MAP_KEY` below) is string-literal-aware, not a
  // bare `[^\]]+`: a real project's `keyboard_init.gml` has
  // `l_s2c[?"]"] = 221;` — a string-literal key whose *content* is a single
  // `]` character. A plain `[^\]]+` capture stops at that quoted `]` as if
  // it were the accessor's own closing bracket, truncating the key and
  // leaving the real closing `]`/`=`/value dangling as broken trailing
  // syntax. Matching a whole `"..."`/`'...'` string literal as one unit
  // (before falling back to "any character that isn't `]`") is what lets a
  // bracket character safely appear inside quotes.
  const DS_MAP_KEY = `(?:"[^"]*"|'[^']*'|[^\\]])+`;
  out = out.replace(
    new RegExp(
      `([A-Za-z_$][\\w.]*)\\s*\\[\\s*\\?\\s*(${DS_MAP_KEY})\\]\\s*=(?!=)\\s*([^;\\n]+)`,
      "g",
    ),
    (_m, map: string, key: string, value: string) =>
      `${map}.set(${key.trim()}, ${value.trim()})`,
  );
  out = out.replace(
    new RegExp(`([A-Za-z_$][\\w.]*)\\s*\\[\\s*\\?\\s*(${DS_MAP_KEY})\\]`, "g"),
    (_m, map: string, key: string) => `${map}.get(${key.trim()})`,
  );

  // The ds_list `[| i]` and ds_grid `[# c, r]` accessors both resolve to
  // plain indexing syntax that JS/TS already supports natively as an
  // lvalue, so — unlike the ds_map accessor above — neither needs
  // position-aware (read vs write) handling: `list[i] = v` and
  // `grid[c][r] = v` are both already valid JS assignment targets as-is.
  out = out.replace(
    /\[\s*\|\s*([^\]]+)\]/g,
    (_m, i: string) => `[${i.trim()}]`,
  );
  out = out.replace(
    /\[\s*#\s*([^,\]]+),\s*([^\]]+)\]/g,
    (_m, c: string, r: string) => `[${c.trim()}][${r.trim()}]`,
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
  //
  // `if (false)`, not `if (true)`: the block's *body* is left completely
  // untouched for manual review (it can freely reference GML-only
  // rescoping constructs this pass has no way to translate — `other.foo`,
  // a bare identifier now meaning a different instance's field, etc.), and
  // those references are only valid GML inside a real `with` block, not
  // plain JS. `if (true)` would actually execute that untranslated body
  // and throw at runtime (confirmed against a real project: `with (mywall)
  // { image_xscale = other.sprite_width / sprite_width; }` throws
  // `ReferenceError: other is not defined`) — the opposite of this pass's
  // own documented intent ("without claiming to run the real per-instance
  // iteration"). `if (false)` keeps the block syntactically present and
  // reviewable without ever executing its untranslated body.
  out = out.replace(
    /\bwith\s*\(((?:[^()]|\([^()]*\))*)\)/g,
    () =>
      `if (false) /* TODO: migrate this GML "with (...)" block — iterate matching instances yourself */`,
  );

  // GML's `with` also allows a bare, paren-less target — `with obj_solid {
  // ... }` (a real, confirmed pattern; `if`/`while` allow the same bare
  // form in GML) — which the parenthesised-only pass above never matches
  // at all, leaving the real `with` keyword untouched in the output: a
  // hard strict-mode `SyntaxError` ("Strict mode code may not include a
  // with statement") at module load, for the exact same reason the comment
  // above already explains for the parenthesised form. Only fires when the
  // pass above hasn't already consumed this `with` (its target isn't
  // wrapped in `(...)`).
  //
  // Two guards a first version of this pass was missing, both confirmed
  // against a real project: (1) a negative lookbehind excluding "with"
  // inside a `//` comment — ordinary GML commentary routinely contains the
  // plain English word "with" ("// Draw the shadow with all the
  // calculations"), and without this guard the pass matched that comment's
  // own "with", then swallowed everything up to the *next* unrelated `{`
  // (a following `if (...) {`, potentially many real statements away) as
  // its supposed "target"; (2) the target itself is restricted to a single
  // bare identifier/dotted-chain (optionally one call), not an unbounded
  // `[\s\S]+?` span — GML's real `with` target is always exactly that
  // shape (an object/instance reference), and bounding it this way is what
  // stops a runaway match from ever reaching past the real, intended `{`
  // in the first place, comment guard or not.
  out = out.replace(
    /(?<!\/\/[^\n]*)\bwith\s+(?!\()[A-Za-z_]\w*(?:\.\w+)*(?:\([^()]*\))?\s*(?=\r?\n\s*\{|[ \t]*\{)/g,
    () =>
      `if (false) /* TODO: migrate this GML "with ..." block — iterate matching instances yourself */`,
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
    new RegExp(
      `\\binstance_create_layer\\s*\\(${BALANCED_PARENS_ONE_LEVEL}\\)(\\s*;)?`,
      "g",
    ),
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
    new RegExp(
      `\\broom_goto\\s*\\((${BALANCED_PARENS_ONE_LEVEL})\\)(\\s*;)?`,
      "g",
    ),
    (_m, rm: string, semi?: string) =>
      `(undefined /* sceneManager.load('${rm.trim()}'); */)${semi ?? ""}`,
  );
  out = out.replace(
    new RegExp(
      `\\bdraw_sprite\\s*\\(${BALANCED_PARENS_ONE_LEVEL}\\)(\\s*;)?`,
      "g",
    ),
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
    new RegExp(
      `\\bdraw_set_colour\\s*\\((${BALANCED_PARENS_ONE_LEVEL})\\)\\s*;?`,
      "g",
    ),
    (_m, hex: string) => `_ctx.drawTarget?.setColor(${hex.trim()});`,
  );
  out = out.replace(
    new RegExp(
      `\\bdraw_rectangle\\s*\\((${BALANCED_PARENS_ONE_LEVEL})\\)\\s*;?`,
      "g",
    ),
    (_m, args: string) => {
      const [x1, y1, x2, y2, outline] = splitTopLevelArgs(args, 5);
      return `_ctx.drawTarget?.rect(${x1}, ${y1}, ${x2}, ${y2}, ${outline});`;
    },
  );
  out = out.replace(
    new RegExp(
      `\\bdraw_circle\\s*\\((${BALANCED_PARENS_ONE_LEVEL})\\)\\s*;?`,
      "g",
    ),
    (_m, args: string) => {
      const [x, y, r, outline] = splitTopLevelArgs(args, 4);
      return `_ctx.drawTarget?.circle(${x}, ${y}, ${r}, ${outline});`;
    },
  );
  out = out.replace(
    new RegExp(
      `\\bdraw_text\\s*\\((${BALANCED_PARENS_ONE_LEVEL})\\)\\s*;?`,
      "g",
    ),
    (_m, args: string) => {
      const [x, y, text] = splitTopLevelArgs(args, 3);
      return `_ctx.drawTarget?.text(${x}, ${y}, ${text});`;
    },
  );
  out = out.replace(
    new RegExp(
      `\\bdraw_line\\s*\\((${BALANCED_PARENS_ONE_LEVEL})\\)\\s*;?`,
      "g",
    ),
    (_m, args: string) => {
      const [x1, y1, x2, y2] = splitTopLevelArgs(args, 4);
      return `_ctx.drawTarget?.line(${x1}, ${y1}, ${x2}, ${y2});`;
    },
  );

  // alarm[n] = expr
  //
  // Only a *bare* `alarm[n] = expr` (this instance's own alarm) is safe to
  // turn into the coroutine-migration comment below. GML also allows
  // `other.alarm[n] = expr`/`creator.alarm[n] = expr` — setting a
  // *different* instance's alarm through a dot-access reference (a real,
  // confirmed pattern: `creator.alarm[1] = 1;`) — and the negative
  // lookbehind here (`(?<!\.\s*)`) excludes that case rather than matching
  // starting mid-expression at "alarm": matching there left the dotted
  // prefix (`creator.`) dangling with nothing after its `.` once the rest
  // of the line became a `//` comment, a hard `SyntaxError` at module load,
  // not just a wrong migration comment.
  out = out.replace(
    /(?<!\/\/[^\n]*)(?<!\.\s*)\balarm\s*\[\s*\d+\s*\]\s*=\s*([^;\n]+)/g,
    (_m, expr: string) =>
      `// entity.startCoroutine(waitFrames(${expr.trimEnd()}));`,
  );

  // show_message(msg)
  //
  // The message argument commonly contains its own nested call — real,
  // confirmed shape (`show_message("creating instance for non-existent
  // object" + string(id));`, from a real project's `action_create_object.
  // gml`) — so the argument capture must tolerate one level of nested
  // parens the same way `BALANCED_PARENS_ONE_LEVEL` already does for every
  // other single-argument-call rewrite in this file. A naive `[^)]+`
  // capture stopped at the nested call's own `)`, truncating the message
  // and leaving the real trailing `)`/`;` dangling in the output — a hard
  // SyntaxError, confirmed against that same real file.
  out = out.replace(
    new RegExp(
      `\\bshow_message\\s*\\((${BALANCED_PARENS_ONE_LEVEL})\\)\\s*;?`,
      "g",
    ),
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
  // Each of these GML math functions shares its bare name with the real
  // JS/TS `Math.*` method this pass rewrites it to call — a negative
  // lookbehind excludes a call already qualified with `Math.` (including
  // one this same transpiler already produced earlier in this file, e.g.
  // `div`'s own `Math.floor(a / b)` rewrite above: `\bfloor\b`'s word
  // boundary doesn't care that a `.` precedes it, so without this guard a
  // `floor(...)`-shaped substring inside an already-rewritten `Math.floor(
  // ...)` call gets wrapped a second time into `Math.Math.floor(...)`).
  out = out.replace(
    /(?<!Math\.)\babs\s*\(\s*([^)]+)\s*\)/g,
    (_m, x: string) => `Math.abs(${x.trim()})`,
  );
  out = out.replace(
    /(?<!Math\.)\bfloor\s*\(\s*([^)]+)\s*\)/g,
    (_m, x: string) => `Math.floor(${x.trim()})`,
  );
  out = out.replace(
    /(?<!Math\.)\bceil\s*\(\s*([^)]+)\s*\)/g,
    (_m, x: string) => `Math.ceil(${x.trim()})`,
  );
  out = out.replace(
    /(?<!Math\.)\bround\s*\(\s*([^)]+)\s*\)/g,
    (_m, x: string) => `Math.round(${x.trim()})`,
  );
  out = out.replace(
    /(?<!Math\.)\bsqrt\s*\(\s*([^)]+)\s*\)/g,
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
    // GameMaker's "hypothetical position" collision-query family (see
    // CLAUDE.md's "GMS2 DnD action-library compat" section) — real
    // GameMaker solid-wall collision code (`if (place_meeting(x+4, y,
    // obj_wall)) { ... }`) calls these as plain GML function calls, not DnD
    // actions, but they need the exact same entity+ctx threading every
    // other `gmlActions.ts`/`gmlCollisionQueries.ts` export does, so they're
    // threaded the same way rather than needing a second rewrite pass.
    "place_meeting",
    "place_free",
    "place_snapped",
    "position_meeting",
    "position_free",
    "instance_place",
    "instance_position",
    "collision_rectangle",
    "collision_circle",
    "collision_line",
    "collision_point",
  ];
  for (const fn of THREADED_ACTIONS) {
    // The trailing `;` is captured, not just optionally consumed — DnD
    // actions (`action_move(...)`) are always their own statement and
    // always end in one, but the collision-query family
    // (`place_meeting`/`instance_place`/`collision_*`) is real GML
    // *expression* syntax, just as commonly called as a sub-expression
    // inside `if (...)`, `&&`, or an assignment's right-hand side, with no
    // trailing `;` of its own at all. Unconditionally appending `;` (the
    // previous behaviour) corrupted exactly that case — it injected a
    // semicolon *inside* the enclosing `if (...)`'s parens, e.g.
    // `if (GmlActions.place_meeting(...);)`. Echoing back only the
    // semicolon (if any) this specific call actually had keeps both shapes
    // correct.
    const re = new RegExp(`\\b${fn}\\s*\\(([^)]*)\\)(\\s*;)?`, "g");
    out = out.replace(re, (_m, args: string, semi: string | undefined) => {
      const trimmed = args.trim();
      const threaded =
        trimmed.length > 0 ? `_entity, _ctx, ${trimmed}` : "_entity, _ctx";
      return `GmlActions.${fn}(${threaded})${semi ?? ""}`;
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

  // -- GMS2 Timelines: timeline_index / timeline_running / timeline_speed /
  // timeline_loop / timeline_position -----------------------------------
  //
  // Real GameMaker semantics (manual.gamemaker.io's `timeline_index`/
  // `timeline_running` reference pages, confirmed live for this pass):
  // `timeline_index` is a genuine plain instance variable, not a function —
  // assigning it a timeline asset (in real GML source this is always a bare
  // identifier, e.g. `timeline_index = tmJiggle;`) targets that timeline for
  // the instance, but per `timeline_running`'s own doc page this does *not*
  // start it playing on its own ("Note that this does not start the
  // timeline - for that use the variable timeline_running"). Assigning `-1`
  // is GameMaker's own documented sentinel for "no timeline" ("set it to -1
  // to stop using a timeline for the instance"). `timeline_running`/
  // `timeline_speed`/`timeline_loop`/`timeline_position` are separate real
  // instance variables controlling playback and map 1:1 onto
  // `TimelineState`'s own fields (`components/GmlTimeline.ts`, itself
  // sourced from the same manual pages).
  //
  // (`sequence_index` was researched for this same pass and does not exist
  // as a GML instance variable — GameMaker's real Sequence API is
  // asset/layer-scoped (`layer_sequence_create(layer, x, y, sequence)`),
  // never a per-instance assignment the way timelines work. There is
  // therefore no GML source shape to rewrite here for `GmlSequenceState` —
  // see CLAUDE.md's `GmsProjectRuntime` entry for the honest, unchanged gap
  // this leaves.)
  //
  // `timeline_index = -1;` maps onto `entity.remove(TimelineState)` — "no
  // timeline assigned" is a real, distinct state from "assigned but not
  // running", and the component's absence already means exactly that
  // everywhere else in the engine (`TimelineSystem.update()` only ever
  // iterates entities that HAVE `TimelineState`).
  //
  // A non -1 assignment resolves its bare-identifier RHS the exact same way
  // this importer resolves every other GML asset-name reference into a real
  // id: `gms2-timeline-import.ts`'s `registerGmlTimeline(${JSON.stringify(
  // name)}, ...)` registers the timeline under its own resource name, so a
  // bare `tmJiggle` here is quoted into that exact string — not left as an
  // unresolved bare reference the way `action_create_object`'s object-name
  // argument still is (a real, separate, already-documented gap for that
  // family — see CLAUDE.md's "GMS2 DnD action-library compat" — but not one
  // this timeline id has any reason to repeat, since the two importers'
  // registries are keyed identically on the resource's own name).
  //
  // `Entity.add()` has one-shot semantics (throws if the component is
  // already present), so re-targeting an entity's timeline later in the
  // same event (or in a later event) can't just call `.add()` again — this
  // emits exactly the "entity.add(TimelineState, {...}) (or a field write
  // via .get() if the component is already present)" shape CLAUDE.md's own
  // `GmsProjectRuntime` "Honest gaps" paragraph names as the real operation
  // this rewrite needs to produce. `GmlActions.TimelineState` (not a bare
  // `TimelineState` import) reuses the exact `import * as GmlActions from
  // '@emptysock/engine'` line every generated `.behavior.ts` module already
  // carries unconditionally — no new conditional import bookkeeping needed,
  // and it's the same access style every other compat call in this pass
  // (`GmlActions.place_meeting`, `GmlActions.action_move`, …) already uses.
  // Guarded with `(?<!\.\s*)`, the same guard `alarm[n] = expr`/the
  // `sprite_index`/`image_*` rewrites above already use: a dotted reference
  // to another instance's timeline (`inst.timeline_index = tmFoo;`) is left
  // untouched rather than rewritten against the current entity — without
  // this, it became `inst.(() => { ... })();`, a hard `SyntaxError`.
  out = out.replace(
    /(?<!\/\/[^\n]*)(?<!\.\s*)\btimeline_index\s*=(?!=)\s*([^;\n]+);?/g,
    (_m, exprRaw: string) => {
      const expr = exprRaw.trim();
      if (/^\(?\s*-1\s*\)?$/.test(expr)) {
        return "_entity.remove(GmlActions.TimelineState);";
      }
      const idLiteral = /^[A-Za-z_]\w*$/.test(expr)
        ? JSON.stringify(expr)
        : expr;
      return `(() => { const _tl = _entity.get(GmlActions.TimelineState); if (_tl) { _tl.timelineId = ${idLiteral}; _tl.position = 0; _tl.running = true; } else { _entity.add(GmlActions.TimelineState, { timelineId: ${idLiteral}, position: 0, running: true }); } })();`;
    },
  );

  // Writes to the remaining, already-distinct timeline_* instance
  // variables — every one maps 1:1 onto a `TimelineState` field. Handled
  // before the bare-read pass below so a write isn't first mistaken for a
  // read; `entity.get()` returning `undefined` (no timeline assigned yet)
  // makes this a safe, honest no-op rather than a crash.
  out = out.replace(
    /(?<!\/\/[^\n]*)(?<!\.\s*)\btimeline_(running|speed|loop|position)\s*=(?!=)\s*([^;\n]+);?/g,
    (_m, field: string, exprRaw: string) =>
      `(() => { const _tl = _entity.get(GmlActions.TimelineState); if (_tl) _tl.${field} = ${exprRaw.trim()}; })();`,
  );

  // Reads of the same four variables — anything left after the write pass
  // above already consumed every assignment form. `timeline_index` itself
  // is deliberately NOT given a read-side rewrite: `TimelineState.timelineId`
  // is a string (the timeline's registered resource name), while
  // GameMaker's real `timeline_index` reads back a numeric asset index with
  // `-1` as its sentinel — there's no lossless way to answer
  // `timeline_index != -1` from a string id without inventing a fake
  // numeric encoding, so a bare read of `timeline_index` is left as a
  // genuinely unresolved identifier (the same "surface it, don't fake it"
  // rule this transpiler already applies elsewhere) rather than silently
  // misrepresenting the comparison.
  const TIMELINE_READ_DEFAULTS: Record<string, string> = {
    running: "false",
    speed: "1",
    loop: "false",
    position: "0",
  };
  out = out.replace(
    /(?<!\/\/[^\n]*)(?<!\.\s*)\btimeline_(running|speed|loop|position)\b/g,
    (_m, field: string) =>
      `(_entity.get(GmlActions.TimelineState)?.${field} ?? ${TIMELINE_READ_DEFAULTS[field]})`,
  );

  // -- GMS2 rendering built-ins: sprite_index / image_angle / image_xscale /
  // image_yscale / image_alpha / image_blend / depth -------------------------
  //
  // Every rewrite regex in this section (and the timeline/alarm ones above
  // it) carries a second negative lookbehind, `(?<!\/\/[^\n]*)`, alongside
  // the pre-existing dotted-reference guard — real, confirmed gap: real GML
  // source routinely has example/documentation code inside a `//` comment
  // (`//      image_angle = Wave(-45,45,1,0,0)  -> rock back and forth 90
  // degrees in a second`, from a real project's `scr_wave.gml`), and none of
  // these rewrites originally excluded comment lines at all. The rewrite
  // fired on the comment's own text, splicing a generated IIFE into the
  // middle of what should have stayed inert commentary and producing a hard
  // `SyntaxError` — confirmed identical in kind to the earlier dotted-
  // reference fix these regexes already carry, just for a different way a
  // bare identifier match can land somewhere it shouldn't.
  //
  // See CLAUDE.md's "GMS2 rendering built-ins: sprite_index / image_*" entry
  // for the full field-mapping table and the honest image_index/image_speed
  // gap (no per-frame animation is modelled anywhere in this importer — see
  // that entry for why). Before this pass, every one of these fell through
  // to the generic "auto-declare on first bare assignment" pass below, which
  // silently turned e.g. `sprite_index = spr_walk;` into a *local* variable
  // write whose right-hand side, `spr_walk`, is itself a bare, undeclared
  // identifier — a hard `ReferenceError` at runtime, not just a no-op,
  // confirmed by reading a real generated `.behavior.ts` file end to end.
  // `sprite_index`/`image_angle`/`image_xscale`/`image_yscale`/
  // `image_alpha` are real GameMaker per-instance variables that directly
  // control what's drawn (manual.gamemaker.io's Sprites/Instance Variables
  // reference pages), and this engine already has real fields to receive
  // them: `Sprite.texturePath`/`.alpha`/`.tint` (`components/Sprite.ts`) and
  // `Transform.rotation`/`.scaleX`/`.scaleY` (`components/Transform.ts`,
  // confirmed against `RenderPipeline._syncOne()`, which is what actually
  // reads `Transform.rotation`/`scale*` onto the rendered PixiJS sprite —
  // `Sprite` itself has no rotation/scale fields of its own).

  const SPRITE_ASSET_RE = /^[A-Za-z_]\w*$/;

  /**
   * Resolve a GML sprite-asset reference to this importer's own real
   * texture-path convention — `./assets/sprites/<name>/frame_0.png`, the
   * exact one `gms2-codegen.ts`'s `buildObjectPrefabJSON`/`buildSpriteAsset`
   * already use for an object's own initial `spriteId`, so a `sprite_index`
   * assignment and that initial sprite can never disagree on what a
   * sprite's texture path is. A bare identifier (the overwhelmingly common
   * real shape — `sprite_index = spr_dad_hug;`) is a literal GameMaker
   * asset name and gets quoted into that path. GameMaker's own documented
   * sentinel, `sprite_index = -1` ("remove the sprite from an instance"),
   * resolves to `""` — `Sprite.texturePath`'s own default, already meaning
   * "no texture" everywhere else in this engine. Anything else (a variable,
   * a ternary, another instance's `sprite_index`) is assumed to already
   * evaluate to a real texture-path string and is passed through unchanged
   * — this importer has no way to resolve an arbitrary runtime expression
   * to an asset name ahead of time, and doesn't pretend to.
   */
  function resolveSpriteAssetExpr(exprRaw: string): string {
    const expr = exprRaw.trim();
    if (/^\(?\s*-1\s*\)?$/.test(expr)) return `""`;
    if (SPRITE_ASSET_RE.test(expr)) {
      return JSON.stringify(`./assets/sprites/${expr}/frame_0.png`);
    }
    return expr;
  }

  // Every rewrite below is guarded with `(?<!\.\s*)` — the same guard
  // `alarm[n] = expr` (above) already uses for the identical reason: GML
  // allows a *different* instance's field to be read/written through a dot
  // reference (`inst.sprite_index = spr_x;`, `other.image_xscale`, a real,
  // confirmed shape in a real project's script — `inst.image_xscale =
  // imgx;`). This transpiler has no way to resolve which other entity
  // `inst`/`other` refers to, so a dotted reference is deliberately left
  // untouched (an honest unresolved-identifier case) rather than rewritten
  // as if it were the current entity's own field. Without this guard,
  // `inst.image_xscale = imgx;` became `inst.(() => { ... })();` — a
  // dangling `.` followed by an expression, not a property name — a hard
  // `SyntaxError`, confirmed via a real `tsc --noEmit` run against a real
  // project's generated output.
  out = out.replace(
    /(?<!\/\/[^\n]*)(?<!\.\s*)\bsprite_index\s*=(?!=)\s*([^;\n]+);?/g,
    (_m, exprRaw: string) =>
      `(() => { const _sp = _entity.get(GmlActions.Sprite); if (_sp) _sp.texturePath = ${resolveSpriteAssetExpr(exprRaw)}; })();`,
  );
  // Equality comparisons against a bare sprite-asset identifier (the other
  // extremely common real shape — `if (sprite_index == spr_dad_idle)`)
  // resolve that identifier the same way the write side does, before the
  // generic bare-read rewrite below turns `sprite_index` itself into a
  // `.texturePath` read — otherwise the identifier on the other side of
  // `==`/`!=` would be left unresolved and crash the same way the write
  // side used to.
  out = out.replace(
    /(?<!\/\/[^\n]*)(?<!\.\s*)\bsprite_index\s*(==|!=)\s*([A-Za-z_]\w*|-1)/g,
    (_m, op: string, rhs: string) =>
      `sprite_index ${op} ${resolveSpriteAssetExpr(rhs)}`,
  );
  out = out.replace(
    /\b([A-Za-z_]\w*|-1)\s*(==|!=)\s*(?<!\.\s*)sprite_index\b/g,
    (_m, lhs: string, op: string) =>
      `${resolveSpriteAssetExpr(lhs)} ${op} sprite_index`,
  );
  out = out.replace(
    /(?<!\/\/[^\n]*)(?<!\.\s*)\bsprite_index\b/g,
    `(_entity.get(GmlActions.Sprite)?.texturePath ?? "")`,
  );

  // `image_angle` — GameMaker degrees, this engine's `Transform.rotation`
  // radians (matching pixi's own convention — see `RenderPipeline`'s
  // `pixiSprite.rotation = transform.rotation`). Converted both ways with
  // the exact `* Math.PI / 180` factor `gmlCamera.ts`/`gmlProjection.ts`
  // already use for every other GML-degrees-to-engine-radians field.
  out = out.replace(
    /(?<!\/\/[^\n]*)(?<!\.\s*)\bimage_angle\s*=(?!=)\s*([^;\n]+);?/g,
    (_m, exprRaw: string) =>
      `(() => { const _t = _entity.get(GmlActions.Transform); if (_t) _t.rotation = (${exprRaw.trim()}) * Math.PI / 180; })();`,
  );
  out = out.replace(
    /(?<!\/\/[^\n]*)(?<!\.\s*)\bimage_angle\b/g,
    `((_entity.get(GmlActions.Transform)?.rotation ?? 0) * 180 / Math.PI)`,
  );

  // `image_xscale`/`image_yscale` — GameMaker's per-instance sprite scale
  // multipliers map straight onto `Transform.scaleX`/`.scaleY`, no unit
  // conversion needed (both default to `1`).
  const IMAGE_SCALE_FIELDS: ReadonlyArray<readonly [string, string]> = [
    ["image_xscale", "scaleX"],
    ["image_yscale", "scaleY"],
  ];
  for (const [gmlName, field] of IMAGE_SCALE_FIELDS) {
    const writeRe = new RegExp(
      `(?<!\\/\\/[^\\n]*)(?<!\\.\\s*)\\b${gmlName}\\s*=(?!=)\\s*([^;\\n]+);?`,
      "g",
    );
    out = out.replace(
      writeRe,
      (_m, exprRaw: string) =>
        `(() => { const _t = _entity.get(GmlActions.Transform); if (_t) _t.${field} = ${exprRaw.trim()}; })();`,
    );
    const readRe = new RegExp(
      `(?<!\\/\\/[^\\n]*)(?<!\\.\\s*)\\b${gmlName}\\b`,
      "g",
    );
    out = out.replace(
      readRe,
      `(_entity.get(GmlActions.Transform)?.${field} ?? 1)`,
    );
  }

  // `image_alpha` — maps straight onto `Sprite.alpha` (both default to `1`,
  // GameMaker's "fully opaque").
  out = out.replace(
    /(?<!\/\/[^\n]*)(?<!\.\s*)\bimage_alpha\s*=(?!=)\s*([^;\n]+);?/g,
    (_m, exprRaw: string) =>
      `(() => { const _sp = _entity.get(GmlActions.Sprite); if (_sp) _sp.alpha = ${exprRaw.trim()}; })();`,
  );
  out = out.replace(
    /(?<!\/\/[^\n]*)(?<!\.\s*)\bimage_alpha\b/g,
    `(_entity.get(GmlActions.Sprite)?.alpha ?? 1)`,
  );

  // `image_blend` — GameMaker's per-instance blend colour, same
  // `0xBBGGRR`-ordered value `action_sprite_color` (`gmlActions.ts`)
  // already converts for the DnD "Set Sprite Colour/Blending" action;
  // reused here, not reimplemented, on both the write side (BGR -> RGB into
  // `Sprite.tint`) and the read side (RGB -> BGR back out, a real, exact
  // round trip, not an approximation).
  out = out.replace(
    /(?<!\/\/[^\n]*)(?<!\.\s*)\bimage_blend\s*=(?!=)\s*([^;\n]+);?/g,
    (_m, exprRaw: string) =>
      `(() => { const _sp = _entity.get(GmlActions.Sprite); if (_sp) { const _bl = (${exprRaw.trim()}); const _bb = (_bl >> 16) & 0xff; const _gg = (_bl >> 8) & 0xff; const _rr = _bl & 0xff; _sp.tint = (_rr << 16) | (_gg << 8) | _bb; } })();`,
  );
  out = out.replace(
    /(?<!\/\/[^\n]*)(?<!\.\s*)\bimage_blend\b/g,
    `(() => { const _t = _entity.get(GmlActions.Sprite)?.tint ?? 0xffffff; return ((_t & 0xff) << 16) | (_t & 0xff00) | ((_t >> 16) & 0xff); })()`,
  );

  // `depth` — GameMaker's per-instance draw-order variable maps onto
  // `Sprite.depth` (`components/Sprite.ts`), but the two disagree on
  // *direction*: manual.gamemaker.io's own Depth reference page is explicit
  // that a *lower* `depth` value draws that instance *in front of* (on top
  // of) instances with a higher `depth` — GameMaker's canonical example is
  // "an instance with depth -100 is drawn in front of one with depth 0".
  // This engine's `Sprite.depth` sorts the opposite way: `RenderPipeline`
  // (`_syncOne()`/`_syncProjected()`) writes `pixiSprite.zIndex =
  // sprite.depth` straight through, and PixiJS's own `zIndex` convention is
  // "higher zIndex draws on top" — confirmed consistent with
  // `LayerSystem.ts`'s own doc comment ("lower depth within the same layer
  // ... also behind"). So a *higher* `Sprite.depth` draws in front here,
  // the exact inverse of GameMaker's *lower*-draws-in-front rule. Both
  // rewrites below apply a `-` sign flip so GML's actual visual semantic is
  // preserved end to end rather than copied byte-for-byte onto a field that
  // happens to share the name but not the direction: `depth = -100;`
  // (GameMaker: draws in front) becomes a `Sprite.depth` write of `100`
  // (this engine: higher zIndex, also draws in front) — same real-world
  // result, correct sign for this engine's own convention. The read side
  // applies the identical flip in reverse, so GML code that reads its own
  // `depth` back after writing it sees its original, un-flipped value
  // (write `-100` -> `Sprite.depth` becomes `100` -> read back negates to
  // `-100` again, a real, exact round trip, not an approximation).
  out = out.replace(
    /(?<!\/\/[^\n]*)(?<!\.\s*)\bdepth\s*=(?!=)\s*([^;\n]+);?/g,
    (_m, exprRaw: string) =>
      `(() => { const _sp = _entity.get(GmlActions.Sprite); if (_sp) _sp.depth = -(${exprRaw.trim()}); })();`,
  );
  out = out.replace(
    /(?<!\/\/[^\n]*)(?<!\.\s*)\bdepth\b/g,
    `(-(_entity.get(GmlActions.Sprite)?.depth ?? 0))`,
  );

  // GameMaker instance variables (both its own built-ins — image_speed,
  // image_index, visible, ... — and any project-defined one, e.g. a plain
  // `mywall = instance_create_layer(...)`) need no declaration in GML — a
  // bare `name = expr;` implicitly creates/writes that instance's own
  // field the first time it's assigned. The rest of this transpiler emits
  // that assignment completely unchanged (a bare identifier target), which
  // is valid GML but not valid JS/TS: each generated event handler is its
  // own function (see gms2-codegen.ts), and an undeclared bare-identifier
  // assignment throws `ReferenceError` in a strict-mode ES module at
  // runtime — confirmed against two real projects (`obj_checkpoint`'s
  // `Create_0.gml`: `image_speed = 0;`, a built-in; `obj_crate`'s
  // `Create_0.gml`: `mywall = instance_create_layer(...)`, a project-
  // defined name), not a hypothetical. `transpileGML` is called once per
  // GML event file (`gms2-codegen.ts`'s `readAndTranspileGML` call sites),
  // and each event becomes exactly one generated function — so "first bare
  // assignment in this call's output" is exactly "first assignment in this
  // function's scope", the same boundary GML itself uses. This does not
  // attempt real instance-variable persistence *across* events (each
  // generated function is still its own scope, and a later event reading a
  // value an earlier event set will see its GML default, not that stored
  // value — a real, separate, tracked gap); it only prevents the hard
  // crash within one event's own body.
  {
    const RESERVED = new Set([
      "if",
      "else",
      "for",
      "while",
      "do",
      "function",
      "return",
      "var",
      "let",
      "const",
      "new",
      "typeof",
      "instanceof",
      "in",
      "of",
      "break",
      "continue",
      "switch",
      "case",
      "default",
      "try",
      "catch",
      "finally",
      "throw",
      "delete",
      "void",
      "this",
      "class",
      "extends",
      "super",
      "import",
      "export",
      "yield",
      "async",
      "await",
      "null",
      "undefined",
      "true",
      "false",
      "with",
    ]);
    const declared = new Set<string>();
    for (const m of out.matchAll(/\b(?:var|let|const)\s+([A-Za-z_]\w*)/g)) {
      declared.add(m[1] as string);
    }
    const bareAssign = /^(\s*)([A-Za-z_]\w*)(\s*=(?!=)\s*)/;
    // Real, confirmed regression: GML's real multi-declarator `var` syntax
    // (`var x_ = x,\n        y_ = y;` — a single statement, comma-
    // continued onto the next line, byte-for-byte identical to standard
    // JS/TS multi-declarator syntax) was already valid output on its own.
    // This pass, scanning purely line-by-line with no memory of the
    // previous line, didn't know `y_ = y;` was a *continuation* of that
    // same `var` statement rather than its own new statement — it matched
    // `y_ = y` as a fresh bare assignment and prefixed it with its own
    // `var`, producing `var x_ = x,\n  var y_ = y;`: a `var` keyword
    // sitting right after a trailing comma, a hard `SyntaxError: Trailing
    // comma not allowed`. A line whose *previous* non-empty line (with any
    // trailing `//` comment stripped first, so a comment after the comma
    // doesn't hide it) ends in a top-level `,` is exactly that
    // continuation case — its own identifier is already declared by the
    // statement it continues, so it's added to `declared` and the line is
    // left alone rather than re-prefixed with a second `var`.
    let prevEndsWithComma = false;
    out = out
      .split("\n")
      .map((line) => {
        const trimmedForComma = (
          line.includes("//") ? line.slice(0, line.indexOf("//")) : line
        ).trimEnd();
        const continuesPrevDeclaration = prevEndsWithComma;
        if (trimmedForComma.length > 0) {
          prevEndsWithComma = trimmedForComma.endsWith(",");
        }
        const match = bareAssign.exec(line);
        if (match === null) return line;
        const indent = match[1] ?? "";
        const name = match[2] ?? "";
        const eq = match[3] ?? "";
        if (name === "" || RESERVED.has(name) || declared.has(name))
          return line;
        if (continuesPrevDeclaration) {
          declared.add(name);
          return line;
        }
        declared.add(name);
        return `${indent}var ${name}${eq}${line.slice(match[0].length)}`;
      })
      .join("\n");
  }

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
