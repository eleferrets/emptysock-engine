/**
 * Token-level project scans that are independent of statement recovery: a
 * `#macro` line or `enum X {` header is found from the lexer's token stream,
 * so a syntax error elsewhere in the file (or inside a comment or string,
 * where these are not declarations at all) can neither hide nor fake one.
 */

import type { EnumDecl, MacroDecl } from "./ast.js";
import { isTrivia, tokenize } from "./lexer.js";
import { parseMacroDirective, parseStatementAt } from "./parser.js";

/** Every `#macro` declaration in `text`, in source order. */
export function scanMacros(text: string): MacroDecl[] {
  const out: MacroDecl[] = [];
  for (const t of tokenize(text)) {
    if (t.kind !== "macro") continue;
    const m = parseMacroDirective(t.text, t.start);
    if (m) out.push(m);
  }
  return out;
}

/** Every `enum Name { ... }` declaration in `text`, in source order. */
export function scanEnums(text: string): EnumDecl[] {
  const out: EnumDecl[] = [];
  const toks = tokenize(text).filter((t) => !isTrivia(t));
  for (let i = 0; i + 2 < toks.length; i++) {
    const t = toks[i]!;
    if (t.kind !== "keyword" || t.text !== "enum") continue;
    const name = toks[i + 1]!;
    const open = toks[i + 2]!;
    if (name.kind !== "ident") continue;
    if (!((open.kind === "punct" && open.text === "{") || (open.kind === "keyword" && open.text === "begin"))) continue;
    const s = parseStatementAt(text, t.start);
    // an unterminated declaration is not a declaration (the regex scan it replaces also required the closing brace)
    if (s.type === "EnumDecl" && s.closed) out.push(s);
  }
  return out;
}
