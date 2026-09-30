/**
 * GML statement emitter: walks a parsed file and writes TypeScript. Owns the
 * per-body state (control-flow frames, `static` slots, comments, imports,
 * diagnostics); expressions, calls and stores are lowered by `expr.ts`,
 * `call.ts` and `store.ts`. Nothing here re-reads generated text.
 */

import type {
  Block,
  Expr,
  FunctionDecl,
  FunctionExpr,
  Identifier,
  Stmt,
  Switch,
  VarDecl,
  With,
} from "../ast.js";
import { lookupBuiltin } from "../builtins.js";
import { tokenize, type Token } from "../lexer.js";
import type { FileAnalysis, MacroInfo } from "../project-symbols.js";
import type { Resolved } from "../symbols.js";
import {
  classify,
  jsLocalName,
  type Binding,
  type BindingEnv,
} from "./bindings.js";
import { gmlPragmaComment, isCallTo } from "./call.js";
import { emitExpr, unparen, withTargetCode } from "./expr.js";
import { emitAssign, emitUpdateStatement } from "./store.js";
import type {
  EmitDiagnostic,
  EmitDiagnosticKind,
  EmitOptions,
  EmitResult,
} from "./types.js";

/** A control-flow frame: decides what `other`, `break`, `argumentN` and `self` mean. */
type Frame =
  | {
      kind: "function";
      /** `self` is the struct being built/called (`this`), not the instance. */
      struct: boolean;
      /** Named parameters (JavaScript names). */
      params: readonly string[];
      /** How unnamed arguments are reached: a rest array, `arguments`, or not at all. */
      rest: "args" | "arguments" | undefined;
    }
  | { kind: "with" }
  | { kind: "loop" }
  | { kind: "switch" };

const INDENT = "  ";

function indentLines(code: string): string {
  return code
    .split("\n")
    .map((l) => (l === "" ? l : INDENT + l))
    .join("\n");
}

/** DnD "if" actions gate the statement that follows them. */
const GATING_ACTIONS: ReadonlySet<string> = new Set([
  "action_if_collision",
  "action_if_aligned",
  "action_if_empty",
]);

export class GmlEmitter implements BindingEnv {
  readonly diagnostics: EmitDiagnostic[] = [];
  readonly imports = new Map<string, string>();
  usesEnums = false;
  usesMotion = false;
  /** Declaration offset -> `gmlStatics` slot key. */
  private readonly staticKeys = new Map<number, string>();
  private staticCount = 0;
  private readonly frames: Frame[] = [];
  private readonly comments: Token[];
  private commentCursor = 0;

  constructor(
    readonly opts: EmitOptions,
    readonly analysis: FileAnalysis,
    readonly source: string,
  ) {
    this.comments = tokenize(source).filter(
      (t) => t.kind === "comment" || t.kind === "region",
    );
  }

  // ---- BindingEnv --------------------------------------------------------

  resolved(node: Identifier): Resolved | undefined {
    return this.analysis.resolve(node);
  }
  resolveOuter(name: string): Resolved {
    return this.opts.project.resolveOuter(name);
  }
  macro(name: string): MacroInfo | undefined {
    return this.opts.project.macros().get(name);
  }
  isGlobalVar(name: string): boolean {
    return this.opts.project.globalVars().has(name);
  }
  callable(name: string): string | undefined {
    return this.opts.callables.get(name);
  }

  bind(node: Identifier): Binding {
    const b = classify(this, node);
    if (b.kind === "local" && b.shadowed)
      this.note(
        "shadow",
        `local '${node.name}' hides ${b.shadowed.assetKind ?? b.shadowed.kind} '${node.name}'`,
        node,
      );
    return b;
  }

  // ---- context queries ---------------------------------------------------

  note(
    kind: EmitDiagnosticKind,
    message: string,
    at: { start: number; end: number },
  ): void {
    this.diagnostics.push({ kind, message, start: at.start, end: at.end });
  }

