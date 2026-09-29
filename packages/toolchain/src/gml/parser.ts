/**
 * GML parser: hand-rolled recursive descent + Pratt expressions, statement-level
 * error recovery. Never throws: an unparseable statement becomes an `ErrorStmt`
 * covering the skipped tokens and a diagnostic is recorded.
 *
 * GML quirks handled here:
 * - `=` is an assignment only in statement position; anywhere inside an
 *   expression (conditions, arguments, parentheses, rhs of assignment) it is a
 *   comparison (`Binary` with `op: "=="`, `eqFromAssign: true`).
 * - `if`/`while`/`with`/`switch`/`repeat` conditions with or without
 *   parentheses; optional `then`; `begin`/`end` for braces.
 * - optional semicolons.
 */

import type {
  AccessorKind,
  Block,
  Declarator,
  Expr,
  Identifier,
  MacroDecl,
  Param,
  ParseDiagnostic,
  ParseResult,
  Program,
  Stmt,
  StructProp,
  SwitchCase,
  TemplateString,
} from "./ast.js";
import { isTrivia, tokenize, type Token } from "./lexer.js";

class ParseError extends Error {
  constructor(
    message: string,
    readonly start: number,
    readonly end: number,
  ) {
    super(message);
  }
}

const ASSIGN_OPS = new Set([
  "=",
  ":=",
  "+=",
  "-=",
  "*=",
  "/=",
  "%=",
  "&=",
  "|=",
  "^=",
  "<<=",
  ">>=",
  "??=",
]);

interface BinInfo {
  prec: number;
  op: string;
}

function binaryInfo(t: Token, eqAsCompare: boolean): BinInfo | undefined {
  if (t.kind === "keyword") {
    switch (t.text) {
      case "and":
        return { prec: 4, op: "&&" };
      case "or":
        return { prec: 2, op: "||" };
      case "xor":
        return { prec: 3, op: "^^" };
      case "mod":
        return { prec: 12, op: "%" };
      case "div":
        return { prec: 12, op: "div" };
      default:
        return undefined;
    }
  }
  if (t.kind !== "punct") return undefined;
  switch (t.text) {
    case "??":
      return { prec: 1, op: "??" };
    case "||":
      return { prec: 2, op: "||" };
    case "^^":
      return { prec: 3, op: "^^" };
    case "&&":
      return { prec: 4, op: "&&" };
    case "==":
      return { prec: 5, op: "==" };
    case "!=":
    case "<>":
      return { prec: 5, op: "!=" };
    case "=":
      return eqAsCompare ? { prec: 5, op: "==" } : undefined;
    case "<":
    case ">":
    case "<=":
    case ">=":
      return { prec: 6, op: t.text };
    case "|":
      return { prec: 7, op: "|" };
    case "^":
      return { prec: 8, op: "^" };
    case "&":
      return { prec: 9, op: "&" };
    case "<<":
    case ">>":
      return { prec: 10, op: t.text };
    case "+":
    case "-":
      return { prec: 11, op: t.text };
    case "*":
    case "/":
    case "%":
      return { prec: 12, op: t.text };
    default:
      return undefined;
  }
}

/** Tokens after a parenthesised condition that continue the expression (`if (a) && b`). */
const COND_CONTINUATION = new Set([
  "&&",
  "||",
  "^^",
  "==",
  "!=",
  "<>",
  "<",
  ">",
  "<=",
  ">=",
  "*",
  "/",
  "%",
  "?",
  "??",
  "|",
  "^",
]);
const COND_CONTINUATION_KW = new Set(["and", "or", "xor", "mod", "div"]);

const STMT_START_KW = new Set([
  "var",
  "globalvar",
  "static",
  "if",
  "for",
  "while",
  "do",
  "repeat",
  "switch",
  "with",
  "return",
  "exit",
  "break",
  "continue",
  "try",
  "throw",
  "function",
  "enum",
  "delete",
]);

function decodeString(body: string): string {
  return body.replace(/\\(x[0-9A-Fa-f]{2}|u[0-9A-Fa-f]{4}|[\s\S])/g, (_m, e: string) => {
    switch (e[0]) {
      case "n":
        return "\n";
      case "t":
        return "\t";
      case "r":
        return "\r";
      case "0":
        return "\0";
      case "b":
        return "\b";
      case "f":
        return "\f";
      case "v":
        return "\v";
      case "a":
        return "\x07";
      case "x":
      case "u":
        return e.length > 1 ? String.fromCharCode(parseInt(e.slice(1), 16)) : e;
      default:
        return e;
    }
  });
}

