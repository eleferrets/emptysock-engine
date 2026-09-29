/**
 * GML lexer (standard library only).
 *
 * Lossless: every character of the source belongs to exactly one token
 * (whitespace, newlines and comments are trivia tokens), so
 * `tokens.map(t => t.text).join("") === source` always holds. The lexer never
 * throws; unrecognised characters become `error` tokens.
 */

export type TokenKind =
  | "ident"
  | "keyword"
  | "number"
  | "string" // "..." or '...' with backslash escapes
  | "verbatim" // @"..." / @'...' (no escapes)
  | "template" // $"...{expr}..." (whole literal is one token, see `parts`)
  | "punct"
  | "macro" // `#macro ...` (whole logical line, `\` continuations included)
  | "region" // `#region` / `#endregion` / other `#directive` lines (trivia)
  | "whitespace"
  | "newline"
  | "comment"
  | "error"
  | "eof";

export interface TemplatePart {
  kind: "text" | "expr";
  /** Absolute source offsets. For `expr` the range excludes the braces. */
  start: number;
  end: number;
}

export interface Token {
  kind: TokenKind;
  text: string;
  start: number;
  end: number;
  /** True when a newline occurs between the previous significant token and this one. */
  nlBefore?: boolean;
  /** Template literals only. */
  parts?: TemplatePart[];
  /** Strings only: false when the closing quote is missing. */
  terminated?: boolean;
}

export const GML_KEYWORDS: ReadonlySet<string> = new Set([
  "var",
  "globalvar",
  "static",
  "if",
  "then",
  "else",
  "begin",
  "end",
  "for",
  "while",
  "do",
  "until",
  "repeat",
  "switch",
  "case",
  "default",
  "break",
  "continue",
  "return",
  "exit",
  "with",
  "function",
  "constructor",
  "new",
  "delete",
  "enum",
  "try",
  "catch",
  "finally",
  "throw",
  "and",
  "or",
  "xor",
  "not",
  "mod",
  "div",
  "true",
  "false",
  "undefined",
]);

/** Identifiers that the language treats as built-in scope/instance keywords. */
export const GML_SPECIAL_IDENTS: ReadonlySet<string> = new Set([
  "self",
  "other",
  "all",
  "noone",
  "global",
]);

const PUNCTS: string[] = [
  // longest match wins: 3-char, then 2-char, then single
  ">>=",
  "<<=",
  "??=",
  "??",
  "[|",
  "[?",
  "[#",
  "[@",
  "&&",
  "||",
  "^^",
  "++",
  "--",
  "+=",
  "-=",
  "*=",
  "/=",
  "%=",
  "&=",
  "|=",
  "^=",
  "<<",
  ">>",
  "==",
  "!=",
  "<>",
  "<=",
  ">=",
  ":=",
  "+",
  "-",
  "*",
  "/",
  "%",
  "&",
  "|",
  "^",
  "~",
  "!",
  "<",
  ">",
  "=",
  "?",
  ":",
  ".",
  ",",
  ";",
  "(",
  ")",
  "{",
  "}",
  "[",
  "]",
];
const PUNCT_LIST = PUNCTS;

const isIdentStart = (c: string): boolean => /[A-Za-z_]/.test(c);
const isIdentPart = (c: string): boolean => /[A-Za-z0-9_]/.test(c);
const isDigit = (c: string): boolean => c >= "0" && c <= "9";
const isHex = (c: string): boolean => /[0-9A-Fa-f]/.test(c);

/** Scan a quoted string body starting after the opening quote. Returns end offset (after closing quote) and terminated flag. */
function scanQuoted(
  src: string,
  from: number,
  quote: string,
  escapes: boolean,
): { end: number; terminated: boolean } {
  let i = from;
  while (i < src.length) {
    const c = src[i]!;
    if (escapes && c === "\\" && i + 1 < src.length) {
      i += 2;
      continue;
    }
    if (c === quote) return { end: i + 1, terminated: true };
    i++;
  }
  return { end: src.length, terminated: false };
}