  /** Records that the emitted code references a project function's module. */
  useFunction(name: string, module: string): void {
    this.imports.set(name, module);
  }

  private fn(): Extract<Frame, { kind: "function" }> {
    for (let i = this.frames.length - 1; i >= 0; i--) {
      const f = this.frames[i];
      if (f?.kind === "function") return f;
    }
    throw new Error("emitter: no function frame");
  }

  /** True when `self` is a struct (`this`): inside a constructor or a struct literal's method. */
  selfIsStruct(): boolean {
    return this.fn().struct;
  }

  /** `other` is bound: in a collision event or inside a `with` body. */
  hasOther(): boolean {
    return (
      this.opts.kind === "collision" ||
      this.frames.some((f) => f.kind === "with")
    );
  }

  /** Emitted read of unnamed argument `index`, or undefined outside a function with rest arguments. */
  argument(index: number): string | undefined {
    const f = this.fn();
    const named = f.params[index];
    if (named !== undefined) return named;
    return f.rest === undefined ? undefined : `${f.rest}[${index}]`;
  }

  argumentArray(): string | undefined {
    return this.fn().rest;
  }

  /** The `gmlStatics` slot of the `static` declared at `declStart`. */
  staticKey(name: string, declStart: number): string {
    let key = this.staticKeys.get(declStart);
    if (key === undefined) {
      key = `${this.opts.functionId}::${name}::${this.staticCount++}`;
      this.staticKeys.set(declStart, key);
    }
    return key;
  }

  // ---- entry points ------------------------------------------------------

  /** Emits a list of top-level statements with `self` = the calling instance. */
  emitProgram(
    body: readonly Stmt[],
    rest: "args" | undefined = undefined,
    params: readonly string[] = [],
  ): string {
    this.frames.push({ kind: "function", struct: false, params, rest });
    const code = this.stmts(body, this.source.length);
    this.frames.pop();
    return code;
  }

  /** Emits the body of a script-level function (parameters already in scope). */
  emitFunctionBody(decl: FunctionDecl): string {
    this.commentCursor = this.firstCommentAtOrAfter(decl.body.start);
    this.frames.push({
      kind: "function",
      struct: decl.isConstructor,
      params: decl.params.map((p) => jsLocalName(p.name)),
      rest: decl.params.length === 0 ? "args" : undefined,
    });
    const code = this.stmts(decl.body.body, decl.body.end);
    this.frames.pop();
    return code;
  }

  result(code: string): EmitResult {
    return {
      code,
      imports: this.imports,
      usesEnums: this.usesEnums,
      usesMotion: this.usesMotion,
      diagnostics: this.diagnostics,
    };
  }

  // ---- comments ----------------------------------------------------------

  private firstCommentAtOrAfter(offset: number): number {
    let i = 0;
    while (i < this.comments.length && (this.comments[i]?.start ?? 0) < offset)
      i++;
    return i;
  }

  /** Source comments that end before `offset` and were not emitted yet, one per line. */
  private commentsBefore(offset: number): string[] {
    const out: string[] = [];
    while (this.commentCursor < this.comments.length) {
      const c = this.comments[this.commentCursor];
      if (!c || c.end > offset) break;
      this.commentCursor++;
      const text = c.text.trimEnd();
      if (c.kind === "region") out.push(`// ${text}`);
      // GameMaker lets a `/*` run to the end of the file; JavaScript does not.
      else if (text.startsWith("/*") && !text.endsWith("*/"))
        out.push(`${text} */`);
      else out.push(text);
    }
    return out;
  }

  // ---- statements --------------------------------------------------------