function numberValue(raw: string): number {
  const t = raw.replace(/_/g, "");
  if (t[0] === "$") return parseInt(t.slice(1), 16);
  if (/^0[xX]/.test(t)) return parseInt(t.slice(2), 16);
  if (/^0[bB]/.test(t)) return parseInt(t.slice(2), 2);
  return Number(t);
}

class Parser {
  private toks: Token[];
  private pos = 0;
  private prevEnd = 0;
  private eqCompare = true;
  readonly diagnostics: ParseDiagnostic[] = [];
  recovered = 0;

  constructor(
    private readonly src: string,
    all: Token[],
    private readonly offset = 0,
  ) {
    this.toks = all.filter((t) => !isTrivia(t));
  }

  // ---- token helpers ----
  private peek(k = 0): Token {
    return this.toks[Math.min(this.pos + k, this.toks.length - 1)]!;
  }
  private next(): Token {
    const t = this.toks[this.pos]!;
    if (t.kind !== "eof") this.pos++;
    this.prevEnd = t.end + this.offset;
    return t;
  }
  private atEof(): boolean {
    return this.peek().kind === "eof";
  }
  private isP(text: string, k = 0): boolean {
    const t = this.peek(k);
    return t.kind === "punct" && t.text === text;
  }
  private isK(text: string, k = 0): boolean {
    const t = this.peek(k);
    return t.kind === "keyword" && t.text === text;
  }
  private eatP(text: string): boolean {
    if (this.isP(text)) {
      this.next();
      return true;
    }
    return false;
  }
  private eatK(text: string): boolean {
    if (this.isK(text)) {
      this.next();
      return true;
    }
    return false;
  }
  private fail(message: string, t: Token = this.peek()): never {
    throw new ParseError(message, t.start + this.offset, t.end + this.offset);
  }
  private expectP(text: string): Token {
    if (!this.isP(text)) this.fail(`expected '${text}'`);
    return this.next();
  }
  private startOf(t: Token = this.peek()): number {
    return t.start + this.offset;
  }
  private withEq<T>(v: boolean, fn: () => T): T {
    const saved = this.eqCompare;
    this.eqCompare = v;
    try {
      return fn();
    } finally {
      this.eqCompare = saved;
    }
  }

  // ---- program / statements ----
  parseProgram(): Program {
    const body: Stmt[] = [];
    while (!this.atEof()) body.push(this.parseStmt());
    return { type: "Program", start: this.offset, end: this.offset + this.src.length, body };
  }

  /** Statement with recovery: never throws. */
  private parseStmt(): Stmt {
    const startTok = this.peek();
    const startPos = this.pos;
    try {
      return this.parseStmtInner();
    } catch (e) {
      if (!(e instanceof ParseError)) throw e;
      this.pos = startPos;
      this.diagnostics.push({ message: e.message, start: e.start, end: e.end });
      this.skipBadStatement();
      if (this.pos === startPos) this.next(); // guarantee progress
      this.recovered++;
      const start = this.startOf(startTok);
      return { type: "ErrorStmt", start, end: Math.max(this.prevEnd, start), message: e.message };
    }
  }

  private skipBadStatement(): void {
    const startPos = this.pos;
    let braces = 0; // only `{` nesting matters: `;` inside ( ) or [ ] cannot be valid GML
    let round = 0;
    while (!this.atEof()) {
      const t = this.peek();
      const atStart = this.pos === startPos;
      if (t.kind === "punct") {
        if (t.text === "{") braces++;
        else if (t.text === "}") {
          if (braces === 0) {
            if (!atStart) return;
            this.next();
            return;
          }
          braces--;
        } else if (t.text === "(" || t.text.startsWith("[")) round++;
        else if ((t.text === ")" || t.text === "]") && round > 0) round--;
        else if (t.text === ";" && braces === 0) {
          this.next();
          return;
        }
      } else if (t.kind === "keyword" && braces === 0) {
        if (t.text === "end" || t.text === "else" || t.text === "until" || t.text === "catch" || t.text === "finally" || t.text === "then" || t.text === "case" || t.text === "default") {
          if (!atStart) return;
          this.next(); // stray token: consume only it
          return;
        }
        if (!atStart && t.nlBefore && round === 0 && STMT_START_KW.has(t.text)) return;
      } else if (t.kind === "macro" && !atStart && braces === 0) {
        return;
      }
      this.next();
    }
  }

