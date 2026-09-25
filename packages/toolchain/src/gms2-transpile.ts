import fs from "fs/promises";
import path from "path";

// ---------------------------------------------------------------------------
// GML pattern-level transpiler
// ---------------------------------------------------------------------------

/**
 * Real, project-wide `#macro NAME value` resolution. GameMaker's `#macro`
 * is pure textual substitution at compile time, applied project-wide — a
 * macro defined in one script routinely gets used in a dozen unrelated
 * object/script files (real, confirmed: `#macro SAVEFILE "freedom.sav"` in
 * one script, referenced throughout the game's own save/load system
 * elsewhere). `transpileGML` itself only ever sees one file's text at a
 * time, so this map has to be built once, project-wide, before any file is
 * transpiled — `importGMS2Project` calls `scanGmlMacros()` then
 * `setGmlMacros()` right at the start, before any `buildObjectBehavior`/
 * `buildScriptModule` call. Module-level state (not threaded as a
 * parameter through every codegen function) is a deliberate, scoped
 * tradeoff: `importGMS2Project` runs one project through this module
 * sequentially, never two projects concurrently in the same process, so
 * this carries the same safety this file's other module-level `const`
 * helpers already have.
 */
let _macros: ReadonlyMap<string, string> = new Map();

/** Installs the project-wide macro map `transpileGML`'s own `#macro` substitution pass reads. Call once, before transpiling any file. */
export function setGmlMacros(macros: ReadonlyMap<string, string>): void {
  _macros = macros;
}

/**
 * Walks every `.gml` file under `projectRoot` and extracts every real
 * `#macro NAME value` declaration into a `name -> value` map. Real
 * GameMaker macros are one value expression per line (GameMaker's own IDE
 * doesn't support multi-line macro bodies without an explicit trailing
 * `\`, which is rare enough in real projects to leave as an honest,
 * undocumented edge case rather than build multi-line continuation
 * handling with no real example to verify it against).
 */
export async function scanGmlMacros(
  projectRoot: string,
): Promise<Map<string, string>> {
  const macros = new Map<string, string>();
  const MACRO_RE = /^[ \t]*#macro\s+(\S+)\s+(.*)$/gm;

  async function walk(dir: string): Promise<void> {
    let entries: string[];
    try {
      entries = await fs.readdir(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry);
      const stat = await fs.stat(full).catch(() => null);
      if (stat === null) continue;
      if (stat.isDirectory()) {
        await walk(full);
      } else if (entry.endsWith(".gml")) {
        const content = await fs.readFile(full, "utf-8").catch(() => "");
        for (const m of content.matchAll(MACRO_RE)) {
          const name = m[1];
          const value = m[2]?.trim();
          if (name !== undefined && value !== undefined && value !== "") {
            macros.set(name, value);
          }
        }
      }
    }
  }

  await walk(projectRoot);
  return macros;
}

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

// Same idea as `BALANCED_PARENS_ONE_LEVEL` but tolerating two levels of
// nested parens — needed once a call's argument can itself already be a
// previously-rewritten GML built-in expression, not just raw source text.
// Real, confirmed case: `draw_sprite`'s own argument-list capture must
// still match correctly when its `sprite_index` argument has *already*
// been expanded by an earlier pass into `(_entity.get(GmlActions.Sprite)?.
// texturePath ?? "")` — itself two parens deep (the wrapping group, then
// `.get(...)`) before `draw_sprite`'s own enclosing parens are even
// counted. `BALANCED_PARENS_ONE_LEVEL` alone can't match that; this
// mirrors the same technique `IF_CLAUSE` (below) already uses for a
// two-level-tolerant condition clause, just without IF_CLAUSE's own
// enclosing `(...)` baked in, since callers here supply their own.
const BALANCED_PARENS_TWO_LEVELS = "(?:[^()]|\\((?:[^()]|\\([^()]*\\))*\\))*";

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

function escapeRegExpTranspile(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Masks every real string literal in `text` behind a `\u0000<prefix><N>
 * \u0000` placeholder, so a later identifier-rewrite regex can't fire
 * *inside* one (the `sprite_index`/implicit-var passes' own precedent — see
 * their doc comments' "protect literals during regex-based rewriting"
 * note). Real, confirmed regression this version specifically fixes: the
 * masking regex previously used inline at each call site
 * (`/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g`) has no notion of a `//` line
 * comment, and real GML comments routinely contain a lone apostrophe —
 * English possessives/contractions (`// Taking away the player's control`,
 * confirmed against Freedom Backup's own real `obj_player/Step_0.gml`,
 * which has half a dozen of these). An *odd* number of `'` characters
 * scattered across a function body's comments makes that regex's own
 * single-quote alternative pair up the *wrong* two apostrophes — one from
 * an early comment, the next from a much later, wholly unrelated one — and
 * greedily swallow every real line of code in between into one giant fake
 * "string literal". That whole span then never gets replaced with any
 * placeholder that later passes are able to find, unmask, *or rewrite* — it
 * sails through the masking step and every identifier-rewrite loop after it
 * completely untouched, and only comes back out verbatim, unrewritten, at
 * the final unmask step. This was a real, severe, previously-undiscovered
 * bug: it silently defeated the implicit-instance-variable pass (`hsp`/
 * `vsp`/etc.) for entire regions of a real function body whenever a stray
 * apostrophe fell inside a comment above them — confirmed by reading
 * `obj_player.behavior.ts`'s real generated output, where `place_meeting(x,
 * y + 1, ...)`'s `x`/`y` arguments stayed bare, unrewritten identifiers
 * despite this file's own `x`/`y` rewrite pass being otherwise proven
 * correct against every synthetic (comment-apostrophe-free) test case.
 *
 * The fix processes one physical line at a time: a `//` that appears
 * outside any already-open string on that line ends the line's own
 * "real code" portion right there — only the code *before* it is scanned
 * for quotes to mask; the comment text itself, apostrophes and all, is
 * carried through completely unscanned (and therefore can never
 * mismatched-pair with a quote on a different line). This can't perfectly
 * handle a `//` that appears *inside* a real string literal earlier on the
 * same line (a genuinely rare shape — this codebase's own precedent
 * elsewhere already accepts equivalent narrow, documented approximations
 * over a full GML tokenizer), but it closes the real, common, and severe
 * case this bug was actually found through.
 */
function maskGmlStringLiterals(
  text: string,
  prefix: string,
): { masked: string; store: string[] } {
  const store: string[] = [];
  const quoteRe = /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g;
  const maskLine = (line: string): string => {
    const commentIdx = line.indexOf("//");
    const code = commentIdx === -1 ? line : line.slice(0, commentIdx);
    const rest = commentIdx === -1 ? "" : line.slice(commentIdx);
    const maskedCode = code.replace(quoteRe, (m) => {
      store.push(m);
      return `\u0000${prefix}${store.length - 1}\u0000`;
    });
    return maskedCode + rest;
  };
  // Splitting on `\n` alone (not `\r\n`) is deliberate — a trailing `\r`
  // left on `code`/`rest` is inert for every purpose this mask/unmask round
  // trip cares about (it's restored byte-for-byte either way), and
  // splitting on the two-character sequence would need to be reassembled
  // with it, extra complexity with no behavioural difference.
  const masked = text.split("\n").map(maskLine).join("\n");
  return { masked, store };
}

function unmaskGmlStringLiterals(
  text: string,
  prefix: string,
  store: readonly string[],
): string {
  return text.replace(
    new RegExp(`\\u0000${prefix}(\\d+)\\u0000`, "g"),
    (_m, i: string) => store[Number(i)] ?? "",
  );
}

/**
 * Builds a cheap "how many `function(...) { ... }` literals textually
 * enclose this character offset" probe over `source`, used by the
 * `static`-variable rewrite pass to tell a top-level declaration (directly
 * in the body being transpiled) apart from one nested inside a GML struct
 * method's own inline `function() { ... }` literal.
 *
 * Not a real parser — a single linear brace-depth scan. Every `{` is
 * classified as "opened by a function literal" only when it's the very
 * next non-whitespace character after a `function ...(...)` signature
 * (matched the same permissive way GMS2.3+ method literals already pass
 * through this transpiler unchanged); every other `{` (an `if`/`for`/
 * `while` block, a struct literal, ...) pushes a non-function frame. A `}`
 * pops whatever frame is on top. Good enough for well-formed transpiler
 * input (this runs after comment-neutralisation, so no stray braces inside
 * comments can throw the count off).
 */
