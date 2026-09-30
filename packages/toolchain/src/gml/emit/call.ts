/**
 * Call lowering. A callee resolves, in order, to: a lexical function, a
 * project (script-level) function, a GML built-in (inline lowering or a
 * threaded compat call), a callable value (`script_execute` semantics), or
 * nothing, in which case the call becomes a warning stub
 * (`GmlActions.gmlUnknown`) so a missing built-in never throws
 * `ReferenceError` at runtime.
 */

import type { Call, Expr } from "../ast.js";
import { lookupBuiltin, type ParamKind } from "../builtins.js";
import { builtinCallLowering, type CallSite } from "../lower/builtin-calls.js";
import { assetLiteral } from "../lower/assets.js";
import { COMPAT_PARAM_KINDS } from "../lower/compat-signatures.js";
import type { AssetKind } from "../symbols.js";
import type { GmlEmitter } from "./emitter.js";
import { arrayOf, emitExpr, mapOf, memberBase, sub, unparen } from "./expr.js";
import { PREC, type Piece } from "./types.js";

const call = (code: string): Piece => ({ code, prec: PREC.call });

/** DnD actions whose side table `gmlActionsStep` must tick every Step. */
const MOTION_ACTIONS: ReadonlySet<string> = new Set([
  "action_move",
  "action_move_to",
  "action_set_alarm",
]);

export function isCallTo(e: Expr, name: string): e is Call {
  return (
    e.type === "Call" &&
    e.callee.type === "Identifier" &&
    e.callee.name === name
  );
}

/** `gml_pragma(...)` is a compile-time directive: nothing runs. */
export function gmlPragmaComment(em: GmlEmitter, e: Call): string {
  return `// ${em.source.slice(e.start, e.end).replace(/\s+/g, " ")} — compile-time directive, nothing to run`;
}

function makeSite(em: GmlEmitter, args: readonly Expr[]): CallSite {
  const argAt = (i: number): Expr | undefined => args[i];
  return {
    argc: args.length,
    arg(i, prec = PREC.assign, mode = "num") {
      const a = argAt(i);
      return a ? sub(em, a, prec, mode) : "";
    },
    rest(from, mode = "num") {
      return args.slice(from).map((a) => sub(em, a, PREC.assign, mode));
    },
    asset(i, kind) {
      const a = argAt(i);
      return a ? assetArg(em, a, kind) : "";
    },
    array(i) {
      const a = argAt(i);
      return a ? arrayOf(em, a) : "[]";
    },
    map(i) {
      const a = argAt(i);
      return a ? mapOf(em, a) : "new Map()";
    },
  };
}

/** An argument naming an asset of `kind` becomes that asset's literal; `all`/`noone` their marker strings. */
function assetArg(em: GmlEmitter, a: Expr, kind: AssetKind): string {
  const x = unparen(a);
  if (x.type === "Identifier") {
    const b = em.bind(x);
    if (
      b.kind === "asset" &&
      (b.symbol.assetKind === kind || b.symbol.missing === true)
    )
      return assetLiteral(b.symbol, em.opts.spriteFrames);
    if (kind === "object" && (b.kind === "all" || b.kind === "noone"))
      return JSON.stringify(b.kind);
  }
  // Not a literal asset name: a runtime value. Every asset kind but objects is
  // addressed by string (sprites by texture path), so it is read as one.
  if (kind === "object") return sub(em, a, PREC.assign, "raw");
  return `(${sub(em, a, PREC.assign, "raw")} as unknown as string)`;
}

const COMPARISON = new Set(["==", "!=", "<", ">", "<=", ">="]);

/**
 * An argument read as the kind the compat function declares: GML passes a
 * number where a boolean is meant (`0`/`1`, or any truthy value) and a runtime
 * value where a string is meant, which TypeScript would otherwise reject.
 */
function coerceArg(
  em: GmlEmitter,
  a: Expr,
  declared: string | undefined,
): string {
  const x = unparen(a);
  if (declared === "boolean") {
    if (x.type === "Literal" && x.litKind === "boolean") return x.raw;
    if (x.type === "Literal" && x.litKind === "number")
      return x.value !== 0 ? "true" : "false";
    if (
      (x.type === "Binary" && COMPARISON.has(x.op)) ||
      (x.type === "Unary" && x.op === "!")
    )
      return sub(em, a, PREC.assign);
    return `!!(${sub(em, a, PREC.assign)})`;
  }
  if (declared === "array") return arrayOf(em, a);
  if (declared === "string") {
    if (x.type === "Literal" && x.litKind === "string")
      return sub(em, a, PREC.assign);
    return `(${sub(em, a, PREC.assign, "raw")} as unknown as string)`;
  }
  return sub(em, a, PREC.assign);
}

function paramAsset(p: ParamKind | undefined): AssetKind | undefined {
  return p === undefined ? undefined : (p.slice("asset:".length) as AssetKind);
}