  private consumeSemi(): void {
    this.eatP(";");
  }

  private parseStmtInner(): Stmt {
    const t = this.peek();
    const start = this.startOf(t);
    if (t.kind === "macro") return this.parseMacro();
    if (t.kind === "punct") {
      if (t.text === ";") {
        this.next();
        return { type: "Empty", start, end: this.prevEnd };
      }
      if (t.text === "{") return this.parseBlock();
    }
    if (t.kind === "keyword") {
      switch (t.text) {
        case "begin":
          return this.parseBlock();
        case "var":
        case "globalvar":
        case "static": {
          const d = this.parseVarDecl();
          this.consumeSemi();
          d.end = this.prevEnd;
          return d;
        }
        case "if": {
          this.next();
          const test = this.parseCondition();
          this.eatK("then");
          const cons = this.parseStmt();
          let alt: Stmt | undefined;
          if (this.isK("else")) {
            this.next();
            alt = this.parseStmt();
          }
          return { type: "If", start, end: this.prevEnd, test, cons, ...(alt ? { alt } : {}) };
        }
        case "while": {
          this.next();
          const test = this.parseCondition();
          this.eatK("do");
          const body = this.parseStmt();
          return { type: "While", start, end: this.prevEnd, test, body };
        }
        case "do": {
          this.next();
          const body = this.parseStmt();
          if (!this.eatK("until")) this.fail("expected 'until'");
          const test = this.parseCondition();
          this.consumeSemi();
          return { type: "DoUntil", start, end: this.prevEnd, body, test };
        }
        case "repeat": {
          this.next();
          const count = this.parseCondition();
          const body = this.parseStmt();
          return { type: "Repeat", start, end: this.prevEnd, count, body };
        }
        case "with": {
          this.next();
          const target = this.parseCondition();
          const body = this.parseStmt();
          return { type: "With", start, end: this.prevEnd, target, body };
        }
        case "for":
          return this.parseFor();
        case "switch":
          return this.parseSwitch();
        case "return": {
          this.next();
          let arg: Expr | undefined;
          const n = this.peek();
          if (!(n.kind === "eof" || (n.kind === "punct" && (n.text === ";" || n.text === "}")) || (n.kind === "keyword" && (n.text === "end" || n.text === "else" || n.text === "case" || n.text === "default")) || n.nlBefore)) {
            arg = this.parseAssignExpr();
          }
          this.consumeSemi();
          return { type: "Return", start, end: this.prevEnd, ...(arg ? { arg } : {}) };
        }
        case "exit":
        case "break":
        case "continue": {
          this.next();
          this.consumeSemi();
          const type = t.text === "exit" ? "Exit" : t.text === "break" ? "Break" : "Continue";
          return { type, start, end: this.prevEnd } as Stmt;
        }
        case "throw": {
          this.next();
          const arg = this.parseAssignExpr();
          this.consumeSemi();
          return { type: "Throw", start, end: this.prevEnd, arg };
        }
        case "try":
          return this.parseTry();
        case "enum":
          return this.parseEnum();
        case "function":
          if (this.peek(1).kind === "ident") return this.parseFunctionDecl();
          break;
        case "then":
        case "else":
        case "end":
        case "until":
        case "catch":
        case "finally":
        case "case":
        case "default":
          this.fail(`unexpected '${t.text}'`);
        // eslint-disable-next-line no-fallthrough
        default:
          break;
      }
    }
    const expr = this.parseAssignExpr();
    this.consumeSemi();
    return { type: "ExprStmt", start, end: this.prevEnd, expr };
  }