/** Scan a template literal `$"..."` starting at the opening quote (offset of `"`). */
function scanTemplate(
  src: string,
  quoteAt: number,
): { end: number; terminated: boolean; parts: TemplatePart[] } {
  const quote = src[quoteAt]!;
  const parts: TemplatePart[] = [];
  let i = quoteAt + 1;
  let textStart = i;
  while (i < src.length) {
    const c = src[i]!;
    if (c === "\\" && i + 1 < src.length) {
      i += 2;
      continue;
    }
    if (c === quote) {
      if (i > textStart)
        parts.push({ kind: "text", start: textStart, end: i });
      return { end: i + 1, terminated: true, parts };
    }
    if (c === "{") {
      if (i > textStart)
        parts.push({ kind: "text", start: textStart, end: i });
      // find the matching brace, skipping nested strings
      let depth = 1;
      let j = i + 1;
      while (j < src.length && depth > 0) {
        const d = src[j]!;
        if (d === '"' || d === "'") {
          j = scanQuoted(src, j + 1, d, true).end;
          continue;
        }
        if (d === "{") depth++;
        else if (d === "}") depth--;
        j++;
      }
      // j is just after the closing brace (or EOF)
      const exprEnd = depth === 0 ? j - 1 : j;
      parts.push({ kind: "expr", start: i + 1, end: exprEnd });
      i = j;
      textStart = i;
      continue;
    }
    i++;
  }
  if (i > textStart) parts.push({ kind: "text", start: textStart, end: i });
  return { end: src.length, terminated: false, parts };
}

