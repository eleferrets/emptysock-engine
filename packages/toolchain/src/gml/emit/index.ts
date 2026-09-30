/**
 * GML -> TypeScript emitter: parse (via `ProjectSymbols.analyze`), resolve,
 * emit. Pure functions of their inputs; no module-level state.
 */

import type { Expr, FunctionDecl, Stmt } from "../ast.js";
import { someNode, walk } from "../walk.js";
import type { SourceFile } from "../project-symbols.js";
import { GmlEmitter } from "./emitter.js";
import type { EmitOptions, EmitResult } from "./types.js";

export type { EmitOptions, EmitResult, EmitDiagnostic } from "./types.js";

/** Emits one object event (or any statement list run with `self` = the calling instance). */
export function emitEvent(file: SourceFile, opts: EmitOptions): EmitResult {
  const analysis = opts.project.analyze(file);
  const em = new GmlEmitter(opts, analysis, file.text);
  return em.result(em.emitProgram(analysis.ast.body));
}

/** Declared type of a script parameter in the generated signature. */
export type ParamType = "number" | "string" | "string | number" | "any[]";

export interface ScriptFunction {
  name: string;
  params: ReadonlyArray<{ name: string; type: ParamType }>;
  /** True when the function takes no named parameters (`...args`). */
  restArgs: boolean;
  isConstructor: boolean;
  returnsValue: boolean;
  body: string;
}

export interface ScriptEmit extends Omit<EmitResult, "code"> {
  /** Exported functions, in source order. A legacy script (no `function`) is one function named after the file. */
  functions: ScriptFunction[];
  /** Top-level statements outside any function (they would run at game start); not emitted. */
  droppedStatements: number;
}

/** A `return <value>` in `body` itself (nested functions excluded). */
function returnsValue(body: readonly Stmt[]): boolean {
  return someNode(body, (n) => n.type === "Return" && n.arg !== undefined);
}

/**
 * Parameter types: `number` by default (GML script parameters are
 * overwhelmingly numeric), `string` for one forwarded bare into
 * `draw_set_font`, `string | number` for one tested with `is_string`
 * (directly or through a `var` copy).
 */
function paramTypes(decl: FunctionDecl): Map<string, ParamType> {
  const types = new Map<string, ParamType>(
    decl.params.map((p) => [p.name, "number"]),
  );
  const aliases = new Map<string, string>();
  walk(decl.body, (n) => {
    if (n.type === "VarDecl")
      for (const d of n.decls)
        if (d.init?.type === "Identifier" && types.has(d.init.name))
          aliases.set(d.name, d.init.name);
  });
  const paramOf = (e: Expr): string | undefined =>
    e.type === "Identifier"
      ? types.has(e.name)
        ? e.name
        : aliases.get(e.name)
      : undefined;
  walk(decl.body, (n) => {
    // A parameter indexed with `[i]`, or handed to an array_* function, is an array.
    if (n.type === "Index" && n.accessor === "[") {
      const p = paramOf(n.object);
      if (p !== undefined) types.set(p, "any[]");
    }
    if (
      n.type === "Call" &&
      n.callee.type === "Identifier" &&
      n.callee.name.startsWith("array_") &&
      n.args[0]
    ) {
      const p = paramOf(n.args[0]);
      if (p !== undefined) types.set(p, "any[]");
    }
  });
  walk(decl.body, (n) => {
    if (n.type !== "Call" || n.callee.type !== "Identifier") return;
    const a = n.args[0];
    if (a?.type !== "Identifier") return;
    const p = types.has(a.name) ? a.name : aliases.get(a.name);
    if (p === undefined) return;
    if (n.callee.name === "draw_set_font" && a.name === p)
      types.set(p, "string");
    if (n.callee.name === "is_string") types.set(p, "string | number");
  });
  return types;
}

/**
 * Emits a script file: every top-level `function` becomes an exported
 * function taking the caller's `(_entity, _ctx)` first; a legacy script
 * (no `function` at all) is one function over the whole file with
 * `...args`.
 */
export function emitScript(
  name: string,
  file: SourceFile,
  opts: EmitOptions,
): ScriptEmit {
  const analysis = opts.project.analyze(file);
  const em = new GmlEmitter(opts, analysis, file.text);
  const decls = analysis.ast.body.filter(
    (s): s is FunctionDecl => s.type === "FunctionDecl",
  );
  let functions: ScriptFunction[];
  if (decls.length === 0) {
    functions = [
      {
        name,
        params: [],
        restArgs: true,
        isConstructor: false,
        returnsValue: returnsValue(analysis.ast.body),
        body: em.emitProgram(analysis.ast.body, "args"),
      },
    ];
  } else {
    functions = decls.map((d) => {
      const types = paramTypes(d);
      return {
        name: d.name,
        params: d.params.map((p) => ({
          name: p.name,
          type: types.get(p.name) ?? "number",
        })),
        restArgs: d.params.length === 0,
        isConstructor: d.isConstructor,
        returnsValue: returnsValue(d.body.body),
        body: em.emitFunctionBody(d),
      };
    });
  }
  const r = em.result("");
  return {
    functions,
    droppedStatements:
      decls.length === 0
        ? 0
        : analysis.ast.body.filter(
            (s) =>
              s.type !== "FunctionDecl" &&
              s.type !== "Empty" &&
              s.type !== "MacroDecl" &&
              s.type !== "EnumDecl",
          ).length,
    imports: r.imports,
    usesEnums: r.usesEnums,
    usesMotion: r.usesMotion,
    diagnostics: r.diagnostics,
  };
}