  private parseBlock(): Block {
    const open = this.next();
    const start = this.startOf(open);
    const closer = open.text === "{" ? "}" : "end";
    const body: Stmt[] = [];
    for (;;) {
      if (this.atEof()) {
        this.diagnostics.push({ message: `unterminated block, expected '${closer}'`, start, end: this.prevEnd });
        break;
      }
      const t = this.peek();
      if ((closer === "}" && t.kind === "punct" && t.text === "}") || (closer === "end" && t.kind === "keyword" && t.text === "end")) {
        this.next();
        break;
      }
      // a mismatched closer terminates recovery-friendly: treat `}`/`end` of the other style as error stmt
      body.push(this.parseStmt());
    }
    return { type: "Block", start, end: this.prevEnd, body };
  }

  private parseBlockRequired(): Block {
    if (!(this.isP("{") || this.isK("begin"))) this.fail("expected block");
    return this.parseBlock();
  }

  private parseVarDecl(): Extract<Stmt, { type: "VarDecl" }> {
    const kw = this.next();
    const declKind = kw.text as "var" | "globalvar" | "static";
    const start = this.startOf(kw);
    const decls: Declarator[] = [];
    for (;;) {
      const id = this.peek();
      if (id.kind !== "ident") this.fail("expected identifier");
      this.next();
      const d: Declarator = { name: id.text, start: this.startOf(id), end: id.end + this.offset };
      if (this.isP("=") || this.isP(":=")) {
        this.next();
        d.init = this.withEq(true, () => this.parseTernary());
        d.end = this.prevEnd;
      }
      decls.push(d);
      if (this.isP(",")) {
        this.next();
        continue;
      }
      // `var a b` (missing comma) is not accepted; but `var a` followed by newline ident is a new statement
      break;
    }
    return { type: "VarDecl", start, end: this.prevEnd, declKind, decls };
  }

  private parseFor(): Stmt {
    const kw = this.next();
    const start = this.startOf(kw);
    const paren = this.eatP("(");
    if (!paren) this.fail("expected '('");
    let init: Stmt | undefined;
    if (!this.isP(";")) init = this.parseSimpleStmt();
    this.eatP(";");
    let test: Expr | undefined;
    if (!this.isP(";")) test = this.withEq(true, () => this.parseTernary());
    this.eatP(";");
    let update: Stmt | undefined;
    if (!this.isP(")")) update = this.parseSimpleStmt();
    this.expectP(")");
    const body = this.parseStmt();
    return {
      type: "For",
      start,
      end: this.prevEnd,
      ...(init ? { init } : {}),
      ...(test ? { test } : {}),
      ...(update ? { update } : {}),
      body,
    };
  }

  /** var-decl or expression, without consuming the trailing `;`. */
  private parseSimpleStmt(): Stmt {
    const t = this.peek();
    if (t.kind === "keyword" && (t.text === "var" || t.text === "globalvar" || t.text === "static")) {
      return this.parseVarDecl();
    }
    const start = this.startOf(t);
    const expr = this.parseAssignExpr();
    return { type: "ExprStmt", start, end: this.prevEnd, expr };
  }

  private parseSwitch(): Stmt {
    const kw = this.next();
    const start = this.startOf(kw);
    const discriminant = this.parseCondition();
    if (!(this.isP("{") || this.isK("begin"))) this.fail("expected '{'");
    const open = this.next();
    const closer = open.text === "{" ? "}" : "end";
    const cases: SwitchCase[] = [];
    let cur: SwitchCase | undefined;
    for (;;) {
      if (this.atEof()) {
        this.diagnostics.push({ message: "unterminated switch", start, end: this.prevEnd });
        break;
      }
      const t = this.peek();
      if ((closer === "}" && t.kind === "punct" && t.text === "}") || (closer === "end" && t.kind === "keyword" && t.text === "end")) {
        this.next();
        break;
      }
      if (t.kind === "keyword" && (t.text === "case" || t.text === "default")) {
        if (cur) {
          cur.end = this.prevEnd;
          cases.push(cur);
        }
        const cs = this.startOf(t);
        this.next();
        const c: SwitchCase = { body: [], start: cs, end: cs };
        if (t.text === "case") {
          try {
            c.test = this.withEq(true, () => this.parseTernary());
          } catch (e) {
            if (!(e instanceof ParseError)) throw e;
            this.diagnostics.push({ message: e.message, start: e.start, end: e.end });
            this.recovered++;
            while (!this.atEof() && !this.isP(":") && !this.isP("}")) this.next();
          }
        }
        if (!this.eatP(":")) this.diagnostics.push({ message: "expected ':' after case", start: cs, end: this.prevEnd });
        cur = c;
        continue;
      }
      const s = this.parseStmt();
      if (!cur) {
        cur = { body: [], start: s.start, end: s.end };
      }
      cur.body.push(s);
    }
    if (cur) {
      cur.end = this.prevEnd;
      cases.push(cur);
    }
    return { type: "Switch", start, end: this.prevEnd, discriminant, cases };
  }