function buildFunctionDepthProbe(source: string): (offset: number) => number {
  const functionBraceOffsets = new Set<number>();
  const sigRe = /\bfunction\b[^{(]*\([^)]*\)\s*(?:\/\*[^*]*\*\/\s*)*\{/g;
  let sm: RegExpExecArray | null;
  while ((sm = sigRe.exec(source)) !== null) {
    functionBraceOffsets.add(sm.index + sm[0].length - 1);
  }

  // depthAtOffset[i] = function-literal nesting depth *before* character i.
  const depthAtOffset = new Int32Array(source.length + 1);
  const isFunctionFrame: boolean[] = [];
  let depth = 0;
  for (let i = 0; i < source.length; i++) {
    depthAtOffset[i] = depth;
    const ch = source[i];
    if (ch === "{") {
      isFunctionFrame.push(functionBraceOffsets.has(i));
      if (functionBraceOffsets.has(i)) depth++;
    } else if (ch === "}") {
      const wasFunction = isFunctionFrame.pop();
      if (wasFunction) depth--;
    }
  }
  depthAtOffset[source.length] = depth;

  return (offset: number): number =>
    depthAtOffset[Math.max(0, Math.min(offset, source.length))] ?? 0;
}

const GML_RESERVED_IDENTIFIERS = new Set([
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

/**
 * Identify every name GML would treat as an implicit (undeclared-`var`)
 * instance field within `text` — a line-start bare assignment (`name =
 * expr;`) whose name isn't a reserved word, an already-`var`/`let`/`const`-
 * declared real local, or in `extraReserved` (a script's own real named
 * parameters, when scanning a script body). Shared by `transpileGML`'s own
 * final rewrite pass and `scanGmlImplicitVars` (the pre-scan
 * `gms2-codegen.ts` runs across every one of one object's sibling event
 * files, so a name assigned in Create and only ever *read* in Step is still
 * recognised as implicit in Step — see `scanGmlImplicitVars`'s own doc
 * comment for the real regression this closes).
 */
function identifyGmlImplicitVars(
  text: string,
  extraReserved: ReadonlySet<string> = new Set(),
): Set<string> {
  const declared = new Set<string>();
  for (const m of text.matchAll(/\b(?:var|let|const)\s+([A-Za-z_]\w*)/g)) {
    declared.add(m[1] as string);
  }
  const bareAssign = /^(\s*)([A-Za-z_]\w*)(\s*=(?!=)\s*)/;
  let prevEndsWithComma = false;
  const implicitVars = new Set<string>();
  for (const line of text.split("\n")) {
    const trimmedForComma = (
      line.includes("//") ? line.slice(0, line.indexOf("//")) : line
    ).trimEnd();
    const continuesPrevDeclaration = prevEndsWithComma;
    if (trimmedForComma.length > 0) {
      prevEndsWithComma = trimmedForComma.endsWith(",");
    }
    const match = bareAssign.exec(line);
    if (match === null) continue;
    const name = match[2] ?? "";
    if (
      name === "" ||
      GML_RESERVED_IDENTIFIERS.has(name) ||
      extraReserved.has(name) ||
      declared.has(name)
    )
      continue;
    declared.add(name);
    if (continuesPrevDeclaration) continue;
    implicitVars.add(name);
  }
  return implicitVars;
}

/**
 * Rewrites every statement-start `name = <expr>;` in `text` via `build`,
 * where `<expr>` may itself span multiple physical lines — real, confirmed
 * case (Freedom Backup's obj_trans): `fin_msg = choose(a, b, c,\n  d, e,\n
 * f);`, a single real GML statement whose call arguments wrap across
 * several lines. A plain `[^;\n]+` regex capture (used by the increment/
 * decrement and compound-assign passes, where a multi-line RHS is far
 * rarer) stops at the first newline, truncating the expression and leaving
 * its continuation lines as orphaned, syntactically invalid fragments. This
 * scans forward from the `=` tracking `(`/`[`/`{` nesting depth to find the
 * real terminating top-level `;` (or end of text), so a parenthesised
 * argument list's own internal newlines never end the expression early.
 *
 * GML's own `;` is optional — a real, confirmed second regression this
 * scan has to account for: Freedom Backup's obj_enemy has `grounded =
 * true\nimage_speed = 1;` (no semicolon after `true` at all; the newline
 * alone ends the statement, GML's own valid syntax). Stopping the scan
 * *only* at `;` merged that bare newline's following statement straight
 * into `true`'s own expression. The real distinguishing signal: a
 * genuinely multi-line expression (an open call/array/struct literal
 * spanning lines) always has unbalanced-open (`depth > 0`) parens at the
 * newline; a statement that simply omitted its `;` always has balanced
 * (`depth <= 0`) parens there, since GML's own grammar requires a
 * statement's parens to already be closed before the next one can begin.
 * The scan stops at *either* a top-level `;` or a bare newline while
 * `depth <= 0`, and only keeps going past a newline when `depth > 0`.
 */
function replacePlainAssignmentMultiline(
  text: string,
  name: string,
  build: (indent: string, expr: string) => string,
): string {
  const re = new RegExp(
    `^(\\s*)${escapeRegExpTranspile(name)}\\s*=(?!=)\\s*`,
    "gm",
  );
  let result = "";
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const indent = m[1] ?? "";
    const exprStart = m.index + m[0].length;
    let depth = 0;
    let i = exprStart;
    for (; i < text.length; i++) {
      const c = text[i];
      if (c === "(" || c === "[" || c === "{") depth++;
      else if (c === ")" || c === "]" || c === "}") depth--;
      else if ((c === ";" || c === "\n") && depth <= 0) break;
    }
    const expr = text.slice(exprStart, i).trim();
    result += text.slice(lastIndex, m.index) + build(indent, expr);
    lastIndex = text[i] === ";" ? i + 1 : i;
    re.lastIndex = lastIndex;
  }
  result += text.slice(lastIndex);
  return result;
}

function skipWsTranspile(text: string, i: number): number {
  let j = i;
  while (j < text.length && /\s/.test(text[j] ?? "")) j++;
  return j;
}

/** Index just past the matching `closeCh` for the `openCh` sitting at `text[start]`. */
function scanBalancedTranspile(
  text: string,
  start: number,
  openCh: string,
  closeCh: string,
): number {
  let depth = 0;
  let i = start;
  for (; i < text.length; i++) {
    if (text[i] === openCh) depth++;
    else if (text[i] === closeCh) {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return i;
}

/**
 * Real implementation of GameMaker's `with (target) { body }` /
 * `with target { body }` / `with (target) singleStatement;` — genuinely
 * common real GameMaker source (confirmed against a real, full GameMaker
 * project: dozens of real call sites — `with (mywall) instance_destroy();`,
 * `with (obj_player) { ... }`, `with (instance_create_layer(...)) { ... }`,
 * `with (other) instance_destroy();`) that used to always become dead code
 * (an always-false guarded TODO comment), a severe, real gap for
 * GameMaker's primary broadcast/iteration mechanism, not a cosmetic
 * placeholder.
 *
 * The real insight that makes this tractable without re-implementing a GML
 * parser: `body`'s own raw text is spliced *unchanged* into a
 * `(_entity) => { ... }` callback and left for the rest of this pipeline's
 * later passes (image_* rewrites, instance-var rewrites, etc., which all
 * already emit `_entity`/`_ctx` unconditionally) to process normally — since the
 * callback parameter is itself named `_entity`, ordinary JS lexical
 * shadowing makes every one of those later rewrites automatically resolve
 * against the *iterated* instance, not the caller, with zero special-casing
 * needed for the body's content. `other` inside `body` (a real, valid GML
 * reference to the instance that *entered* the `with` block) is rewritten
 * to `_other` before splicing, backed by a `const _other = <the outer
 * _entity>;` in the generated callback.
 *
 * `isKnownTargetVar(name)` decides whether a bare-identifier target is a
 * real variable already holding an instance reference (passed through
 * as-is, so it resolves via `GmlInstanceVars`/`_other`/`_entity` like any
 * other read) or an object-*type* name (quoted into the string
 * `with_each`'s own `all`/`noone`/type-name matching expects) — the exact
 * same "known implicit var vs. literal type name" ambiguity
 * `bareOrQuotedUnlessVar` already resolves for `place_meeting` etc., reused
 * here via the same caller-supplied predicate rather than a second,
 * possibly-divergent copy of that decision.
 */
function rewriteWithStatements(
  text: string,
  isKnownTargetVar: (name: string) => boolean,
): string {
  const withRe = /(?<!\/\/[^\n]*)\bwith\b/g;
  let result = "";
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = withRe.exec(text)) !== null) {
    if (m.index < lastIndex) continue;
    let i = skipWsTranspile(text, m.index + m[0].length);

    let targetText: string;
    if (text[i] === "(") {
      const end = scanBalancedTranspile(text, i, "(", ")");
      targetText = text.slice(i + 1, end - 1);
      i = end;
    } else {
      const bareMatch = /^[A-Za-z_]\w*(?:\.\w+)*(?:\([^()]*\))?/.exec(
        text.slice(i),
      );
      if (bareMatch === null) continue;
      targetText = bareMatch[0];
      i += bareMatch[0].length;
    }
    i = skipWsTranspile(text, i);

    let bodyText: string;
    let bodyEnd: number;
    if (text[i] === "{") {
      const end = scanBalancedTranspile(text, i, "{", "}");
      bodyText = text.slice(i + 1, end - 1);
      bodyEnd = end;
    } else {
      let depth = 0;
      let j = i;
      for (; j < text.length; j++) {
        const c = text[j];
        if (c === "(" || c === "[" || c === "{") depth++;
        else if (c === ")" || c === "]" || c === "}") depth--;
        else if ((c === ";" || c === "\n") && depth <= 0) break;
      }
      bodyText = text.slice(i, j) + (text[j] === ";" ? ";" : "");
      bodyEnd = text[j] === ";" ? j + 1 : j;
    }

    const trimmedTarget = targetText.trim();
    let targetExpr: string;
    if (/^[A-Za-z_]\w*$/.test(trimmedTarget)) {
      if (trimmedTarget === "self" || trimmedTarget === "noone") {
        targetExpr =
          trimmedTarget === "self" ? "_entity" : JSON.stringify("noone");
      } else if (
        trimmedTarget === "_other" ||
        trimmedTarget === "all" ||
        isKnownTargetVar(trimmedTarget)
      ) {
        targetExpr =
          trimmedTarget === "all" ? JSON.stringify("all") : trimmedTarget;
      } else {
        targetExpr = JSON.stringify(trimmedTarget);
      }
    } else {
      // A non-identifier target (almost always a spawn call like
      // `instance_create_layer(...)`, already rewritten to a real
      // `GmlActions.*` call by an earlier pass) can carry a trailing `;`
      // that pass appended assuming standalone-statement context — real,
      // confirmed regression: a `with (instance_create_layer(...))` target
      // sits inside `with`'s own parens, never as its own statement, and a
      // stray `;` there would land *inside* `with_each`'s own argument
      // list, a hard SyntaxError. A with-target is always a pure
      // expression, so any trailing `;` is stripped.
      targetExpr = trimmedTarget.replace(/;\s*$/, "");
    }

    const rescopedBody = bodyText.replace(/(?<!\.\s*)\bother\b/g, "_other");
    const replacement = `{ const _withCaller = _entity; GmlActions.with_each(_ctx, ${targetExpr}, (_entity) => { const _other = _withCaller;\n${rescopedBody}\n}); }`;

    result += text.slice(lastIndex, m.index) + replacement;
    lastIndex = bodyEnd;
    withRe.lastIndex = lastIndex;
  }
  result += text.slice(lastIndex);
  return result;
}

/**
 * Pre-scans a single raw (untranspiled) GML event file for the names it
 * would identify as implicit instance variables, on its own. Real GameMaker
 * instance state routinely gets *set* in one event (Create) and only *read*
 * — never assigned — in another (Step): Freedom Backup's obj_camera sets
 * `cam`/`view_w_half`/`buff`/etc. once in Create and reads them every frame
 * in Step. Since `transpileGML` processes one event file per call (each
 * becomes its own generated function — gms2-codegen.ts), a name never
 * *assigned* within Step's own body text was invisible to Step's own
 * implicit-variable detection, no matter how many other events set it —
 * `gms2-codegen.ts` calls this once per sibling event file, unions the
 * results, and passes that whole-object set into every `transpileGML` call
 * for that object (its `knownImplicitVars` parameter) so a read-only
 * occurrence in any one event still resolves through `GmlInstanceVars`
 * instead of being left as a bare, undeclared (and hard-`ReferenceError`-
 * throwing) identifier.
 */
export function scanGmlImplicitVars(gml: string): Set<string> {
  return identifyGmlImplicitVars(gml);
}

/**
 * Apply regex-based pattern replacements to a GML source string and return
 * the resulting TypeScript snippet.
 *
 * Transformations are applied in order; later passes do not re-process text
 * produced by earlier ones (single-pass sequential replacement).
 *
 * `knownParams` are identifier names this call's *wrapping* function already
 * declares as real parameters — a real GML script's own named parameters
 * (`function scr_add(a, b) { ... }`, extracted separately by
 * `gms2-codegen.ts`'s `extractScriptSignature` before this function ever
 * sees the body text). Without this, the implicit-instance-variable pass
 * near the end of this function has no way to know `a`/`b` are already
 * real, already-scoped-correctly function parameters — not a GML instance's
 * own implicit field — and would incorrectly persist them through
 * `GmlActions.getGmlVar`/`setGmlVar` instead of leaving them as plain local
 * reads/writes.
 *
 * `knownImplicitVars` are names already known (via `scanGmlImplicitVars`
 * across an object's *other* event files) to be that object's own implicit
 * instance variables even if this specific call's own body never assigns
 * them — see that function's own doc comment for the real cross-event read
 * regression this closes. They're treated exactly like a name this body
 * assigns itself, except a real local `var`/`let`/`const` declaration (or a
 * `knownParams` entry) inside *this* body still takes precedence, the same
 * shadowing GML's own per-event `var` scoping already implies.
 *
 * `functionId` names the one generated function this specific call's body
 * will become (e.g. `"onUpdate"`, `"onCreate"`, a script's own name) —
 * used only to namespace this body's `static` declarations (see the
 * "GML `static` variables" rewrite pass below) so two different generated
 * functions in the same `.behavior.ts` module that each declare a
 * same-named static never collide in `GmlActions.gmlStatics`'s shared,
 * process-global store. Left at its default when a caller doesn't care
 * (a bare unit test of one static declaration, for instance).
 */
export function transpileGML(
  gml: string,
  knownParams: readonly string[] = [],
  knownImplicitVars: ReadonlySet<string> = new Set(),
  hasOtherParam = false,
  functionId = "fn",
): string {
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

  // GameMaker's `other` keyword — inside a Collision event, refers to the
  // *other* instance in the collision, a real, extremely common reference
  // (`other.hp -= dmg;`, `other.object_index`) previously left as a bare,
  // undeclared identifier with nowhere to resolve to. `gms2-codegen.ts`'s
  // collision-event codegen already gives every generated
  // `onCollideWith<Other>` function a real `_other: Entity` parameter (see
  // that function's own doc comment) — this pass is what actually makes
  // GML's bare `other` reference it, by threading `hasOtherParam` in only
  // for a collision event's own `readAndTranspileGML` call. Runs this early
  // (right after comment neutralisation) so every later identifier-
  // sensitive pass — in particular the implicit-instance-variable
  // detection near the end of this function — only ever sees the real
  // `_other` name, never a bare `other` it could misidentify as this
  // object's own implicit field.
  if (hasOtherParam) {
    out = out.replace(/(?<!\.\s*)\bother\b/g, "_other");
  }

  // -- GML `static` variables -------------------------------------------------
  // See CLAUDE.md's "GMS2.3+ syntax and array functions" entry for the full
  // design writeup and the real GameMaker semantics this confirms
  // (GameMaker manual + community docs on static-in-constructor-methods
  // and static-in-object-events): `static x = 0;` persists across every
  // call to the *one* function/method it's declared in — shared across
  // every call to a script function, shared across every instance calling
  // the same struct-constructor method, and shared across every instance
  // of an object using the same compiled event handler. `static` is only
  // valid JS syntax inside a `class` body, so it can't be emitted verbatim
  // — a bare `static x = 0;` inside a plain function is a hard
  // `SyntaxError` the moment the generated function actually runs.
  //
  // This rewrites each *top-level* `static <name> (= <expr>)?;`
  // declaration — one that sits directly in this call's own body, not
  // nested inside a further `function(...) { ... }` literal embedded in
  // it (a GML struct method's own local static, declared inline within
  // this event/script) — into a lazy-initialised slot in
  // `GmlActions.gmlStatics`, a real process-global, string-keyed store
  // (`compat/gmlActions.ts`) whose lifetime matches GameMaker's own
  // "persists for the life of the running game" semantic exactly. Every
  // bare reference to that name elsewhere in this same body is rewritten
  // to read/write the same slot. `functionId` (this call's own generated
  // function name) namespaces the slot key so two different generated
  // functions declaring a same-named static never collide.
  //
  // The nested case (a static inside a `function(...) { ... }` literal
  // embedded in this body) is deliberately left untouched — this
  // transpiler is regex/line-based, not a real parser, and correctly
  // scoping a rewrite to "only inside that one nested function literal,
  // not this call's outer body" needs real lexical scope tracking this
  // file doesn't have. Left unrewritten (still a genuine `SyntaxError` at
  // runtime), the same "surface as broken rather than fake it" precedent
  // `action_if_question`/`gml_pragma` already set — see CLAUDE.md for the
  // honest, narrower remaining gap this leaves.
  {
    // Mask string literals first — the same "protect literals during
    // regex-based rewriting" technique the implicit-instance-variable pass
    // below already uses, needed here too since a static's own name could
    // coincidentally appear inside an unrelated string literal elsewhere
    // in this body.
    const maskedStaticStrings: string[] = [];
    out = out.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, (mm) => {
      maskedStaticStrings.push(mm);
      return `\u0000GMLSTATICSTR${maskedStaticStrings.length - 1}\u0000`;
    });

    const funcDepthAt = buildFunctionDepthProbe(out);
    // name -> { placeholder, slot } — the placeholder (never a real GML
    // identifier, so it can't itself be caught by the bare-word passes
    // below) stands in for the real quoted slot key during every rewrite
    // pass, and is swapped for the real key text only once, at the very
    // end — exactly the "protect the replacement's own key text from the
    // next pass's own bare-word search" technique the implicit-instance-
    // variable pass further below already establishes (see its own doc
    // comment for the real regression this avoids: without it, a later
    // pass's `\bname\b` search would match back into the key text this
    // same loop just produced and corrupt it).
    const declaredStatics = new Map<
      string,
      { placeholder: string; slot: string }
    >();
    let staticOccurrence = 0;

    out = out.replace(
      /^([ \t]*)static\s+([A-Za-z_]\w*)\s*(=\s*([^;\n]+))?;[ \t]*$/gm,
      (
        whole: string,
        indent: string,
        name: string,
        _initClause,
        initExpr: string | undefined,
        offset: number,
      ) => {
        if (funcDepthAt(offset) > 0) return whole; // nested — honest gap, see above
        const slot = `${functionId}::${name}::${staticOccurrence}`;
        const placeholder = `__GML_STATIC_${staticOccurrence++}__`;
        declaredStatics.set(name, { placeholder, slot });
        const initText = initExpr !== undefined ? initExpr.trim() : "undefined";
        return `${indent}if (!(${placeholder} in GmlActions.gmlStatics)) { GmlActions.gmlStatics[${placeholder}] = ${initText}; }`;
      },
    );

    for (const [name, { placeholder }] of declaredStatics) {
      const esc = escapeRegExpTranspile(name);
      out = out.replace(
        new RegExp(`^(\\s*)${esc}\\s*(\\+\\+|--)`, "gm"),
        (_m, ind: string, op: string) =>
          `${ind}GmlActions.gmlStatics[${placeholder}] = ((GmlActions.gmlStatics[${placeholder}] as number | undefined) ?? 0) ${op === "++" ? "+" : "-"} 1;`,
      );
      out = out.replace(
        new RegExp(
          `^(\\s*)${esc}\\s*(\\+=|-=|\\*=|/=|%=)\\s*([^;\\n]+);?`,
          "gm",
        ),
        (_m, ind: string, op: string, exprRaw: string) => {
          const jsOp = op[0];
          return `${ind}GmlActions.gmlStatics[${placeholder}] = ((GmlActions.gmlStatics[${placeholder}] as number | undefined) ?? 0) ${jsOp} (${exprRaw.trim()});`;
        },
      );
      out = replacePlainAssignmentMultiline(
        out,
        name,
        (ind2, expr) =>
          `${ind2}GmlActions.gmlStatics[${placeholder}] = ${expr};`,
      );
      out = out.replace(
        new RegExp(`(?<!\\.\\s*)\\b${esc}\\b(?!\\s*=(?!=))`, "g"),
        `(GmlActions.gmlStatics[${placeholder}])`,
      );
    }

    for (const { placeholder, slot } of declaredStatics.values()) {
      out = out.split(placeholder).join(JSON.stringify(slot));
    }

    out = out.replace(
      /\u0000GMLSTATICSTR(\d+)\u0000/g,
      (_m, i: string) => maskedStaticStrings[Number(i)] ?? "",
    );
  }

  // -- Variable declarations -------------------------------------------------
  // global.x — GameMaker's arbitrary-named, arbitrary-typed cross-object
  // state, real GML source's single most common way to share state between
  // objects (confirmed real, extremely common: `global.kills++;`,
  // `global.hasgun == false`, `global.checkpoint = id;` — GameMaker itself
  // makes no syntactic distinction between "first declaration" and "later
  // reassignment", both are just `global.x = expr`). This used to become a
  // `/* TODO */` comment on the write side and an untouched (ReferenceError
  // in a browser, silently-wrong-via-Node's-own-`global`-object elsewhere)
  // bare identifier on the read side — a severe, real gap for one of GML's
  // most-used features, not a stylistic placeholder.
  //
  // Routes through `@emptysock/engine`'s real `GlobalStore` service
  // (`ctx.game?.globals` — see that class's own doc comment for why it's a
  // distinct service from `VariableStore`'s numbered, integer-only shape):
  // `_ctx.game?.globals.get("x")`/`.set("x", expr)`. `ctx.game` is already
  // optional in `GmlActionContext` (a project that never uses `global.`
  // doesn't need a `Game` wired at all), so every rewrite here is
  // optional-chained rather than assuming one.
  //
  // Order matters: increment/decrement first (the most specific shape),
  // then compound assignment, then plain assignment, then the generic bare
  // read last (a catch-all that must not fire before the more specific
  // write forms have already consumed their own occurrences).
  out = out.replace(
    /\bglobal\.(\w+)\s*(\+\+|--)/g,
    (_m, varName: string, op: string) =>
      `_ctx.game?.globals.set("${varName}", (_ctx.game?.globals.get("${varName}") ?? 0) ${op === "++" ? "+" : "-"} 1)`,
  );
  out = out.replace(
    /\bglobal\.(\w+)\s*(\+=|-=|\*=|\/=|%=)\s*([^;\n]+);?/g,
    (_m, varName: string, op: string, exprRaw: string) => {
      const jsOp = op[0];
      return `_ctx.game?.globals.set("${varName}", (_ctx.game?.globals.get("${varName}") ?? 0) ${jsOp} (${exprRaw.trim()}));`;
    },
  );
  out = out.replace(
    // `(?!=)` after the `=` keeps this from matching `global.x == y` (a
    // comparison, not an assignment) — without it, `global.x == y` matched
    // "assignment" starting at the first `=`, leaving the second `=` to be
    // swallowed into the captured right-hand-side text, producing garbled
    // output like `= = y`.
    /\bglobal\.(\w+)\s*=(?!=)\s*([^;\n]+);?/g,
    (_m, varName: string, expr: string) =>
      `_ctx.game?.globals.set("${varName}", ${expr.trim()});`,
  );
  // The generic bare-read catch-all — anything left after the three write
  // forms above have already consumed every assignment/increment shape.
  out = out.replace(
    /\bglobal\.(\w+)\b/g,
    (_m, varName: string) => `(_ctx.game?.globals.get("${varName}"))`,
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
  // hard JS/TS parse error, not just an unresolved identifier.
  //
  // Real, cross-file substitution now happens for real: `scanGmlMacros()`
  // (called once by `importGMS2Project`, before any file is transpiled)
  // walks every `.gml` file in the project and builds a real
  // `name -> value` map, installed via `setGmlMacros()`. Real, confirmed,
  // load-bearing shape: `#macro SAVEFILE "freedom.sav"` in one script,
  // referenced as a bare `SAVEFILE` identifier throughout the game's own
  // save/load system (`file_text_open_write(working_directory +
  // SAVEFILE)`) — leaving the definition as a TODO comment (the old
  // behaviour) meant `SAVEFILE` at every one of those *use* sites stayed a
  // genuinely undeclared bare identifier, a hard `ReferenceError`.
  //
  // The directive line itself still becomes a `//` comment (fixing its own
  // syntax error, and it's now purely informational — the value is already
  // known project-wide via `_macros`); every bare *use* of the name
  // elsewhere in this file is substituted with the macro's real value,
  // parenthesised so it drops safely into any expression context
  // (`working_directory + (SAVEFILE)`), guarded the same
  // `(?<!\.\s*)`/`(?<!\/\/[^\n]*)` way every other bare-identifier rewrite
  // in this file already is (a dotted reference to another instance's
  // field, or a `//` comment mentioning the name in prose, must not be
  // substituted).
  out = out.replace(
    /^([ \t]*)#macro\s+(\S+)\s+(.*)$/gm,
    (_m, indent: string, name: string, value: string) =>
      `${indent}// #macro ${name} ${value.trim()} — real value substituted at every use site below.`,
  );
  for (const [name, value] of _macros) {
    out = out.replace(
      new RegExp(`(?<!\\/\\/[^\\n]*)(?<!\\.\\s*)\\b${name}\\b`, "g"),
      `(${value})`,
    );
  }

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

  // -- GML built-ins → EmptySock / JS equivalents ---------------------------

  // Shared by `instance_create_layer`, `audio_play_sound`, and `room_goto`
  // below: a bare identifier argument (the overwhelmingly common real
  // shape for a GameMaker asset-name reference) is quoted into the exact
  // string literal the receiving `compat/gmlActions.ts` function expects;
  // anything else (a variable, a dotted reference, a sub-call like
  // `choose(...)`) is assumed to already evaluate to a real name string and
  // passed through unchanged — this importer has no way to resolve an
  // arbitrary runtime expression to an asset name ahead of time and
  // doesn't pretend to.
  const bareOrQuoted = (expr: string): string =>
    /^[A-Za-z_]\w*$/.test(expr) ? JSON.stringify(expr) : expr;

  // instance_create_layer — used to be a comment-only placeholder claiming
  // "TODO: scene.createEntity() and add ObjX component". A severe, real
  // gap, not a stylistic one: `instance_create_layer` is GML 2.3+'s real,
  // current spawning function — the single most common way a modern
  // GameMaker project spawns anything (confirmed: 10+ real call sites in
  // just one of this importer's real test projects — bullets, pickups,
  // transition effects, UI elements), and every one of those calls was
  // silently spawning nothing at all. Now threads into a real
  // `GmlActions.instance_create_layer` call (`compat/gmlActions.ts` — see
  // its own doc comment for why the `layer` argument is honestly dropped).
  //
  // GML allows this call to appear as a sub-expression, not just a
  // standalone statement — `my_gun = instance_create_layer(...)` (assigned)
  // and `with (instance_create_layer(...)) { ... }` (the `with`-pass above
  // already preserves this specific call as a real, executed statement
  // rather than discarding it) are both real, common shapes, so this
  // rewrite must stay valid in expression position too, not just as a
  // statement.
  //
  // The object-name argument (the 4th/last one) is resolved the same "bare
  // identifier -> quoted asset-name string" convention `sprite_index`'s own
  // bare-identifier rewrite already establishes — real, confirmed shape:
  // every real call site found passes a bare object name
  // (`instance_create_layer(x, y, "Bullets", obj_bullet_enemy)`), which
  // `action_create_object`'s `objectName: string` parameter needs quoted,
  // not left as an undeclared bare JS identifier (a `ReferenceError` at
  // runtime otherwise — the exact bug the generic `THREADED_ACTIONS` pass
  // would have produced here, since it has no such quoting logic; this is
  // why `instance_create_layer` gets its own pass instead of joining that
  // list). The `layer` argument (a real GML string literal at every
  // confirmed real call site, e.g. `"Bullets"`) is passed through
  // unchanged — `instance_create_layer`'s own doc comment explains why it's
  // honestly unused.
  out = out.replace(
    new RegExp(
      `\\binstance_create_layer\\s*\\((${BALANCED_PARENS_ONE_LEVEL})\\)(\\s*;)?`,
      "g",
    ),
    (_m, argsRaw: string, semi?: string) => {
      const args = splitTopLevelArgs(argsRaw, 4).map((a) => a.trim());
      const [x, y, layer, objectArg] = args;
      const objectName = bareOrQuoted(objectArg ?? "");
      return `GmlActions.instance_create_layer(_entity, _ctx, ${x}, ${y}, ${layer}, ${objectName})${semi ?? ";"}`;
    },
  );

  // audio_play_sound(snd, priority, loop) / room_goto(rm_next) — GML allows
  // either of these to be the sole (unbraced) body of an `if`/`else` with
  // no surrounding block: `if (cond) room_goto(rm_next);` is real, common
  // GML, which is exactly the shape both real rewrites below already
  // produce (a real call, still a valid single statement either way).
  // (`draw_sprite` used to be discussed in this same paragraph, back when
  // all three were comment-only placeholders — it now has its own real
  // rewrite further below, alongside `draw_rectangle`/`draw_text`/etc.,
  // since it threads through `_ctx.drawTarget` instead of `GmlActions`.)
  //
  // `audio_play_sound`/`room_goto` used to be comment-only placeholders
  // here — a severe, real gap, not a stylistic one: both are among the
  // single most common GameMaker calls in real projects (sound effects,
  // level/screen transitions — confirmed real usage: `audio_play_sound
  // (snd_Shot, 5, false)`, `room_goto(rm_gamefcat)`), and every real call
  // to either was silently doing nothing at all. Both now thread into real
  // `compat/gmlActions.ts` exports (`audio_play_sound`/`room_goto`,
  // aliasing `action_sound`/`action_another_room` respectively so the DnD
  // and function-call spellings of the same action can't drift apart).
  //
  // A bare identifier first argument (`audio_play_sound(snd_Shot, ...)`,
  // `room_goto(rm_gamefcat)` — the overwhelmingly common real shape) is
  // quoted into the exact string literal `ctx.sounds`/`ctx.rooms` are keyed
  // by, the same convention `timeline_index`'s bare-identifier rewrite
  // above already establishes. Anything else (a variable, `choose(...)`, a
  // dotted reference like `other.new_room`) is assumed to already evaluate
  // to a real name string and passed through unchanged — this importer has
  // no way to resolve an arbitrary runtime expression to an asset name
  // ahead of time and doesn't pretend to; `action_sound`/`action_another_
  // room`'s own existing "no live wiring, no match" guards handle an
  // unresolvable runtime value honestly (a console warning, not a crash).
  out = out.replace(
    new RegExp(
      `\\baudio_play_sound\\s*\\((${BALANCED_PARENS_ONE_LEVEL})\\)(\\s*;)?`,
      "g",
    ),
    (_m, argsRaw: string, semi?: string) => {
      const args = splitTopLevelArgs(argsRaw, 3).map((a) => a.trim());
      const soundArg = bareOrQuoted(args[0] ?? "");
      const rest = args.slice(1).filter((a) => a.length > 0);
      const threaded = [soundArg, ...rest].join(", ");
      return `GmlActions.audio_play_sound(_entity, _ctx, ${threaded})${semi ?? ";"}`;
    },
  );
  out = out.replace(
    new RegExp(
      `\\broom_goto\\s*\\((${BALANCED_PARENS_ONE_LEVEL})\\)(\\s*;)?`,
      "g",
    ),
    (_m, rm: string, semi?: string) =>
      `GmlActions.room_goto(_entity, _ctx, ${bareOrQuoted(rm.trim())})${semi ?? ";"}`,
  );
  // `draw_sprite` used to be an unconditional comment-only placeholder
  // ("Sprite component handles drawing declaratively") — true for the
  // narrow case of an object redrawing its own already-assigned sprite,
  // but wrong for real, confirmed usage: `draw_sprite(spr_marker, 0, x,
  // y)` draws a *different* sprite than the calling object's own
  // `sprite_index` (`obj_text`'s real `Draw_0.gml`), and `draw_sprite
  // (_image, 0, _drawX + _imageW / 2, _drawY + _imageH / 2)` draws a
  // dynamically-chosen image at a *custom* offset position, not the
  // entity's own transform (`oTextbox`'s real `Draw_64.gml`). Treating
  // every `draw_sprite` call as a no-op silently dropped real visual
  // content in both cases. The real rewrite lives further below, after the
  // `sprite_index`/`image_*` built-in section — see that rewrite's own doc
  // comment for why the ordering specifically matters here.

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
      `\\bdraw_set_colou?r\\s*\\((${BALANCED_PARENS_ONE_LEVEL})\\)\\s*;?`,
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
    "instance_destroy",
    "action_set_alarm",
    "action_sound",
    // `place_free`/`place_snapped`/`position_free` take no object-type
    // argument at all (`place_free` matches any `Meta.solid`-flagged
    // instance, `place_snapped` and `position_free` have no object concept
    // whatsoever — see CLAUDE.md's "GameMaker's hypothetical position
    // collision-query family" entry), so generic threading is correct and
    // sufficient for these three. Every *other* member of this family
    // (`place_meeting`, `position_meeting`, `instance_place`,
    // `instance_position`, `collision_*`, `instance_exists`,
    // `instance_number`) takes a real object-name argument and gets its own
    // dedicated pass below instead — see that pass's own doc comment for
    // why generic threading was a real, severe, previously-undiscovered bug
    // for those.
    "place_free",
    "place_snapped",
    "position_free",
    // GameMaker's real file_text_* family (compat/gmlFileText.ts) — every
    // argument here is a filename/handle/value, never an object-type
    // reference, so generic threading (no bare-identifier quoting) is
    // correct: a bare filename argument is either already a real string
    // literal (`file_text_open_read("lang.txt")`) or, after this pass's
    // own #macro substitution runs earlier in the pipeline, already a
    // quoted string too (`working_directory + ("freedom.sav")`).
    "file_exists",
    "file_delete",
    "file_text_open_read",
    "file_text_open_write",
    "file_text_open_append",
    "file_text_read_string",
    "file_text_read_real",
    "file_text_readln",
    "file_text_eof",
    "file_text_write_string",
    "file_text_write_real",
    "file_text_writeln",
    "file_text_close",
  ];
  for (const fn of THREADED_ACTIONS) {
    // The trailing `;` is captured, not just optionally consumed — DnD
    // actions (`action_move(...)`) are always their own statement and
    // always end in one, but `place_free`/`place_snapped`/`position_free`
    // are real GML *expression* syntax, just as commonly called as a
    // sub-expression inside `if (...)`, `&&`, or an assignment's right-hand
    // side, with no trailing `;` of its own at all. Unconditionally
    // appending `;` (the previous behaviour) corrupted exactly that case —
    // it injected a semicolon *inside* the enclosing `if (...)`'s parens,
    // e.g. `if (GmlActions.place_free(...);)`. Echoing back only the
    // semicolon (if any) this specific call actually had keeps both shapes
    // correct.
    //
    // The argument capture tolerates two levels of nested parens
    // (`BALANCED_PARENS_TWO_LEVELS`), not a bare `[^)]*` — real, confirmed
    // regression: after `#macro` substitution (above) replaces a bare
    // macro-name argument with its real, parenthesised value
    // (`file_text_open_write(working_directory + SAVEFILE)` becomes
    // `file_text_open_write(working_directory + ("freedom.sav"))`), a
    // `[^)]*` capture stopped at that nested `)`, leaving the real outer
    // `)` dangling — the exact same class of bug already fixed for
    // `show_message`/`repeat` elsewhere in this file, newly triggered here
    // by macro substitution's own output shape.
    const re = new RegExp(
      `\\b${fn}\\s*\\((${BALANCED_PARENS_TWO_LEVELS})\\)(\\s*;)?`,
      "g",
    );
    out = out.replace(re, (_m, args: string, semi: string | undefined) => {
      const trimmed = args.trim();
      const threaded =
        trimmed.length > 0 ? `_entity, _ctx, ${trimmed}` : "_entity, _ctx";
      return `GmlActions.${fn}(${threaded})${semi ?? ""}`;
    });
  }

  // GameMaker's real camera/view function family (compat/gmlCamera.ts) —
  // confirmed a real, previously-untranspiled gap against Freedom Backup's
  // own obj_camera (a real GML camera-follow controller: cam =
  // view_camera[0]; view_w_half = camera_get_view_width(cam); ...
  // camera_set_view_pos(cam, ...)). None of these are entity-affecting —
  // GameMaker's camera/view state is room-global, not per-instance — so
  // every one of `compat/gmlCamera.ts`'s real exported functions takes only
  // `(ctx, ...)`, never `(entity, ctx, ...)`, the same shape
  // `camera_get_active`/`camera_get_view_x` etc. already declare.
  // `GmlCameraContext extends GmlActionContext` with only optional fields
  // added, so passing the generated function's own `_ctx: GmlActionContext`
  // straight through type-checks with no cast needed.
  const THREADED_CTX_ONLY = [
    "camera_create",
    "camera_create_view",
    "camera_destroy",
    "camera_get_active",
    "camera_get_view_x",
    "camera_get_view_y",
    "camera_get_view_width",
    "camera_get_view_height",
    "camera_get_view_angle",
    "camera_get_view_speed_x",
    "camera_get_view_speed_y",
    "camera_set_view_pos",
    "camera_set_view_size",
    "camera_set_view_angle",
    "camera_set_view_speed",
    "view_get_camera",
    "view_set_camera",
    "view_get_visible",
    "view_set_visible",
    "view_get_enabled",
    "view_set_enabled",
    "view_get_xport",
    "view_set_xport",
    "view_get_yport",
    "view_set_yport",
    "view_get_wport",
    "view_set_wport",
    "view_get_hport",
    "view_set_hport",
    // GameMaker's real keyboard/gamepad/mouse polling functions
    // (compat/gmlInput.ts) — real, confirmed high-value gap: none of these
    // were wired anywhere despite `keyboard_check`/`keyboard_check_pressed`
    // being GameMaker's single most common input idiom (confirmed against
    // Freedom Backup's own `scr_get_input.gml`). Context-only, like the
    // camera/view family above — keyboard/gamepad/mouse state is
    // game-global, never per-instance, so there is no `_entity` to thread.
    "keyboard_check",
    "keyboard_check_pressed",
    "keyboard_check_released",
    "gamepad_is_connected",
    "gamepad_button_check",
    "gamepad_button_check_pressed",
    "gamepad_axis_value",
    "gamepad_set_axis_deadzone",
    "mouse_check_button_pressed",
    "display_get_gui_width",
    "display_get_gui_height",
    "surface_get_width",
    "surface_get_height",
    // GMS2.3+ `layer_sequence_create(layer, x, y, sequence)`
    // (compat/gmlSequences.ts) — see CLAUDE.md's "GmsProjectRuntime" entry's
    // `sequence_index` research: this is the one real GML source shape a
    // Sequence-driven entity is spawned from. Context-only, like the
    // camera/view family above — it spawns a *new* entity rather than
    // acting on the calling one, so there's no `_entity` for it to receive.
    "layer_sequence_create",
  ];
  for (const fn of THREADED_CTX_ONLY) {
    const re = new RegExp(
      `\\b${fn}\\s*\\((${BALANCED_PARENS_TWO_LEVELS})\\)(\\s*;)?`,
      "g",
    );
    out = out.replace(re, (_m, args: string, semi: string | undefined) => {
      const trimmed = args.trim();
      const threaded = trimmed.length > 0 ? `_ctx, ${trimmed}` : "_ctx";
      return `GmlActions.${fn}(${threaded})${semi ?? ""}`;
    });
  }

  // GameMaker's real, fixed colour-constant palette (compat/gml.ts's
  // c_white/c_black/etc. — see that module's own doc comment) — confirmed a
  // real, common gap: Freedom Backup alone uses c_white/c_black/c_gray
  // roughly 48 times across 20 files, every one a bare, undeclared
  // identifier (a hard ReferenceError at runtime) since nothing recognised
  // GML's colour-constant family at all. A plain `\bname\b` → `GmlActions.
  // name` rewrite is all these need — they're pure values, not calls, and
  // (unlike an object-type-name argument) never need quoting.
  const GML_COLOUR_CONSTANTS = [
    "c_aqua",
    "c_black",
    "c_blue",
    "c_dkgray",
    "c_fuchsia",
    "c_gray",
    "c_green",
    "c_lime",
    "c_ltgray",
    "c_maroon",
    "c_navy",
    "c_olive",
    "c_orange",
    "c_purple",
    "c_red",
    "c_silver",
    "c_teal",
    "c_white",
    "c_yellow",
  ];
  for (const name of GML_COLOUR_CONSTANTS) {
    out = out.replace(
      new RegExp(`(?<!\\.\\s*)\\b${name}\\b`, "g"),
      `GmlActions.${name}`,
    );
  }

  // GameMaker's `vk_*`/`gp_*`/`mb_*` input constants (compat/gmlInput.ts) —
  // same "plain value, not a call" rewrite `GML_COLOUR_CONSTANTS` above
  // already uses, plus `application_surface` (compat/gmlInput.ts's honest
  // sentinel — see that export's own doc comment).
  const GML_INPUT_CONSTANTS = [
    "vk_backspace",
    "vk_tab",
    "vk_enter",
    "vk_shift",
    "vk_control",
    "vk_alt",
    "vk_escape",
    "vk_space",
    "vk_pageup",
    "vk_pagedown",
    "vk_end",
    "vk_home",
    "vk_left",
    "vk_up",
    "vk_right",
    "vk_down",
    "vk_insert",
    "vk_delete",
    "vk_nokey",
    "vk_anykey",
    "gp_face1",
    "gp_face2",
    "gp_face3",
    "gp_face4",
    "gp_shoulderl",
    "gp_shoulderr",
    "gp_shoulderlb",
    "gp_shoulderrb",
    "gp_select",
    "gp_start",
    "gp_stickl",
    "gp_stickr",
    "gp_padu",
    "gp_padd",
    "gp_padl",
    "gp_padr",
    "gp_axislh",
    "gp_axislv",
    "gp_axisrh",
    "gp_axisrv",
    "mb_left",
    "mb_right",
    "mb_middle",
    "mb_none",
    "mb_any",
    "application_surface",
  ];
  for (const name of GML_INPUT_CONSTANTS) {
    out = out.replace(
      new RegExp(`(?<!\\.\\s*)\\b${name}\\b`, "g"),
      `GmlActions.${name}`,
    );
  }

  // Pure, non-entity GML built-in functions (compat/gml.ts) that were fully
  // implemented and exported but never actually wired into this transpiler
  // at all — a real, confirmed, severe gap: `sign`/`random_range`/`choose`/
  // `lengthdir_x`/`lengthdir_y`/`point_distance`/`degtorad` etc. are
  // genuinely common in real GML (confirmed against Freedom Backup's own
  // obj_camera: `random_range(-shake_remain, shake_remain)`, `sign(hsp)`),
  // and every one of them was left as a bare, undeclared identifier. These
  // take no `_entity`/`_ctx` (they're pure value functions, not
  // entity-affecting actions) and no argument needs object-type-name
  // quoting, so a plain `\bname\s*(\s*args\s*)` → `GmlActions.name(args)`
  // rewrite is correct and sufficient — the same shape `THREADED_CTX_ONLY`
  // above uses, minus the injected first argument.
  const THREADED_PURE_FUNCTIONS = [
    "sign",
    "lerp",
    "frac",
    "lengthdir_x",
    "lengthdir_y",
    "point_distance",
    "point_direction",
    "degtorad",
    "radtodeg",
    "irandom",
    "random",
    "random_range",
    "choose",
    "string",
    "string_copy",
    "string_pos",
    "string_lower",
    "string_upper",
    "string_repeat",
    "string_delete",
    "game_end",
    "object_exists",
    "asset_get_index",
    "array_length_1d",
    "array_length",
    "array_create",
    "array_resize",
    "array_push",
    "array_pop",
    "array_insert",
    "array_delete",
    "array_sort",
    "array_contains",
    "array_map",
    "array_filter",
    "array_reduce",
    "string_char_at",
    "keyboard_wait",
    "mouse_button_down",
    "mouse_button_released",
    "place_empty",
    // Real, confirmed gap: `max`/`min`/`ord` — GameMaker's own variadic
    // math built-ins and char-code idiom, thin wrappers over `Math.max`/
    // `Math.min`/`String.codePointAt` (compat/gml.ts) that were never
    // wired into this transpiler at all. `abs` is deliberately *not*
    // listed here — a separate, pre-existing pass earlier in this
    // function already rewrites `abs(expr)` straight to `Math.abs(expr)`
    // (confirmed by reading this file), so adding it here would be dead,
    // never-reached code.
    "max",
    "min",
    "ord",
  ];
  for (const fn of THREADED_PURE_FUNCTIONS) {
    out = out.replace(
      new RegExp(
        `(?<!\\.\\s*)\\b${fn}\\s*\\((${BALANCED_PARENS_TWO_LEVELS})\\)`,
        "g",
      ),
      (_m, args: string) => `GmlActions.${fn}(${args})`,
    );
  }

  // GameMaker's real `room_width`/`room_height` built-in read-only
  // variables (compat/gml.ts's `room_width()`/`room_height()`) — a real,
  // confirmed gap: both were fully implemented and exported but never
  // wired into this transpiler at all, and real GML source uses them as
  // bare identifiers with no parentheses (`random(room_width)`,
  // `surface_create(room_width, room_height)` — both real shapes already
  // named, as examples, in this file's own earlier comments about other
  // passes, which is what surfaced this gap). Rewritten to a call, the same
  // "bare read -> function call" shape `depth`'s/`image_blend`'s own
  // bare-read rewrites already use.
  out = out.replace(
    /(?<!\.\s*)\broom_width\b(?!\s*\()/g,
    "GmlActions.room_width()",
  );
  out = out.replace(
    /(?<!\.\s*)\broom_height\b(?!\s*\()/g,
    "GmlActions.room_height()",
  );

  // GameMaker's bare `room` built-in read (compat/gmlActions.ts's `room()`)
  // — real, confirmed gap: real GML source almost always compares it
  // against a bare room-name identifier (`if (room == rm_menu) { ... }`,
  // GameMaker's own idiom) rather than calling a function. Guarded the
  // same way `room_width`/`room_height` are against a real call-site
  // spelling (`room()`, unlikely but possible) so this pass only ever
  // rewrites the bare-identifier form.
  out = out.replace(
    /(?<!\/\/[^\n]*)(?<!\.\s*)\broom\b(?!\s*\()/g,
    "GmlActions.room(_ctx)",
  );

  // GameMaker's legacy `d3d_*` pseudo-3D projection compat
  // (compat/gmlProjection.ts) — real, confirmed gap: every one of these was
  // fully implemented (writing four corners onto `Projection3D`, consumed
  // by `RenderPipeline`'s real `PerspectiveMesh` sprite-sync — see
  // CLAUDE.md's "Pseudo-3D projection" entry) and exported from
  // `@emptysock/engine`, but never referenced anywhere in this transpiler,
  // so a real GML object using `d3d_transform_set_translation`/
  // `d3d_set_projection_ortho`/etc. would generate an unresolved-identifier
  // ReferenceError at runtime despite the feature being fully built.
  // Every one of these functions takes only `(entity, ...)` — GameMaker's
  // real `d3d_transform_set_*`/`d3d_set_projection_*` calls affect the
  // *calling instance's own* transform, never a room-global or ctx-scoped
  // concept the way `camera_*`/`view_*` are — so this threads `_entity`
  // alone, never `_ctx`, the one new threading shape this pass needed.
  const THREADED_ENTITY_ONLY = [
    "d3d_set_projection_ortho",
    "d3d_set_projection_perspective",
    "d3d_transform_set_identity",
    "d3d_transform_set_translation",
    "d3d_transform_set_rotation_z",
    "d3d_transform_set_rotation_x",
    "d3d_transform_set_rotation_y",
    "d3d_transform_set_scaling",
    "d3d_transform_clear",
  ];
  for (const fn of THREADED_ENTITY_ONLY) {
    const re = new RegExp(
      `\\b${fn}\\s*\\((${BALANCED_PARENS_TWO_LEVELS})\\)(\\s*;)?`,
      "g",
    );
    out = out.replace(re, (_m, args: string, semi: string | undefined) => {
      const trimmed = args.trim();
      const threaded = trimmed.length > 0 ? `_entity, ${trimmed}` : "_entity";
      return `GmlActions.${fn}(${threaded})${semi ?? ""}`;
    });
  }

  // GameMaker's real particle-function family (compat/gmlParticles.ts) —
  // another real, confirmed gap of the exact same "fully implemented,
  // never wired" shape as the `d3d_*` family just above: every
  // `part_type_*`/`part_system_*`/`part_particles_*` function is a real,
  // tested compat implementation (see `RenderPipelineParticles.test.ts`/
  // `gmlParticles.test.ts`), but none were ever referenced by this
  // transpiler, so a real GameMaker action/platformer object's particle
  // effects (an extremely common real-GML pattern — explosion bursts,
  // footstep dust, muzzle flashes) would fail with unresolved-identifier
  // errors at runtime. GameMaker's own particle API is handle-based, not
  // tied to any specific instance (a `part_type_*ind*` or `part_system_*ind*`
  // handle is a plain number, passed around freely, often stored in a
  // global/controller object rather than `self`), so — unlike `d3d_*` —
  // none of these take `_entity` at all. They split into two threading
  // shapes depending on whether the real function needs `ctx.particles` to
  // actually mount an emitter (`GmlParticleContext extends
  // GmlActionContext`, so passing this generated function's own
  // `_ctx: GmlActionContext` straight through type-checks with no cast
  // needed, the same shape `GmlCameraContext` already established):
  const PARTICLE_CTX_FIRST = [
    "part_system_destroy",
    "part_particles_create",
    "part_particles_create_colour",
    "part_particles_create_color",
  ];
  for (const fn of PARTICLE_CTX_FIRST) {
    const re = new RegExp(
      `\\b${fn}\\s*\\((${BALANCED_PARENS_TWO_LEVELS})\\)(\\s*;)?`,
      "g",
    );
    out = out.replace(re, (_m, args: string, semi: string | undefined) => {
      const trimmed = args.trim();
      const threaded = trimmed.length > 0 ? `_ctx, ${trimmed}` : "_ctx";
      return `GmlActions.${fn}(${threaded})${semi ?? ""}`;
    });
  }
  // The rest take no context at all — plain value/handle functions, the
  // same shape `THREADED_PURE_FUNCTIONS` above uses.
  const PARTICLE_PURE = [
    "part_type_create",
    "part_type_destroy",
    "part_type_exists",
    "part_type_clear",
    "part_type_shape",
    "part_type_sprite",
    "part_type_size",
    "part_type_colour1",
    "part_type_color1",
    "part_type_colour2",
    "part_type_color2",
    "part_type_colour3",
    "part_type_color3",
    "part_type_alpha1",
    "part_type_alpha2",
    "part_type_alpha3",
    "part_type_speed",
    "part_type_direction",
    "part_type_blend",
    "part_type_gravity",
    "part_type_life",
    "part_system_create",
    "part_system_exists",
    "part_system_position",
    "part_system_depth",
    "part_particles_clear",
  ];
  for (const fn of PARTICLE_PURE) {
    out = out.replace(
      new RegExp(
        `(?<!\\.\\s*)\\b${fn}\\s*\\((${BALANCED_PARENS_TWO_LEVELS})\\)`,
        "g",
      ),
      (_m, args: string) => `GmlActions.${fn}(${args})`,
    );
  }

  // GameMaker's `view_camera[idx]`/`view_visible[idx]`/etc. built-in array
  // variables (as opposed to the function-call twins just above, which
  // handle an explicit `view_get_camera(idx)`/`view_set_camera(idx, v)`
  // call) — real GML source overwhelmingly uses the array-subscript form
  // (confirmed: Freedom Backup's obj_camera reads `view_camera[0]`, never
  // `view_get_camera(0)`). `view_visible`/`view_enabled`/`view_xport`/
  // `view_yport`/`view_wport`/`view_hport` are GameMaker's other real
  // `view_*[idx]` built-in arrays, given the identical treatment for the
  // same reason. A write (`view_camera[idx] = v;`) routes to the setter
  // twin; a bare read routes to the getter twin — mirroring exactly how
  // `image_blend`/`depth` etc. already split write vs. read above.
  const VIEW_ARRAYS: Record<string, string> = {
    view_camera: "camera",
    view_visible: "visible",
    view_xport: "xport",
    view_yport: "yport",
    view_wport: "wport",
    view_hport: "hport",
  };
  for (const [arrayName, suffix] of Object.entries(VIEW_ARRAYS)) {
    out = out.replace(
      new RegExp(
        `(?<!\\.\\s*)\\b${arrayName}\\[(${BALANCED_PARENS_ONE_LEVEL})\\]\\s*=(?!=)\\s*([^;\\n]+);?`,
        "g",
      ),
      (_m, idx: string, expr: string) =>
        `GmlActions.view_set_${suffix}(_ctx, ${idx.trim()}, ${expr.trim()});`,
    );
    out = out.replace(
      new RegExp(
        `(?<!\\.\\s*)\\b${arrayName}\\[(${BALANCED_PARENS_ONE_LEVEL})\\]`,
        "g",
      ),
      (_m, idx: string) => `GmlActions.view_get_${suffix}(_ctx, ${idx.trim()})`,
    );
  }

  // The rest of GameMaker's object-type-taking collision-query family
  // (`place_meeting`/`position_meeting`/`instance_place`/`instance_position`
  // /`collision_*`) plus `instance_exists`/`instance_number` — a real,
  // severe, previously-undiscovered bug: generic `THREADED_ACTIONS`
  // threading has no bare-identifier-to-quoted-string logic at all, so
  // every one of these calls' object-name argument (almost always a bare
  // asset identifier in real source — `place_meeting(x, y, obj_wall)`) was
  // passed straight through as an *undeclared bare JS identifier*, not the
  // string `GmlObjectRef` these functions actually expect. Confirmed by
  // reading real generated output: `GmlActions.place_meeting(_entity, _ctx,
  // x, y, obj_wall)` — a hard `ReferenceError: obj_wall is not defined` at
  // runtime, for the exact solid-wall-collision mechanism CLAUDE.md's own
  // "GameMaker's hypothetical position collision-query family" entry calls
  // out as "THE mechanism a huge fraction of real GameMaker platformers/
  // top-down games use." This was never caught earlier because nothing
  // previously exercised these functions against real, unquoted-identifier
  // GML source — only synthetic fixtures that happened to already pass a
  // quoted string.
  //
  // Each function's object-argument position is fixed but differs by
  // function (`OBJ_ARG_INDEX`, 0-based among the function's own GML-visible
  // arguments) — `collision_*`'s shape is `(..., obj, prec, notme)`, the
  // rest are `(..., obj)` or, for `instance_exists`/`instance_number`,
  // `(obj)` alone — so this can't be one fixed-position rule the way
  // `image_xscale`'s always-first-argument rewrite can be; a small map
  // drives it instead. Args are split with `splitTopLevelArgs` (comma-
  // aware of nested calls, e.g. `place_meeting(x + lengthdir_x(4, dir), y,
  // obj_wall)`) and only the object-argument index is passed through
  // `bareOrQuoted` — every other argument (including `prec`/`notme`, which
  // are already real booleans in source) is left exactly as written.
  const OBJ_ARG_INDEX: Record<string, number> = {
    place_meeting: 2,
    position_meeting: 2,
    instance_place: 2,
    instance_position: 2,
    collision_rectangle: 4,
    collision_circle: 3,
    collision_line: 4,
    collision_point: 2,
    instance_exists: 0,
    instance_number: 0,
  };
  // Real, confirmed bug: `bareOrQuoted` above always quotes a bare
  // identifier into an object-*type*-name string — correct for
  // `place_meeting(x, y, obj_wall)`, but this same argument position can
  // equally hold a real GML variable that *references* a live instance
  // (`follow = obj_player;` earlier, then `instance_exists(follow)` later —
  // Freedom Backup's own obj_camera). A known implicit-instance-variable
  // name (this event's own, or another sibling event's via
  // `knownImplicitVars`/`scanGmlImplicitVars`) is left bare instead of
  // quoted, so it resolves through `GmlInstanceVars` like any other
  // instance-variable read rather than being coerced into a literal object-
  // type-name string that happens to share the variable's spelling.
  const knownVarsForObjArgs = new Set(
    identifyGmlImplicitVars(out, new Set(knownParams)),
  );
  for (const name of knownImplicitVars) knownVarsForObjArgs.add(name);
  const bareOrQuotedUnlessVar = (expr: string): string =>
    /^[A-Za-z_]\w*$/.test(expr) && knownVarsForObjArgs.has(expr)
      ? expr
      : bareOrQuoted(expr);
  for (const [fn, objIndex] of Object.entries(OBJ_ARG_INDEX)) {
    const re = new RegExp(
      `\\b${fn}\\s*\\((${BALANCED_PARENS_TWO_LEVELS})\\)(\\s*;)?`,
      "g",
    );
    out = out.replace(re, (_m, argsRaw: string, semi: string | undefined) => {
      // `maxParts` generously covers every real argument this family can
      // have (`collision_*`'s longest real shape is 7: x1,y1,x2,y2,obj,
      // prec,notme) — too few parts would let the object-argument split
      // absorb trailing `prec`/`notme` text into itself instead of leaving
      // them as their own, separately-quotable-or-passthrough arguments.
      const args = splitTopLevelArgs(argsRaw, 10).map((a) => a.trim());
      if (args[objIndex] !== undefined && args[objIndex].length > 0) {
        args[objIndex] = bareOrQuotedUnlessVar(args[objIndex]);
      }
      const threaded = args.filter((a) => a.length > 0);
      return `GmlActions.${fn}(_entity, _ctx${threaded.length > 0 ? ", " : ""}${threaded.join(", ")})${semi ?? ""}`;
    });
  }

  // Real `with (target) { body }` support (see `rewriteWithStatements`'s own
  // doc comment) — deliberately placed after every GML-builtin rewrite pass
  // above (instance_create_layer, place_meeting/instance_exists/etc.), so a
  // spawn-call target like `with (instance_create_layer(...))` is already
  // the real `GmlActions.instance_create_layer(...)` call by the time this
  // runs, and a variable-vs-object-type-name target decision can reuse the
  // exact same `knownVarsForObjArgs` set/logic `bareOrQuotedUnlessVar`
  // above already established.
  out = rewriteWithStatements(out, (name) => knownVarsForObjArgs.has(name));

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
  // Compound-assignment forms (`timeline_speed += 0.1;`) are just as real
  // as plain `=` for a numeric field like this — the operator capture group
  // (`OP`, reused by every rendering-built-in write-pass below) lets the
  // emitted code use the exact same operator rather than only ever
  // supporting `=`. Real, confirmed regression this pattern fixes: a plain
  // `=`-only write regex left `+=`/`-=`/etc. completely unmatched, so the
  // *read*-side bare-identifier pass below matched instead — turning
  // `image_yscale += x;` (a real, confirmed shape from a real project's
  // `obj_playerw`'s `Step_0.gml`) into `(_entity.get(...)?.scaleY ?? 1) +=
  // x;`, a hard SyntaxError (the left side of `+=` must be a real
  // assignment target, not an arbitrary expression).
  const OP = "(?:\\+=|-=|\\*=|/=|%=|=(?!=))";
  out = out.replace(
    new RegExp(
      `(?<!\\/\\/[^\\n]*)(?<!\\.\\s*)\\btimeline_(running|speed|loop|position)\\s*(${OP})\\s*([^;\\n]+);?`,
      "g",
    ),
    (_m, field: string, op: string, exprRaw: string) =>
      `(() => { const _tl = _entity.get(GmlActions.TimelineState); if (_tl) _tl.${field} ${op} ${exprRaw.trim()}; })();`,
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
  // `+=`/`-=` add/subtract a *degree* delta — converting that same delta to
  // radians and applying it with the identical `+=`/`-=` operator is exact,
  // the same reasoning the plain-`=` case above already uses. `*=`/`/=` are
  // deliberately NOT given the same treatment: GML's `image_angle *= 2`
  // means "scale my current angle value by a unitless factor," but scaling
  // `Transform.rotation` (already in radians) by `(expr) * Math.PI / 180`
  // would incorrectly also apply the degrees-to-radians conversion factor
  // to what should be a plain multiplier — a real, distinct formula this
  // pass doesn't have a confirmed real-source example to derive/verify
  // against yet, so it's left as an honest gap (falls through to the
  // bare-read rewrite below) rather than guessed at.
  out = out.replace(
    /(?<!\/\/[^\n]*)(?<!\.\s*)\bimage_angle\s*(\+=|-=)\s*([^;\n]+);?/g,
    (_m, op: string, exprRaw: string) =>
      `(() => { const _t = _entity.get(GmlActions.Transform); if (_t) _t.rotation ${op} (${exprRaw.trim()}) * Math.PI / 180; })();`,
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
    // `OP` (defined above, next to the `timeline_*` compound-assignment
    // fix) covers every real GML assignment operator, not just plain `=` —
    // `image_xscale`/`image_yscale` have no unit conversion at all, so the
    // exact same operator can be applied directly to `Transform.scaleX`/
    // `.scaleY` with no further translation needed.
    const writeRe = new RegExp(
      `(?<!\\/\\/[^\\n]*)(?<!\\.\\s*)\\b${gmlName}\\s*(${OP})\\s*([^;\\n]+);?`,
      "g",
    );
    out = out.replace(
      writeRe,
      (_m, op: string, exprRaw: string) =>
        `(() => { const _t = _entity.get(GmlActions.Transform); if (_t) _t.${field} ${op} ${exprRaw.trim()}; })();`,
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
  // GameMaker's "fully opaque"). No unit conversion, so — like
  // `image_xscale`/`image_yscale` above — every real assignment operator
  // (`OP`) applies directly with no further translation.
  out = out.replace(
    new RegExp(
      `(?<!\\/\\/[^\\n]*)(?<!\\.\\s*)\\bimage_alpha\\s*(${OP})\\s*([^;\\n]+);?`,
      "g",
    ),
    (_m, op: string, exprRaw: string) =>
      `(() => { const _sp = _entity.get(GmlActions.Sprite); if (_sp) _sp.alpha ${op} ${exprRaw.trim()}; })();`,
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
  // Compound assignment (`depth += 5;`) needs its own formula, not just the
  // plain-`=` one with the operator swapped in: the sign flip means GML's
  // `+=` doesn't become this engine's `+=` on the stored field — it becomes
  // a `-=` (`gmlDepth_new = gmlDepth_old + 5` implies `engineDepth_new =
  // -(gmlDepth_old + 5) = -gmlDepth_old - 5 = engineDepth_old - 5`).
  // Rather than hand-deriving the flipped operator for each of `+=`/`-=`/
  // `*=`/`/=`/`%=` (multiplication/division don't even flip the same way
  // addition/subtraction do), this reads the field back through the exact
  // same un-flip the read-side rewrite below already applies, performs the
  // compound update in GML's own sign convention, then re-applies the exact
  // same flip the plain-`=` write above uses — correct for every operator
  // by construction, since it's built entirely out of already-correct,
  // already-tested single-direction conversions rather than a new one.
  out = out.replace(
    new RegExp(
      `(?<!\\/\\/[^\\n]*)(?<!\\.\\s*)\\bdepth\\s*(\\+=|-=|\\*=|/=|%=)\\s*([^;\\n]+);?`,
      "g",
    ),
    (_m, op: string, exprRaw: string) =>
      `(() => { const _sp = _entity.get(GmlActions.Sprite); if (_sp) { const _gmlDepth = -(_sp.depth ?? 0); _sp.depth = -(_gmlDepth ${op} (${exprRaw.trim()})); } })();`,
  );
  out = out.replace(
    /(?<!\/\/[^\n]*)(?<!\.\s*)\bdepth\b/g,
    `(-(_entity.get(GmlActions.Sprite)?.depth ?? 0))`,
  );

  // draw_sprite(sprite, subimg, x, y) — GameMaker's own argument order. The
  // sprite argument is resolved the same "bare identifier -> quoted texture
  // path" convention `sprite_index`'s own bare-identifier rewrite already
  // establishes (`./assets/sprites/<name>/frame_0.png`), so a `draw_sprite`
  // call naming a real converted sprite asset draws the same texture that
  // sprite's own `.prefab.json`/`sprite_index` assignment would. `subimg`
  // is dropped — see `GmlDrawTarget.sprite`'s own doc comment in
  // `@emptysock/engine`'s `compat/gml.ts` for why (this importer only ever
  // converts a sprite's first frame, the same already-documented
  // `image_index`/`image_speed` gap).
  //
  // This pass runs *after* the whole `sprite_index`/`image_*` built-in
  // section above, not alongside `draw_rectangle`/`draw_circle`/`draw_text`
  // (which don't need this ordering) — deliberately: a real, confirmed
  // regression from `obj_transition`'s real `Draw_64.gml`, `draw_sprite
  // (sprite_index, image_index, xx, yy)` (a real, common "redraw my own
  // current sprite at a custom position" idiom), had its `sprite_index`
  // *argument* wrongly bare-identifier-quoted into a literal asset path
  // (`"./assets/sprites/sprite_index/frame_0.png"`) when this pass ran
  // *before* `sprite_index`'s own rewrite — and then `sprite_index`'s own
  // bare-read rewrite, running after, matched that same substring *again*
  // inside the already-emitted string literal, corrupting it a second
  // time. Running after `sprite_index`'s own rewrite has already turned a
  // bare `sprite_index` read into its real `_entity.get(GmlActions.Sprite)
  // ?.texturePath ?? ""` expression means this pass's own bare-identifier
  // check no longer matches it at all — it falls through to the "already a
  // real expression, pass through unchanged" branch, correctly.
  out = out.replace(
    new RegExp(
      `\\bdraw_sprite\\s*\\((${BALANCED_PARENS_TWO_LEVELS})\\)\\s*;?`,
      "g",
    ),
    (_m, args: string) => {
      const [spriteArg, , x, y] = splitTopLevelArgs(args, 4);
      const texturePath = /^[A-Za-z_]\w*$/.test((spriteArg ?? "").trim())
        ? `"./assets/sprites/${(spriteArg ?? "").trim()}/frame_0.png"`
        : (spriteArg ?? "").trim();
      return `_ctx.drawTarget?.sprite(${texturePath}, ${x}, ${y});`;
    },
  );

  // -- GameMaker's built-in per-instance position variables: x / y --------
  //
  // Real, confirmed the single highest-frequency unresolved-identifier gap
  // in this transpiler: a real full-project `tsc --noEmit` sweep against
  // Freedom Backup's regenerated output showed `x`/`y` as by far the most
  // common `TS2304: Cannot find name` (dozens of occurrences each,
  // concentrated in `obj_player`'s movement code — `x += hsp_final;`,
  // `place_meeting(_entity, _ctx, x, y + 1, "obj_wall")`, etc.). `x`/`y` are
  // GameMaker's own most fundamental per-instance built-ins — every
  // instance's position — and map directly onto this engine's existing
  // `Transform.x`/`Transform.y` fields (`components/Transform.ts`), the same
  // component `image_angle`/`image_xscale`/`image_yscale` above already
  // target for the *other* transform-shaped built-ins.
  //
  // These were never caught by the generic "auto-declare on first bare
  // assignment" pass below (`identifyGmlImplicitVars`) for a real, distinct
  // reason: that pass's own `bareAssign` regex only recognises a *plain*
  // `name = expr;` assignment as the signal that a name is implicitly
  // GML-instance-scoped — it has no compound-assignment (`+=`/`-=`/etc.)
  // detection at all. Real GameMaker movement code overwhelmingly writes
  // position via `x += hsp;`, never a plain `x = ...;`, so `x`/`y` were
  // never even added to that pass's `implicitVars` set in the first place,
  // let alone rewritten — confirmed by reading a real generated
  // `obj_player.behavior.ts`: every `x`/`y` occurrence appears completely
  // untouched, a raw, unresolved bare identifier. Even where a project does
  // write a plain `x = ...;` somewhere, routing `x`/`y` through the generic
  // `GmlActions.getGmlVar`/`setGmlVar` per-`(World, eid)`-keyed string side-
  // table (rather than `Transform.x`/`.y` directly) would silently disagree
  // with every *other* system that already reads an entity's real position
  // straight off `Transform` (`RenderPipeline`, `place_meeting`'s own
  // `spriteHalfExtents`-based AABB check, `CameraSystem` follow, ...) — a
  // GML script writing `x += hsp;` needs to move the same position
  // `RenderPipeline` actually draws from, not a disconnected shadow copy.
  //
  // Handles every real assignment shape `x`/`y` can appear in — increment/
  // decrement, compound assignment, plain assignment (via the same
  // multi-line-aware `replacePlainAssignmentMultiline` helper the implicit-
  // var pass below uses, since a plain `y = ...` can equally wrap arguments
  // across lines) — before falling through to a bare-read rewrite, the same
  // increment → compound → plain → bare-read ordering every other built-in
  // in this file already follows. Every pass keeps the same `(?<!\.\s*)`
  // dotted-reference guard (`inst.x = 5;`/`other.y` is a different
  // instance's field this transpiler cannot resolve, left untouched) and
  // `(?<!\/\/[^\n]*)` comment guard `sprite_index`/`image_angle` already
  // establish. String literals are masked first and restored after, the
  // same technique the implicit-var pass below already uses — `x`/`y` are
  // single-letter identifiers, the single case in this whole file most
  // likely to false-positive-match inside an unrelated string
  // (`"x: " + string(x)`), so this pass can't skip that protection the way
  // the longer, far-less-collision-prone built-in names above safely do.
  //
  // Known, honest, deliberately-unhandled limitation: a GMS2.3+ struct
  // literal that happens to use the exact key name `x`/`y` (`{x: 5, y: 10}`)
  // would have that key wrongly rewritten into a `Transform` read/write
  // expression, which is not valid as an object-literal key. Freedom
  // Backup's own real source (confirmed by the full project sweep this fix
  // was verified against) uses GameMaker's classic `x += ...`/`y += ...`
  // assignment style throughout, never a struct literal keyed `x`/`y` — this
  // is a real, narrower gap than the one being fixed, documented rather than
  // silently risked going forward, the same "state gaps honestly" precedent
  // `image_index`/`image_speed` above already set.
  {
    const { masked, store: maskedForXY } = maskGmlStringLiterals(out, "GMLXY");
    out = masked;

    for (const field of ["x", "y"] as const) {
      out = out.replace(
        new RegExp(
          `(?<!\\/\\/[^\\n]*)(?<!\\.\\s*)\\b${field}\\s*(\\+\\+|--)`,
          "g",
        ),
        (_m, op: string) =>
          `(() => { const _t = _entity.get(GmlActions.Transform); if (_t) _t.${field} ${op === "++" ? "+=" : "-="} 1; })()`,
      );
      out = out.replace(
        new RegExp(
          `(?<!\\/\\/[^\\n]*)(?<!\\.\\s*)\\b${field}\\s*(\\+=|-=|\\*=|/=|%=)\\s*([^;\\n]+);?`,
          "g",
        ),
        (_m, op: string, exprRaw: string) =>
          `(() => { const _t = _entity.get(GmlActions.Transform); if (_t) _t.${field} ${op} (${exprRaw.trim()}); })();`,
      );
      out = replacePlainAssignmentMultiline(
        out,
        field,
        (indent, expr) =>
          `${indent}(() => { const _t = _entity.get(GmlActions.Transform); if (_t) _t.${field} = ${expr}; })();`,
      );
      out = out.replace(
        new RegExp(
          `(?<!\\/\\/[^\\n]*)(?<!\\.\\s*)\\b${field}\\b(?!\\s*=(?!=))`,
          "g",
        ),
        `(_entity.get(GmlActions.Transform)?.${field} ?? 0)`,
      );
    }

    out = unmaskGmlStringLiterals(out, "GMLXY", maskedForXY);
  }

  // GameMaker instance variables (both its own built-ins — image_speed,
  // image_index, visible, ... not already special-cased above — and any
  // project-defined one, e.g. a plain `mywall = instance_create_layer(...)`,
  // or `cam`/`follow`/`shake_remain` in a camera-follow controller) need no
  // declaration in GML — a bare `name = expr;` implicitly creates/writes
  // that instance's own field the first time it's assigned, and that field
  // is real per-instance state that persists for the instance's whole
  // lifetime, read back by name in any later event.
  //
  // This used to be handled by prefixing the first bare assignment with a
  // plain JS `var` — which made the crash-on-undeclared-identifier problem
  // go away, but was a real, severe, previously-undiscovered bug of its
  // own: a JS `var` is scoped to *that one generated function*, and every
  // GML event becomes its own separate function (gms2-codegen.ts), so a
  // value an instance's Create event set was silently gone the instant
  // Create's function returned — a later event reading the same bare name
  // saw a fresh, re-initialized local, never the value Create actually
  // stored. Confirmed against a real, full GameMaker project: Freedom
  // Backup's obj_camera sets `cam`/`follow`/`view_w_half`/`view_h_half` once
  // in Create and reads every one of them every frame in Step — exactly the
  // "must survive across events" shape the old `var` behavior silently
  // broke, camera-following (and by the same mechanism, any object with
  // meaningful Create-then-Step state) throughout the whole game.
  //
  // The real fix: every bare-assigned name not already declared with a real
  // `var`/`let`/`const` anywhere in this event's own body (i.e. every name
  // GML itself would treat as an implicit instance field, not a true local)
  // routes through `GmlActions.getGmlVar`/`setGmlVar` — a real per-`(World,
  // eid)` side-table keyed by name (`compat/gmlInstanceVars.ts`), the exact
  // "engine defines a `Map`, since a GML instance's implicit fields are
  // arbitrarily named and arbitrarily typed" pattern `GlobalStore` already
  // uses for GML's *global* variables. This closes the "does not attempt
  // real instance-variable persistence across events" gap this same block
  // used to document as a known, deliberate limitation.
  {
    const implicitVars = identifyGmlImplicitVars(out, new Set(knownParams));
    // Merge in names known from an object's *other* event files
    // (`knownImplicitVars`, from `scanGmlImplicitVars` — see its own doc
    // comment) that this specific body never itself assigns, only reads. A
    // real local `var`/`let`/`const` declared in *this* body, or a real
    // script parameter, still shadows it — GML's own per-event `var` scope
    // takes precedence over another event's implicit field of the same
    // name, the rare but real case of a locally-scoped name that happens to
    // collide with a sibling event's instance field.
    if (knownImplicitVars.size > 0) {
      const declaredHere = new Set<string>();
      for (const m of out.matchAll(/\b(?:var|let|const)\s+([A-Za-z_]\w*)/g)) {
        declaredHere.add(m[1] as string);
      }
      for (const name of knownImplicitVars) {
        if (
          !declaredHere.has(name) &&
          !knownParams.includes(name) &&
          !GML_RESERVED_IDENTIFIERS.has(name)
        ) {
          implicitVars.add(name);
        }
      }
    }

    // Real, confirmed regression: a bare-word regex has no notion of string
    // boundaries, and a real GML source string literal routinely contains
    // text that happens to match an implicit variable's own name —
    // confirmed against Freedom Backup's obj_trans:
    // `trans_intro0 = load_string("trans_intro0");` (a save-key string that
    // happens to equal the variable's own name is a common, ordinary
    // naming convention, not a contrived edge case). Without masking,
    // `\btrans_intro0\b` matched *inside* that string literal too, splicing
    // a whole `GmlActions.getGmlVar(...)` call into the middle of a quoted
    // string — a hard `SyntaxError`. Every double- or single-quoted string
    // literal in `out` is replaced with a placeholder before any of the
    // four rewrite passes run (for every identified name, not just this
    // one), and restored verbatim once the whole loop below is done, the
    // standard "protect literals during regex-based rewriting" technique.
    const { masked: maskedOut, store: maskedStrings } = maskGmlStringLiterals(
      out,
      "GMLSTR",
    );
    out = maskedOut;

    // Every identified implicit instance variable gets the exact same
    // increment/decrement → compound-assign → plain-assign → bare-read
    // rewrite order `global.x` already uses above, routed through
    // `GmlActions.getGmlVar`/`setGmlVar` instead of `_ctx.game?.globals`.
    // The `(?<!\.\s*)` guard on every pattern excludes a dotted reference to
    // *another* instance's field (`other.cam`, `follow.x`) — this transpiler
    // has no way to resolve that to a different entity, and rewriting it
    // against the *current* entity would silently corrupt the wrong
    // instance's state, the same dotted-reference exclusion `sprite_index`/
    // `image_*`/`alarm[n]` already establish elsewhere in this file.
    let implicitVarCounter = 0;
    for (const name of implicitVars) {
      const esc = escapeRegExpTranspile(name);
      // A placeholder token, not the real quoted key text, is used as the
      // replacement's own key argument for all four passes below — the
      // real quoted key (`"name"`) contains the bare word `name` itself, so
      // if it were inserted directly, the *next* pass's own `\bname\b`
      // search (in particular the final bare-read catch-all) would match
      // back into the key string of a call this same loop iteration just
      // produced, corrupting it. A placeholder built from characters that
      // can never equal a real GML identifier sidesteps this self-collision
      // entirely; it's swapped for the real quoted key exactly once, after
      // all four passes for this name have finished.
      const placeholder = `__GML_IVAR_${implicitVarCounter++}__`;
      // The three *assignment*-shaped passes (increment/decrement, compound,
      // plain) are anchored to a real statement start (`^\s*`, multiline) —
      // exactly as conservative as the identification loop above, which
      // only ever recognised a line-start bare assignment in the first
      // place. Real, confirmed regression without this anchor: GML's `=`
      // means *equality* inside an `if (...)` condition, not assignment
      // (`if argument4 = 0` is a real, valid GML comparison, already
      // rewritten to `if (argument4 = 0)` by an earlier pass) — an
      // unanchored `\bname\s*=(?!=)` matches that `=` too, since plain
      // regex text-search has no notion of "inside a condition". Anchoring
      // to statement start means it can only ever match a genuine
      // assignment *statement*, never an equality test sitting inside a
      // parenthesised condition or any other expression position. The
      // bare-read catch-all below stays unanchored/global — a real read can
      // legitimately appear anywhere in an expression, including inside a
      // condition, and by this point every genuine assignment occurrence
      // has already been consumed by one of the three anchored passes.
      out = out.replace(
        new RegExp(`^(\\s*)${esc}\\s*(\\+\\+|--)`, "gm"),
        (_m, indent: string, op: string) =>
          `${indent}GmlActions.setGmlVar(_entity, _ctx, ${placeholder}, ((GmlActions.getGmlVar(_entity, _ctx, ${placeholder}) as number | undefined) ?? 0) ${op === "++" ? "+" : "-"} 1)`,
      );
      out = out.replace(
        new RegExp(
          `^(\\s*)${esc}\\s*(\\+=|-=|\\*=|/=|%=)\\s*([^;\\n]+);?`,
          "gm",
        ),
        (_m, indent: string, op: string, exprRaw: string) => {
          const jsOp = op[0];
          return `${indent}GmlActions.setGmlVar(_entity, _ctx, ${placeholder}, ((GmlActions.getGmlVar(_entity, _ctx, ${placeholder}) as number | undefined) ?? 0) ${jsOp} (${exprRaw.trim()}));`;
        },
      );
      out = replacePlainAssignmentMultiline(
        out,
        name,
        (indent, expr) =>
          `${indent}GmlActions.setGmlVar(_entity, _ctx, ${placeholder}, ${expr});`,
      );
      // Excludes an occurrence immediately followed by a single `=` (not
      // `==`) — GML's real condition-position `=` means equality, not
      // assignment, and a name reaching this final catch-all still
      // followed by one wasn't consumed by any of the three anchored
      // assignment passes above (real, confirmed case: `if argument4 = 0`,
      // a brace-less if whose bare condition an earlier pass wraps in
      // parens without touching its `=` — bare-read-wrapping the name here
      // would produce `(GmlActions.getGmlVar(...)) = 0`, an invalid
      // assignment target and a hard SyntaxError).
      out = out.replace(
        new RegExp(`(?<!\\.\\s*)\\b${esc}\\b(?!\\s*=(?!=))`, "g"),
        `(GmlActions.getGmlVar(_entity, _ctx, ${placeholder}))`,
      );
      out = out.split(placeholder).join(JSON.stringify(name));
    }

    out = unmaskGmlStringLiterals(out, "GMLSTR", maskedStrings);
  }

  return out;
}

/**
 * Attempt to read and transpile a GML event file. Returns the transpiled
 * method body lines (indented), or null if the file doesn't exist.
 */
export async function readAndTranspileGML(
  gmlPath: string,
  knownImplicitVars: ReadonlySet<string> = new Set(),
  hasOtherParam = false,
  functionId = "fn",
): Promise<string | null> {
  try {
    const source = await fs.readFile(gmlPath, "utf-8");
    return transpileGML(
      source,
      [],
      knownImplicitVars,
      hasOtherParam,
      functionId,
    );
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