  /** Statements of one block; `end` bounds the comments that belong to it. */
  stmts(list: readonly Stmt[], end: number): string {
    const out: string[] = [];
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      if (!s) continue;
      out.push(...this.commentsBefore(s.start));
      const next = list[i + 1];
      const gate = this.gatingAction(s);
      if (gate !== undefined) {
        out.push(`if (${gate}) {`);
        if (next) {
          out.push(...this.commentsBefore(next.start));
          out.push(indentLines(this.stmt(next)));
          i++;
        }
        out.push("}");
        continue;
      }
      const repaired = this.repairBareCondition(s, next);
      if (repaired !== undefined) {
        out.push(repaired);
        i++;
        continue;
      }
      const code = this.stmt(s);
      if (code !== "") out.push(code);
    }
    out.push(...this.commentsBefore(end));
    return out.join("\n");
  }

  /** `action_if_*(...)` on its own line: the condition that gates the next statement. */
  private gatingAction(s: Stmt): string | undefined {
    if (s.type !== "ExprStmt" || s.expr.type !== "Call") return undefined;
    const callee = s.expr.callee;
    if (callee.type !== "Identifier" || !GATING_ACTIONS.has(callee.name))
      return undefined;
    return emitExpr(this, s.expr, "raw").code;
  }

  /**
   * A call directly followed by a brace block on the same line
   * (`place_free(x - 4, y) {x -= 4}`) is a condition missing its `if`;
   * GameMaker rejects it, so it can only be a source defect. Emitted as the
   * `if` it was meant to be, with a report entry.
   */
  private repairBareCondition(
    s: Stmt,
    next: Stmt | undefined,
  ): string | undefined {
    if (
      s.type !== "ExprStmt" ||
      s.expr.type !== "Call" ||
      next?.type !== "Block" ||
      this.source.slice(s.expr.end, next.start).includes("\n") ||
      this.source.slice(s.start, s.end).trimEnd().endsWith(";")
    )
      return undefined;
    this.note(
      "source-repair",
      "call followed by a block without 'if': emitted as an if statement",
      s,
    );
    return `if (${emitExpr(this, s.expr, "raw").code}) ${this.block(next)}`;
  }

  stmt(s: Stmt): string {
    switch (s.type) {
      case "VarDecl":
        return this.varDecl(s);
      case "ExprStmt":
        return this.exprStmt(s.expr);
      case "Block":
        return this.block(s);
      case "If": {
        const head = `if (${this.condition(s.test)}) ${this.body(s.cons)}`;
        return s.alt ? `${head} else ${this.body(s.alt)}` : head;
      }
      case "While":
        return `while (${this.condition(s.test)}) ${this.loopBody(s.body)}`;
      case "DoUntil":
        return `do ${this.loopBody(s.body)} while (!(${this.condition(s.test)}));`;
      case "For":
        return this.forStmt(s);
      case "Repeat":
        return `for (let _i = 0, _n = ${emitExpr(this, unparen(s.count), "num").code}; _i < _n; _i++) ${this.loopBody(s.body)}`;
      case "With":
        return this.withStmt(s);
      case "Switch":
        return this.switchStmt(s);
      case "Return":
        return this.returnStmt(s.arg, s);
      case "Exit":
        return this.returnStmt(undefined, s);
      case "Break":
        return this.jump("break", s);
      case "Continue":
        return this.jump("continue", s);
      case "Throw":
        return `throw ${emitExpr(this, s.arg, "raw").code};`;
      case "Try": {
        let code = `try ${this.block(s.block)}`;
        if (s.handler)
          code += ` catch (${s.param !== undefined ? jsLocalName(s.param) : "_err"}) ${this.block(s.handler)}`;
        if (s.finalizer) code += ` finally ${this.block(s.finalizer)}`;
        return code;
      }
      case "FunctionDecl":
        return this.functionCode(s);
      case "EnumDecl":
        return `// [enum ${s.name} — real values in gml-enums.generated.ts, imported as GmlEnums]`;
      case "MacroDecl":
        return `// #macro ${s.name} ${s.valueText} — value substituted at every use site`;
      case "Empty":
        return "";
      case "ErrorStmt":
        return this.errorStmt(s);
    }
  }

  /** A parenthesised statement header (`if`, `while`, `switch`): the source's own parentheses are not doubled. */
  private condition(e: Expr): string {
    return emitExpr(this, unparen(e), "raw").code;
  }

  private body(s: Stmt): string {
    return s.type === "Block"
      ? this.block(s)
      : this.block({ type: "Block", start: s.start, end: s.end, body: [s] });
  }

  block(b: Block): string {
    const inner = this.stmts(b.body, b.end);
    return inner === "" ? "{\n}" : `{\n${indentLines(inner)}\n}`;
  }

  private inFrame<T>(frame: Frame, run: () => T): T {
    this.frames.push(frame);
    try {
      return run();
    } finally {
      this.frames.pop();
    }
  }

  private loopBody(s: Stmt): string {
    return this.inFrame({ kind: "loop" }, () => this.body(s));
  }

  private exprStmt(e: Expr): string {
    if (isCallTo(e, "gml_pragma")) return gmlPragmaComment(this, e);
    return `${this.exprCode(e)};`;
  }

  /** An expression statement without its `;` (also a for-header clause). */
  private exprCode(e: Expr): string {
    if (e.type === "Assign") return emitAssign(this, e);
    if (e.type === "Update") return emitUpdateStatement(this, e);
    return emitExpr(this, e, "raw").code;
  }

  private varDecl(s: VarDecl): string {
    if (s.declKind === "globalvar")
      return `// globalvar ${s.decls.map((d) => d.name).join(", ")} — stored in the game's GlobalStore`;
    if (s.declKind === "static") return this.staticDecl(s);
    return `var ${this.declarators(s)};`;
  }

  declarators(s: VarDecl): string {
    return s.decls
      .map((d) => {
        if (!d.init) return jsLocalName(d.name);
        const init = emitExpr(this, d.init, "num").code;
        // A dynamic instance read has no static type; the local stays usable as any value.
        const makesInstance =
          d.init.type === "Call" &&
          d.init.callee.type === "Identifier" &&
          lookupBuiltin(d.init.callee.name)?.returns === "instance";
        const type =
          init.startsWith("GmlActions.getGml") || makesInstance ? ": any" : "";
        return `${jsLocalName(d.name)}${type} = ${init}`;
      })
      .join(", ");
  }

  /** `static n = v;` keeps one slot per declaration for the life of the game. */
  private staticDecl(s: VarDecl): string {
    const lines: string[] = [];
    for (const d of s.decls) {
      const key = JSON.stringify(this.staticKey(d.name, d.start));
      const init = d.init ? emitExpr(this, d.init, "num").code : "undefined";
      lines.push(
        `if (!(${key} in GmlActions.gmlStatics)) { GmlActions.gmlStatics[${key}] = ${init}; }`,
      );
    }
    return lines.join("\n");
  }

  private forStmt(s: Extract<Stmt, { type: "For" }>): string {
    const init = s.init ? this.inlineStmt(s.init) : "";
    const test = s.test ? emitExpr(this, s.test, "raw").code : "";
    const update = s.update ? this.inlineStmt(s.update) : "";
    return `for (${init}; ${test}; ${update}) ${this.loopBody(s.body)}`;
  }

  /** A for-header clause. */
  private inlineStmt(s: Stmt): string {
    if (s.type === "ExprStmt") return this.exprCode(s.expr);
    if (s.type === "VarDecl") return `var ${this.declarators(s)}`;
    return this.stmt(s);
  }

  private withStmt(s: With): string {
    const target = withTargetCode(this, s.target);
    const body = this.inFrame({ kind: "with" }, () =>
      this.stmts(s.body.type === "Block" ? s.body.body : [s.body], s.body.end),
    );
    return `{ const _withCaller = _entity; GmlActions.with_each(_ctx, ${target}, (_entity) => { const _other = _withCaller;\n${indentLines(body)}\n}); }`;
  }

  private switchStmt(s: Switch): string {
    const disc = this.condition(s.discriminant);
    const cases = this.inFrame({ kind: "switch" }, () =>
      s.cases.map((c) => {
        const head = c.test
          ? `case ${emitExpr(this, c.test, "raw").code}:`
          : "default:";
        const body = this.stmts(c.body, c.end);
        return body === "" ? head : `${head}\n${indentLines(body)}`;
      }),
    );
    return `switch (${disc}) {\n${indentLines(cases.join("\n"))}\n}`;
  }

  /** The innermost frame a `break`/`continue`/`return` crosses first. */
  private innermost(kinds: ReadonlySet<Frame["kind"]>): Frame | undefined {
    for (let i = this.frames.length - 1; i >= 0; i--) {
      const f = this.frames[i];
      if (f && kinds.has(f.kind)) return f;
    }
    return undefined;
  }

  private jump(word: "break" | "continue", at: Stmt): string {
    const target = this.innermost(
      new Set(
        word === "break"
          ? ["loop", "switch", "with", "function"]
          : ["loop", "with", "function"],
      ),
    );
    if (target?.kind === "with") {
      // The with body is a callback per instance: `continue` is exactly
      // `return`; `break` (stop iterating) is approximated by it.
      if (word === "break")
        this.note(
          "approximation",
          "'break' inside 'with' only ends the current instance",
          at,
        );
      return "return;";
    }
    return `${word};`;
  }

  private returnStmt(arg: Expr | undefined, at: Stmt): string {
    if (this.innermost(new Set(["with", "function"]))?.kind === "with")
      this.note(
        "approximation",
        "'exit'/'return' inside 'with' only ends the current instance",
        at,
      );
    return arg ? `return ${emitExpr(this, arg, "raw").code};` : "return;";
  }

  private errorStmt(s: Extract<Stmt, { type: "ErrorStmt" }>): string {
    this.note("parse", s.message, s);
    this.commentCursor = this.firstCommentAtOrAfter(s.end);
    const src = this.source.slice(s.start, s.end);
    return [
      `// [GML parse error: ${s.message} — statement not converted]`,
      ...src.split("\n").map((l) => `// ${l}`),
    ].join("\n");
  }

  // ---- functions ---------------------------------------------------------

  /** `function C() : P(args) constructor`: run the parent constructor on the new struct. */
  private parentCall(parent: { name: string; args: readonly Expr[] }): string {
    const args = parent.args.map((a) => emitExpr(this, a, "raw").code);
    const module = this.callable(parent.name);
    if (module === undefined)
      return `${jsLocalName(parent.name)}.call(this${args.map((a) => `, ${a}`).join("")});`;
    this.useFunction(parent.name, module);
    return `${parent.name}.call(this, _entity, _ctx${args.map((a) => `, ${a}`).join("")});`;
  }

  /** A nested function: a JavaScript `function`, so a method keeps its receiver as `this`. */
  functionCode(f: FunctionDecl | FunctionExpr, structSelf = false): string {
    const params = f.params
      .map((p) =>
        p.default
          ? `${jsLocalName(p.name)} = ${emitExpr(this, p.default, "raw").code}`
          : jsLocalName(p.name),
      )
      .join(", ");
    const body = this.inFrame(
      {
        kind: "function",
        struct: f.isConstructor || structSelf,
        params: f.params.map((p) => jsLocalName(p.name)),
        rest: f.params.length === 0 ? "arguments" : undefined,
      },
      () => {
        const parent =
          f.parent && f.isConstructor ? [this.parentCall(f.parent)] : [];
        const inner = this.stmts(f.body.body, f.body.end);
        return [...parent, inner].filter((x) => x !== "").join("\n");
      },
    );
    const name =
      f.type === "FunctionDecl"
        ? ` ${jsLocalName(f.name)}`
        : f.name
          ? ` ${jsLocalName(f.name)}`
          : "";
    return `function${name}(${params}) ${body === "" ? "{\n}" : `{\n${indentLines(body)}\n}`}`;
  }
}