/** A threaded compat call from the built-in table, or undefined when `name` has no compat export. */
function threadedCall(
  em: GmlEmitter,
  name: string,
  args: readonly Expr[],
): Piece | undefined {
  const info = lookupBuiltin(name);
  if (info?.threading === undefined) return undefined;
  if (MOTION_ACTIONS.has(name)) em.usesMotion = true;
  const prefix =
    info.threading === "entity+ctx"
      ? ["_entity", "_ctx"]
      : info.threading === "ctx"
        ? ["_ctx"]
        : info.threading === "entity"
          ? ["_entity"]
          : [];
  const declared = COMPAT_PARAM_KINDS[name]?.split(",");
  const emitted = args.map((a, i) => {
    const kind = paramAsset(info.params?.[i]);
    return kind ? assetArg(em, a, kind) : coerceArg(em, a, declared?.[i]);
  });
  return call(`GmlActions.${name}(${[...prefix, ...emitted].join(", ")})`);
}

/** Calls handled before the tables: they need the emitter's context, not just their arguments. */
function contextualCall(
  em: GmlEmitter,
  e: Call,
  name: string,
): Piece | undefined {
  switch (name) {
    case "event_inherited": {
      const code = em.opts.inherited?.();
      if (code !== undefined) return call(code);
      em.note(
        "approximation",
        "event_inherited() without a parent event does nothing",
        e,
      );
      return call("undefined");
    }
    case "gml_pragma":
      return call("undefined");
    case "script_execute": {
      const [target, ...rest] = e.args;
      if (!target) return call("undefined");
      const t = unparen(target);
      if (t.type === "Identifier") {
        const b = em.bind(t);
        if (b.kind === "function")
          return scriptCall(em, b.name, b.module, rest);
      }
      return dynamicCall(em, sub(em, target, PREC.assign, "raw"), rest);
    }
    case "method": {
      const fn = e.args[1];
      em.note("approximation", "method() keeps the function's own binding", e);
      return fn ? emitExpr(em, fn, "raw") : call("undefined");
    }
    case "instance_create_depth": {
      // The engine has no depth-ordered creation: the depth is not applied and
      // a placeholder layer name stands in (instance_create_layer ignores it).
      const site = makeSite(em, e.args);
      return call(
        `GmlActions.instance_create_layer(_entity, _ctx, ${site.arg(0)}, ${site.arg(1)}, "Instances", ${site.asset(3, "object")})`,
      );
    }
    default:
      return undefined;
  }
}

function scriptCall(
  em: GmlEmitter,
  name: string,
  module: string,
  args: readonly Expr[],
): Piece {
  em.useFunction(name, module);
  const emitted = args.map((a) => sub(em, a, PREC.assign));
  return call(`${name}(${["_entity", "_ctx", ...emitted].join(", ")})`);
}

/** A call through a value: a script function gets the caller's context, a method value just its arguments. */
function dynamicCall(em: GmlEmitter, fn: string, args: readonly Expr[]): Piece {
  const emitted = args.map((a) => sub(em, a, PREC.assign));
  return call(
    `GmlActions.script_execute(${["_entity", "_ctx", fn, ...emitted].join(", ")})`,
  );
}

function methodCall(
  em: GmlEmitter,
  e: Call,
  obj: Expr,
  property: string,
): Piece {
  const base = memberBase(em, obj);
  const args = e.args.map((a) => sub(em, a, PREC.assign)).join(", ");
  switch (base.kind) {
    case "plain":
    case "value":
      return call(`${base.code}.${property}(${args})`);
    case "instanceVar":
      return call(
        `GmlActions.getGmlVar(_entity, _ctx, ${JSON.stringify(base.name)}).${property}(${args})`,
      );
    case "global":
      return dynamicCall(
        em,
        `_ctx.game?.globals.get(${JSON.stringify(property)})`,
        e.args,
      );
    case "enum":
      em.usesEnums = true;
      return call(`GmlEnums.${base.name}.${property}(${args})`);
    default:
      // A method stored on another instance: fetch it, then call it.
      return dynamicCall(em, emitExpr(em, e.callee, "raw").code, e.args);
  }
}

export function emitCall(em: GmlEmitter, e: Call): Piece {
  const callee = unparen(e.callee);
  if (callee.type === "Member")
    return methodCall(em, e, callee.object, callee.property);
  if (callee.type !== "Identifier")
    return dynamicCall(em, sub(em, e.callee, PREC.call, "raw"), e.args);
  const name = callee.name;
  const b = em.bind(callee);
  if (b.kind === "local")
    return call(
      `${b.js}(${e.args.map((a) => sub(em, a, PREC.assign)).join(", ")})`,
    );
  if (b.kind === "function") return scriptCall(em, b.name, b.module, e.args);
  const contextual = contextualCall(em, e, name);
  if (contextual) return contextual;
  const lowering = builtinCallLowering(name);
  if (lowering) return lowering(makeSite(em, e.args));
  const threaded = threadedCall(em, name, e.args);
  if (threaded) return threaded;
  const via = em.resolved(callee)?.via;
  if (b.kind === "instance" && (via === "instance" || via === "with"))
    return dynamicCall(
      em,
      `GmlActions.getGmlVar(_entity, _ctx, ${JSON.stringify(name)})`,
      e.args,
    );
  if (b.kind === "global" || b.kind === "static")
    return dynamicCall(em, emitExpr(em, callee, "raw").code, e.args);
  em.note(
    "unknown-call",
    `'${name}' is not a project function or a supported GameMaker built-in`,
    e,
  );
  const args = e.args.map((a) => sub(em, a, PREC.assign)).join(", ");
  return call(`GmlActions.gmlUnknown(${JSON.stringify(name)})(${args})`);
}