  private parseTry(): Stmt {
    const kw = this.next();
    const start = this.startOf(kw);
    const block = this.parseBlockRequired();
    let param: string | undefined;
    let handler: Block | undefined;
    let finalizer: Block | undefined;
    if (this.eatK("catch")) {
      if (this.eatP("(")) {
        const id = this.peek();
        if (id.kind !== "ident") this.fail("expected identifier");
        this.next();
        param = id.text;
        this.expectP(")");
      }
      handler = this.parseBlockRequired();
    }
    if (this.eatK("finally")) finalizer = this.parseBlockRequired();
    if (!handler && !finalizer) this.fail("expected 'catch' or 'finally'");
    return {
      type: "Try",
      start,
      end: this.prevEnd,
      block,
      ...(param ? { param } : {}),
      ...(handler ? { handler } : {}),
      ...(finalizer ? { finalizer } : {}),
    };
  }

  private parseEnum(): Stmt {
    const kw = this.next();
    const start = this.startOf(kw);
    const id = this.peek();
    if (id.kind !== "ident") this.fail("expected enum name");
    this.next();
    if (!(this.isP("{") || this.isK("begin"))) this.fail("expected '{'");
    const open = this.next();
    const closer = open.text === "{" ? "}" : "end";
    const members: Array<{ name: string; start: number; end: number; value?: Expr }> = [];
    for (;;) {
      if (this.atEof()) {
        this.diagnostics.push({ message: "unterminated enum", start, end: this.prevEnd });
        break;
      }
      const t = this.peek();
      if ((closer === "}" && t.kind === "punct" && t.text === "}") || (closer === "end" && t.kind === "keyword" && t.text === "end")) {
        this.next();
        break;
      }
      if (t.kind === "punct" && t.text === ",") {
        this.next();
        continue;
      }
      if (t.kind !== "ident") this.fail("expected enum member name");
      this.next();
      const m: { name: string; start: number; end: number; value?: Expr } = {
        name: t.text,
        start: this.startOf(t),
        end: t.end + this.offset,
      };
      if (this.isP("=")) {
        this.next();
        m.value = this.withEq(true, () => this.parseTernary());
        m.end = this.prevEnd;
      }
      members.push(m);
    }
    this.consumeSemi();
    return { type: "EnumDecl", start, end: this.prevEnd, name: id.text, members };
  }

  private parseParams(): Param[] {
    this.expectP("(");
    const params: Param[] = [];
    while (!this.isP(")")) {
      const id = this.peek();
      if (id.kind !== "ident") this.fail("expected parameter name");
      this.next();
      const p: Param = { name: id.text, start: this.startOf(id), end: id.end + this.offset };
      if (this.isP("=")) {
        this.next();
        p.default = this.withEq(true, () => this.parseTernary());
        p.end = this.prevEnd;
      }
      params.push(p);
      if (!this.eatP(",")) break;
    }
    this.expectP(")");
    return params;
  }

  private parseFunctionTail(): {
    params: Param[];
    body: Block;
    isConstructor: boolean;
    parent?: { name: string; args: Expr[] };
  } {
    const params = this.parseParams();
    let parent: { name: string; args: Expr[] } | undefined;
    let isConstructor = false;
    if (this.isP(":")) {
      this.next();
      const pid = this.peek();
      if (pid.kind !== "ident") this.fail("expected parent constructor name");
      this.next();
      const args = this.parseArgs();
      parent = { name: pid.text, args };
    }
    if (this.eatK("constructor")) isConstructor = true;
    else if (parent) this.fail("expected 'constructor'");
    const body = this.parseBlockRequired();
    return { params, body, isConstructor, ...(parent ? { parent } : {}) };
  }

  private parseFunctionDecl(): Stmt {
    const kw = this.next();
    const start = this.startOf(kw);
    const id = this.next();
    const tail = this.parseFunctionTail();
    return {
      type: "FunctionDecl",
      start,
      end: this.prevEnd,
      name: id.text,
      nameStart: this.startOf(id),
      ...tail,
    };
  }

