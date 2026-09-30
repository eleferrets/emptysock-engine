/**
 * What a bare GML identifier refers to, decided once per reference in GML's
 * own resolution order: lexical binding (local, parameter, static,
 * `globalvar`, nested function) -> scope keywords (`self`, `other`, `id`,
 * ...) and legacy `argument*` -> engine-backed built-in variables and
 * constants -> the calling instance's known fields -> project symbols
 * (macro, enum, asset, script function) -> an instance variable.
 *
 * The last step is GameMaker's rule, not a guess: any name that is nothing
 * else is a variable of `self`.
 */

import type { Identifier } from "../ast.js";
import { lookupBuiltin } from "../builtins.js";
import type { MacroInfo } from "../project-symbols.js";
import type { Resolved, Symbol } from "../symbols.js";
import { builtinVar, type BuiltinVar } from "../lower/builtin-vars.js";

export type Binding =
  | { kind: "local"; js: string; symbol: Symbol; shadowed?: Symbol }
  | { kind: "static"; symbol: Symbol }
  | { kind: "global"; name: string }
  | { kind: "self" }
  | { kind: "other" }
  | { kind: "noone" }
  | { kind: "all" }
  | { kind: "globalScope" }
  | { kind: "argument"; index: number }
  | { kind: "argumentArray" }
  | { kind: "argumentCount" }
  | { kind: "builtinVar"; name: string; v: BuiltinVar }
  | { kind: "constant"; name: string }
  /** A built-in value with a direct JavaScript spelling (`infinity`, `NaN`). */
  | { kind: "literal"; code: string }
  | { kind: "macro"; info: MacroInfo }
  | { kind: "enum"; name: string }
  | { kind: "asset"; symbol: Symbol }
  | { kind: "function"; name: string; module: string }
  | { kind: "instance"; name: string };

/** Names the emitted code itself declares or relies on; a GML local of the same name is renamed. */
const INTERNAL_NAMES: ReadonlySet<string> = new Set([
  "_entity",
  "_ctx",
  "_other",
  "_withCaller",
  "_dt",
  "_t",
  "_sp",
  "_tl",
  "_bl",
  "_bb",
  "_gg",
  "_rr",
  "_gmlDepth",
  "_i",
  "_n",
  "args",
  "GmlActions",
  "GmlEnums",
  "Math",
  "String",
  "Array",
  "Map",
  "Number",
  "Object",
  "JSON",
  "console",
]);

/** JavaScript words that cannot be a binding name in a strict-mode module. */
const JS_RESERVED: ReadonlySet<string> = new Set([
  "arguments",
  "eval",
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "enum",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "function",
  "if",
  "implements",
  "import",
  "in",
  "instanceof",
  "interface",
  "let",
  "new",
  "null",
  "package",
  "private",
  "protected",
  "public",
  "return",
  "static",
  "super",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "typeof",
  "undefined",
  "var",
  "void",
  "while",
  "with",
  "yield",
  "NaN",
  "Infinity",
]);

/** JavaScript name of a GML lexical binding. */
export function jsLocalName(name: string): string {
  return INTERNAL_NAMES.has(name) || JS_RESERVED.has(name)
    ? `_gml_${name}`
    : name;
}

const ARGUMENT_N = /^argument(\d+)$/;

/** Inputs the classifier needs from the emitter. */
export interface BindingEnv {
  /** Resolution computed by `ProjectSymbols.analyze`, undefined for synthetic nodes (macro bodies). */
  resolved(node: Identifier): Resolved | undefined;
  resolveOuter(name: string): Resolved;
  macro(name: string): MacroInfo | undefined;
  /** `globalvar` names declared anywhere in the project. */
  isGlobalVar(name: string): boolean;
  /** Project function name -> exporting script module. */
  callable(name: string): string | undefined;
}

export function classify(env: BindingEnv, node: Identifier): Binding {
  const name = node.name;
  const r = env.resolved(node);
  if (r?.via === "lexical" && r.symbol) {
    const sym = r.symbol;
    if (sym.kind === "static") return { kind: "static", symbol: sym };
    if (sym.kind === "global") return { kind: "global", name };
    return {
      kind: "local",
      js: jsLocalName(name),
      symbol: sym,
      ...(r.shadowed?.[0] ? { shadowed: r.shadowed[0] } : {}),
    };
  }
  switch (name) {
    case "self":
    case "id":
      return { kind: "self" };
    case "other":
      return { kind: "other" };
    case "noone":
      return { kind: "noone" };
    case "all":
      return { kind: "all" };
    case "global":
      return { kind: "globalScope" };
    case "argument":
      return { kind: "argumentArray" };
    case "argument_count":
      return { kind: "argumentCount" };
    case "infinity":
      return { kind: "literal", code: "Infinity" };
    case "NaN":
      return { kind: "literal", code: "NaN" };
    default:
      break;
  }
  const argN = ARGUMENT_N.exec(name);
  if (argN) return { kind: "argument", index: Number(argN[1]) };
  const v = builtinVar(name);
  if (v) return { kind: "builtinVar", name, v };
  const b = lookupBuiltin(name);
  if (b?.kind === "constant" && b.runtimeExport === true)
    return { kind: "constant", name };
  if (r?.via === "instance" || r?.via === "with")
    return { kind: "instance", name };
  if (env.isGlobalVar(name)) return { kind: "global", name };
  const module = env.callable(name);
  if (module !== undefined) return { kind: "function", name, module };
  const outer = r?.via === "project" ? r : env.resolveOuter(name);
  const sym = outer.via === "project" ? outer.symbol : undefined;
  if (sym?.kind === "macro") {
    const info = env.macro(name);
    if (info) return { kind: "macro", info };
  }
  if (sym?.kind === "enum") return { kind: "enum", name };
  if (sym?.kind === "asset") return { kind: "asset", symbol: sym };
  return { kind: "instance", name };
}