export function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let lineStart = true; // only whitespace seen since the last newline
  let sawNewline = false;

  const push = (t: Token, significant: boolean): void => {
    if (significant) {
      if (sawNewline) t.nlBefore = true;
      sawNewline = false;
    }
    tokens.push(t);
  };

  while (i < src.length) {
    const c = src[i]!;
    const start = i;

    // newline
    if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i += 2;
      else i++;
      push({ kind: "newline", text: src.slice(start, i), start, end: i }, false);
      lineStart = true;
      sawNewline = true;
      continue;
    }
    // whitespace
    if (c === " " || c === "\t" || c === "\f" || c === "\v" || c === " " || c === "﻿") {
      while (
        i < src.length &&
        (src[i] === " " ||
          src[i] === "\t" ||
          src[i] === "\f" ||
          src[i] === "\v" ||
          src[i] === " " ||
          src[i] === "﻿")
      )
        i++;
      push({ kind: "whitespace", text: src.slice(start, i), start, end: i }, false);
      continue;
    }
    // comments
    if (c === "/" && src[i + 1] === "/") {
      while (i < src.length && src[i] !== "\n" && src[i] !== "\r") i++;
      push({ kind: "comment", text: src.slice(start, i), start, end: i }, false);
      continue;
    }
    if (c === "/" && src[i + 1] === "*") {
      const close = src.indexOf("*/", i + 2);
      i = close < 0 ? src.length : close + 2;
      const text = src.slice(start, i);
      push({ kind: "comment", text, start, end: i }, false);
      if (/[\r\n]/.test(text)) {
        sawNewline = true;
        lineStart = false;
      }
      continue;
    }
    // directives
    if (c === "#" && lineStart) {
      const m = /^#([A-Za-z_]+)/.exec(src.slice(i, i + 32));
      if (m) {
        const word = m[1]!;
        if (word === "macro") {
          // logical line with `\` continuations
          while (i < src.length) {
            if (src[i] === "\\" && (src[i + 1] === "\n" || (src[i + 1] === "\r" && src[i + 2] === "\n"))) {
              i += src[i + 1] === "\r" ? 3 : 2;
              continue;
            }
            if (src[i] === "\\" && src[i + 1] === "\r") {
              i += 2;
              continue;
            }
            if (src[i] === "\n" || src[i] === "\r") break;
            i++;
          }
          push({ kind: "macro", text: src.slice(start, i), start, end: i }, true);
          lineStart = false;
          continue;
        }
        // #region, #endregion, #define, ... : rest of line, trivia
        while (i < src.length && src[i] !== "\n" && src[i] !== "\r") i++;
        push({ kind: "region", text: src.slice(start, i), start, end: i }, false);
        continue;
      }
    }
    lineStart = false;

    // strings
    if (c === '"' || c === "'") {
      const r = scanQuoted(src, i + 1, c, true);
      i = r.end;
      push(
        { kind: "string", text: src.slice(start, i), start, end: i, terminated: r.terminated },
        true,
      );
      if (/[\r\n]/.test(src.slice(start, i))) sawNewline = false;
      continue;
    }
    if (c === "@" && (src[i + 1] === '"' || src[i + 1] === "'")) {
      const r = scanQuoted(src, i + 2, src[i + 1]!, false);
      i = r.end;
      push(
        { kind: "verbatim", text: src.slice(start, i), start, end: i, terminated: r.terminated },
        true,
      );
      continue;
    }
    if (c === "$" && (src[i + 1] === '"' || src[i + 1] === "'")) {
      const r = scanTemplate(src, i + 1);
      i = r.end;
      push(
        {
          kind: "template",
          text: src.slice(start, i),
          start,
          end: i,
          parts: r.parts,
          terminated: r.terminated,
        },
        true,
      );
      continue;
    }
    // hex with $ (but `[$` accessor is handled below via punct check first)
    if (c === "$" && i + 1 < src.length && isHex(src[i + 1]!)) {
      i++;
      while (i < src.length && isHex(src[i]!)) i++;
      push({ kind: "number", text: src.slice(start, i), start, end: i }, true);
      continue;
    }
    // numbers
    if (isDigit(c) || (c === "." && i + 1 < src.length && isDigit(src[i + 1]!))) {
      if (c === "0" && (src[i + 1] === "x" || src[i + 1] === "X") && i + 2 < src.length && isHex(src[i + 2]!)) {
        i += 2;
        while (i < src.length && isHex(src[i]!)) i++;
      } else if (c === "0" && (src[i + 1] === "b" || src[i + 1] === "B") && /[01]/.test(src[i + 2] ?? "")) {
        i += 2;
        while (i < src.length && /[01_]/.test(src[i]!)) i++;
      } else {
        while (i < src.length && (isDigit(src[i]!) || src[i] === "_")) i++;
        if (src[i] === "." && isDigit(src[i + 1] ?? "")) {
          i++;
          while (i < src.length && isDigit(src[i]!)) i++;
        } else if (src[i] === "." && !isIdentStart(src[i + 1] ?? "") && src[i + 1] !== ".") {
          // `1.` trailing dot
          i++;
        }
        if ((src[i] === "e" || src[i] === "E") && (isDigit(src[i + 1] ?? "") || ((src[i + 1] === "+" || src[i + 1] === "-") && isDigit(src[i + 2] ?? "")))) {
          i += 2;
          while (i < src.length && isDigit(src[i]!)) i++;
        }
      }
      push({ kind: "number", text: src.slice(start, i), start, end: i }, true);
      continue;
    }
    // identifiers / keywords
    if (isIdentStart(c)) {
      while (i < src.length && isIdentPart(src[i]!)) i++;
      const text = src.slice(start, i);
      push({ kind: GML_KEYWORDS.has(text) ? "keyword" : "ident", text, start, end: i }, true);
      continue;
    }
    // `[$` struct accessor (vs array literal starting with a `$` hex number)
    if (c === "[" && src[i + 1] === "$") {
      const n = src[i + 2] ?? "";
      if (!isHex(n) || n === "") {
        i += 2;
        push({ kind: "punct", text: "[$", start, end: i }, true);
        continue;
      }
    }
    // punctuation (longest match)
    let matched = "";
    for (const p of PUNCT_LIST) {
      if (src.startsWith(p, i)) {
        matched = p;
        break;
      }
    }
    if (matched) {
      i += matched.length;
      push({ kind: "punct", text: matched, start, end: i }, true);
      continue;
    }
    // unknown char
    i++;
    push({ kind: "error", text: src.slice(start, i), start, end: i }, true);
  }
  tokens.push({ kind: "eof", text: "", start: src.length, end: src.length, ...(sawNewline ? { nlBefore: true } : {}) });
  return tokens;
}

export function isTrivia(t: Token): boolean {
  return (
    t.kind === "whitespace" ||
    t.kind === "newline" ||
    t.kind === "comment" ||
    t.kind === "region"
  );
}

/** Reassemble source from tokens (lossless round-trip check). */
export function printTokens(tokens: readonly Token[]): string {
  return tokens.map((t) => t.text).join("");
}