  private parseMacro(): MacroDecl {
    const t = this.next();
    const start = this.startOf(t);
    // strip directive word and continuations
    let text = t.text.replace(/^#macro/, "").replace(/\\\r?\n|\\\r/g, " ");
    const m = /^\s*(?:([A-Za-z_]\w*)\s*:\s*)?([A-Za-z_]\w*)([\s\S]*)$/.exec(text);
    if (!m) this.fail("malformed #macro", t);
    const config = m[1];
    const name = m[2]!;
    // drop comments from the value (string-aware via the lexer)
    const vt = tokenize(m[3] ?? "");
    text = vt
      .filter((x) => x.kind !== "comment" && x.kind !== "eof")
      .map((x) => x.text)
      .join("")
      .trim();
    const node: MacroDecl = {
      type: "MacroDecl",
      start,
      end: t.end + this.offset,
      name,
      valueText: text,
      ...(config ? { config } : {}),
    };
    if (text) {
      const sub = new Parser(text, tokenize(text), 0);
      try {
        const e = sub.parseExprAll();
        if (e) node.value = e;
      } catch {
        /* value is not a plain expression; keep the text */
      }
    }
    return node;
  }

  /** Parse the whole source as a single expression. Returns undefined if trailing tokens remain. */
  parseExprAll(): Expr | undefined {
    const e = this.withEq(true, () => this.parseTernary());
    return this.atEof() ? e : undefined;
  }

  // ---- expressions ----
  /** Statement-level expression: `=` is assignment here, comparison elsewhere. */
  private parseAssignExpr(): Expr {
    const start = this.startOf();
    const left = this.withEq(false, () => this.parseTernary());
    const t = this.peek();
    if (t.kind === "punct" && ASSIGN_OPS.has(t.text)) {
      this.next();
      const right = this.withEq(true, () => this.parseTernary());
      return {
        type: "Assign",
        start,
        end: this.prevEnd,
        op: t.text === ":=" ? "=" : t.text,
        left,
        right,
      };
    }
    return left;
  }

  private parseCondition(): Expr {
    return this.withEq(true, () => {
      if (this.isP("(")) {
        const start = this.startOf();
        this.next();
        const inner = this.parseTernary();
        this.expectP(")");
        const paren: Expr = { type: "Paren", start, end: this.prevEnd, expr: inner };
        const n = this.peek();
        if (
          !n.nlBefore &&
          ((n.kind === "punct" && COND_CONTINUATION.has(n.text)) ||
            (n.kind === "keyword" && COND_CONTINUATION_KW.has(n.text)))
        ) {
          const bin = this.parseBinaryFrom(paren, 0);
          return this.finishTernary(bin, start);
        }
        return paren;
      }
      return this.parseTernary();
    });
  }

  private parseTernary(): Expr {
    const start = this.startOf();
    const test = this.parseBinary(1);
    return this.finishTernary(test, start);
  }

  private finishTernary(test: Expr, start: number): Expr {
    if (this.isP("?")) {
      this.next();
      const cons = this.withEq(true, () => this.parseTernary());
      this.expectP(":");
      const alt = this.parseTernary();
      return { type: "Conditional", start, end: this.prevEnd, test, cons, alt };
    }
    return test;
  }

  private parseBinary(minPrec: number): Expr {
    const start = this.startOf();
    const left = this.parseUnary();
    return this.parseBinaryFrom(left, minPrec, start);
  }

  private parseBinaryFrom(left: Expr, minPrec: number, start = left.start): Expr {
    for (;;) {
      const t = this.peek();
      const info = binaryInfo(t, this.eqCompare);
      if (!info || info.prec < minPrec) return left;
      this.next();
      const right = this.parseBinary(info.prec + 1);
      left = {
        type: "Binary",
        start,
        end: this.prevEnd,
        op: info.op,
        opRaw: t.text,
        left,
        right,
        ...(t.text === "=" ? { eqFromAssign: true } : {}),
      };
    }
  }

  private parseUnary(): Expr {
    const t = this.peek();
    const start = this.startOf(t);
    if (t.kind === "punct") {
      if (t.text === "!" || t.text === "-" || t.text === "+" || t.text === "~") {
        this.next();
        const arg = this.parseUnary();
        return { type: "Unary", start, end: this.prevEnd, op: t.text, arg };
      }
      if (t.text === "++" || t.text === "--") {
        this.next();
        const arg = this.parseUnary();
        return { type: "Update", start, end: this.prevEnd, op: t.text, prefix: true, arg };
      }
    }
    if (t.kind === "keyword") {
      if (t.text === "not") {
        this.next();
        const arg = this.parseUnary();
        return { type: "Unary", start, end: this.prevEnd, op: "!", arg };
      }
      if (t.text === "delete") {
        this.next();
        const arg = this.parseUnary();
        return { type: "Delete", start, end: this.prevEnd, arg };
      }
    }
    return this.parsePostfix(this.parsePrimary());
  }

  private parseArgs(): Expr[] {
    this.expectP("(");
    const args: Expr[] = [];
    this.withEq(true, () => {
      while (!this.isP(")")) {
        if (this.isP(",")) {
          // GML allows empty args in some legacy calls; keep going without producing a node
          this.next();
          continue;
        }
        if (this.atEof()) this.fail("unterminated argument list");
        args.push(this.parseTernary());
        if (!this.eatP(",")) break;
      }
    });
    this.expectP(")");
    return args;
  }

  private parsePostfix(base: Expr): Expr {
    let e = base;
    for (;;) {
      const t = this.peek();
      const start = e.start;
      if (t.kind === "punct") {
        if (t.text === ".") {
          const n = this.peek(1);
          if (n.kind === "ident" || n.kind === "keyword") {
            this.next();
            this.next();
            e = { type: "Member", start, end: this.prevEnd, object: e, property: n.text, propertyStart: this.startOf(n) };
            continue;
          }
          this.fail("expected property name after '.'", n);
        }
        if (t.text === "(") {
          const args = this.parseArgs();
          e = { type: "Call", start, end: this.prevEnd, callee: e, args };
          continue;
        }
        if (t.text === "[" || t.text === "[|" || t.text === "[?" || t.text === "[#" || t.text === "[@" || t.text === "[$") {
          this.next();
          const accessor = (t.text === "[" ? "[" : t.text[1]) as AccessorKind;
          const indices: Expr[] = [];
          this.withEq(true, () => {
            while (!this.isP("]")) {
              if (this.atEof()) this.fail("unterminated index");
              indices.push(this.parseTernary());
              if (!this.eatP(",")) break;
            }
          });
          this.expectP("]");
          e = { type: "Index", start, end: this.prevEnd, object: e, accessor, indices };
          continue;
        }
        if ((t.text === "++" || t.text === "--") && !t.nlBefore) {
          this.next();
          e = { type: "Update", start, end: this.prevEnd, op: t.text, prefix: false, arg: e };
          continue;
        }
      }
      return e;
    }
  }

  private parsePrimary(): Expr {
    const t = this.peek();
    const start = this.startOf(t);
    switch (t.kind) {
      case "number": {
        this.next();
        return { type: "Literal", start, end: this.prevEnd, litKind: "number", raw: t.text, value: numberValue(t.text) };
      }
      case "string": {
        this.next();
        const body = t.text.slice(1, t.terminated === false ? undefined : -1);
        return { type: "Literal", start, end: this.prevEnd, litKind: "string", raw: t.text, value: decodeString(body) };
      }
      case "verbatim": {
        this.next();
        const body = t.text.slice(2, t.terminated === false ? undefined : -1);
        return { type: "Literal", start, end: this.prevEnd, litKind: "verbatim", raw: t.text, value: body };
      }
      case "template": {
        this.next();
        return this.buildTemplate(t);
      }
      case "ident": {
        this.next();
        return { type: "Identifier", start, end: this.prevEnd, name: t.text } satisfies Identifier;
      }
      case "keyword": {
        if (t.text === "true" || t.text === "false") {
          this.next();
          return { type: "Literal", start, end: this.prevEnd, litKind: "boolean", raw: t.text, value: t.text === "true" };
        }
        if (t.text === "undefined") {
          this.next();
          return { type: "Literal", start, end: this.prevEnd, litKind: "undefined", raw: t.text, value: undefined };
        }
        if (t.text === "new") {
          this.next();
          const id = this.peek();
          let callee: Expr;
          if (id.kind === "ident") {
            this.next();
            callee = { type: "Identifier", start: this.startOf(id), end: this.prevEnd, name: id.text };
            while (this.isP(".") && this.peek(1).kind === "ident") {
              this.next();
              const p = this.next();
              callee = { type: "Member", start: callee.start, end: this.prevEnd, object: callee, property: p.text, propertyStart: this.startOf(p) };
            }
          } else if (this.isK("function")) {
            callee = this.parsePrimary();
          } else {
            this.fail("expected constructor name after 'new'");
          }
          const args = this.isP("(") ? this.parseArgs() : [];
          return { type: "New", start, end: this.prevEnd, callee, args };
        }
        if (t.text === "function") {
          this.next();
          let name: string | undefined;
          if (this.peek().kind === "ident") name = this.next().text;
          const tail = this.parseFunctionTail();
          return { type: "FunctionExpr", start, end: this.prevEnd, ...(name ? { name } : {}), ...tail };
        }
        break;
      }
      case "punct": {
        if (t.text === "(") {
          this.next();
          const expr = this.withEq(true, () => this.parseTernary());
          this.expectP(")");
          return { type: "Paren", start, end: this.prevEnd, expr };
        }
        if (t.text === "[") {
          this.next();
          const elements: Expr[] = [];
          this.withEq(true, () => {
            while (!this.isP("]")) {
              if (this.atEof()) this.fail("unterminated array literal");
              elements.push(this.parseTernary());
              if (!this.eatP(",")) break;
            }
          });
          this.expectP("]");
          return { type: "ArrayLiteral", start, end: this.prevEnd, elements };
        }
        if (t.text === "{") return this.parseStructLiteral();
        break;
      }
      default:
        break;
    }
    this.fail(`unexpected ${t.kind === "eof" ? "end of input" : `'${t.text}'`}`);
  }

  private parseStructLiteral(): Expr {
    const open = this.next();
    const start = this.startOf(open);
    const props: StructProp[] = [];
    this.withEq(true, () => {
      while (!this.isP("}")) {
        if (this.atEof()) this.fail("unterminated struct literal");
        const k = this.peek();
        if (!(k.kind === "ident" || k.kind === "keyword" || k.kind === "string" || k.kind === "number")) this.fail("expected struct key");
        this.next();
        const keyText = k.kind === "string" ? decodeString(k.text.slice(1, k.terminated === false ? undefined : -1)) : k.text;
        this.expectP(":");
        const value = this.parseTernary();
        props.push({ key: keyText, keyStart: this.startOf(k), keyEnd: k.end + this.offset, value });
        if (!this.eatP(",")) break;
      }
    });
    this.expectP("}");
    return { type: "StructLiteral", start, end: this.prevEnd, props };
  }

  private buildTemplate(t: Token): TemplateString {
    const parts: TemplateString["parts"] = [];
    for (const p of t.parts ?? []) {
      const s = p.start + this.offset;
      const e = p.end + this.offset;
      const raw = this.src.slice(p.start, p.end);
      if (p.kind === "text") {
        parts.push({ kind: "text", raw });
      } else {
        // part offsets are relative to this.src; the sub-parser re-bases them with `s`
        const sub = new Parser(raw, tokenize(raw), s);
        let expr: Expr | undefined;
        try {
          expr = sub.parseExprAll();
          if (!expr) this.diagnostics.push({ message: "invalid template expression", start: s, end: e });
        } catch (err) {
          if (!(err instanceof ParseError)) throw err;
          this.diagnostics.push({ message: err.message, start: err.start, end: err.end });
        }
        parts.push({ kind: "expr", expr, start: s, end: e });
      }
    }
    return { type: "TemplateString", start: this.startOf(t), end: t.end + this.offset, parts };
  }
}

export function parse(src: string): ParseResult {
  const p = new Parser(src, tokenize(src));
  const ast = p.parseProgram();
  return { ast, diagnostics: p.diagnostics, recovered: p.recovered };
}

/** Parse a standalone expression (e.g. an enum initialiser). undefined when it is not a single valid expression. */
export function parseExpression(src: string): Expr | undefined {
  const p = new Parser(src, tokenize(src));
  try {
    return p.parseExprAll();
  } catch {
    return undefined;
  }
}
