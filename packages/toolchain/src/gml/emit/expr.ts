/**
 * Expression lowering: every GML expression node becomes a `Piece` (code
 * plus the JavaScript precedence of its outermost operator). Reads of
 * dynamically typed values (instance variables, fields of other instances)
 * go through the compat accessors; `mode` decides whether a read is coerced
 * with `GmlActions.gmlNum`.
 */

import type {
  Binary,
  Expr,
  Identifier,
  Index,
  Literal,
  Member,
  StructLiteral,
  TemplateString,
} from "../ast.js";
import { parseExpression } from "../parser.js";
import { assetLiteral } from "../lower/assets.js";
import { builtinArray, builtinVar } from "../lower/builtin-vars.js";
import type { Binding } from "./bindings.js";
import { emitCall } from "./call.js";
import type { GmlEmitter } from "./emitter.js";
import { emitAssign, emitUpdateExpr } from "./store.js";
import { BINARY, PREC, type Piece, type ValueMode } from "./types.js";

const atom = (code: string): Piece => ({ code, prec: PREC.atom });
const call = (code: string): Piece => ({ code, prec: PREC.call });

/** `p`'s code, parenthesised unless it binds at least as tightly as `prec`. */
export function wrap(p: Piece, prec: number): string {
  return p.prec >= prec ? p.code : `(${p.code})`;
}

/** Emits `e` for a position that needs precedence `prec`. */
export function sub(
  em: GmlEmitter,
  e: Expr,
  prec: number,
  mode: ValueMode = "num",
): string {
  return wrap(emitExpr(em, e, mode), prec);
}

/** Coerces a dynamically typed read in a numeric position. */
function num(code: string, mode: ValueMode): Piece {
  return mode === "num" ? call(`GmlActions.gmlNum(${code})`) : call(code);
}

export function unparen(e: Expr): Expr {
  let x = e;
  while (x.type === "Paren") x = x.expr;
  return x;
}

export function emitExpr(em: GmlEmitter, e: Expr, mode: ValueMode): Piece {
  switch (e.type) {
    case "Literal":
      return literal(e);
    case "TemplateString":
      return atom(template(em, e));
    case "Identifier":
      return readIdentifier(em, e, em.bind(e), mode);
    case "Member":
      return readMember(em, e, mode);
    case "Index":
      return readIndex(em, e, mode);
    case "Call":
      return emitCall(em, e);
    case "New":
      return newExpr(em, e);
    case "Unary":
      return unary(em, e.op, e.arg);
    case "Update":
      return emitUpdateExpr(em, e);
    case "Binary":
      return binary(em, e);
    case "Assign":
      return { code: emitAssign(em, e), prec: PREC.assign };
    case "Conditional":
      return {
        code: `${sub(em, e.test, PREC.nullish + 1, "raw")} ? ${sub(em, e.cons, PREC.assign, mode)} : ${sub(em, e.alt, PREC.assign, mode)}`,
        prec: PREC.conditional,
      };
    case "ArrayLiteral":
      return atom(
        `[${e.elements.map((x) => sub(em, x, PREC.assign)).join(", ")}]`,
      );
    case "StructLiteral":
      return atom(struct(em, e));
    case "FunctionExpr":
      return { code: em.functionCode(e), prec: PREC.assign };
    case "Paren":
      return atom(`(${sub(em, e.expr, PREC.assign, mode)})`);
    case "Delete": {
      const target = unparen(e.arg);
      if (target.type === "Identifier")
        return atom(
          `(${readIdentifier(em, target, em.bind(target), "raw").code} = undefined)`,
        );
      return {
        code: `delete ${sub(em, e.arg, PREC.unary, "raw")}`,
        prec: PREC.unary,
      };
    }
  }
}

// ---- literals ------------------------------------------------------------

function literal(e: Literal): Piece {
  switch (e.litKind) {
    case "number":
      return atom(e.raw.startsWith("$") ? `0x${e.raw.slice(1)}` : e.raw);
    case "string":
      // GML escapes match JavaScript's; a raw newline inside quotes does not.
      return atom(
        e.raw.startsWith('"') && !/[\r\n]/.test(e.raw)
          ? e.raw
          : JSON.stringify(e.value),
      );
    case "verbatim":
      return atom(JSON.stringify(e.value));
    case "boolean":
      return atom(e.raw);
    case "undefined":
      return atom("undefined");
  }
}

function template(em: GmlEmitter, e: TemplateString): string {
  const parts = e.parts.map((p) =>
    p.kind === "text"
      ? p.raw.replace(/`/g, "\\`").replace(/\$\{/g, "\\${")
      : p.expr
        ? `\${${sub(em, p.expr, PREC.assign, "raw")}}`
        : "",
  );
  return `\`${parts.join("")}\``;
}

function struct(em: GmlEmitter, e: StructLiteral): string {
  if (e.props.length === 0) return "{}";
  const props = e.props.map((p) => {
    const key = /^[A-Za-z_$][\w$]*$/.test(p.key)
      ? p.key
      : JSON.stringify(p.key);
    const value =
      p.value.type === "FunctionExpr"
        ? em.functionCode(p.value, true)
        : sub(em, p.value, PREC.assign);
    return `${key}: ${value}`;
  });
  return `{ ${props.join(", ")} }`;
}

// ---- identifiers ---------------------------------------------------------

/** Read of the calling instance's variable `name` (`this.name` inside a struct). */
export function instanceRead(
  em: GmlEmitter,
  name: string,
  mode: ValueMode,
): Piece {
  if (em.selfIsStruct()) return call(`this.${name}`);
  return num(
    `GmlActions.getGmlVar(_entity, _ctx, ${JSON.stringify(name)})`,
    mode,
  );
}

export function globalRead(name: string, mode: ValueMode): Piece {
  const code = `_ctx.game?.globals.get(${JSON.stringify(name)})`;
  return mode === "num"
    ? call(`GmlActions.gmlNum(${code})`)
    : atom(`(${code})`);
}

const expanding = new Set<string>();

function macroValue(
  em: GmlEmitter,
  key: string,
  text: string,
  mode: ValueMode,
): Piece {
  const parsed = expanding.has(key) ? undefined : parseExpression(text);
  if (!parsed) return atom(`(${text})`);
  expanding.add(key);
  try {
    return atom(`(${sub(em, parsed, PREC.assign, mode)})`);
  } finally {
    expanding.delete(key);
  }
}

export function readIdentifier(
  em: GmlEmitter,
  node: Identifier,
  b: Binding,
  mode: ValueMode,
): Piece {
  switch (b.kind) {
    case "local":
      return atom(b.js);
    case "static": {
      const start = b.symbol.decl?.range[0] ?? node.start;
      return atom(
        `(GmlActions.gmlStatics[${JSON.stringify(em.staticKey(b.symbol.name, start))}])`,
      );
    }
    case "global":
      return globalRead(b.name, mode);
    case "self":
      return atom(em.selfIsStruct() ? "this" : "_entity");
    case "other":
      if (em.hasOther()) return atom("_other");
      em.note(
        "approximation",
        "'other' outside a collision event or 'with' is undefined",
        node,
      );
      return atom("undefined");
    case "noone":
      return atom("undefined");
    case "all":
      return atom('"all"');
    case "globalScope":
      em.note("approximation", "bare 'global' is not a value", node);
      return atom("undefined");
    case "argument": {
      const code = em.argument(b.index);
      if (code === undefined) return atom("undefined");
      return code.includes("[") ? num(code, mode) : atom(code);
    }
    case "argumentArray":
      return atom(em.argumentArray() ?? "[]");
    case "argumentCount": {
      const rest = em.argumentArray();
      return rest === undefined ? atom("0") : call(`${rest}.length`);
    }
    case "builtinVar":
      return call(b.v.read);
    case "constant":
      return call(`GmlActions.${b.name}`);
    case "literal":
      return atom(b.code);
    case "macro":
      return macroValue(em, b.info.key, b.info.valueText, mode);
    case "enum":
      em.usesEnums = true;
      return call(`GmlEnums.${b.name}`);
    case "asset":
      return atom(assetLiteral(b.symbol, em.opts.spriteFrames));
    case "function":
      em.useFunction(b.name, b.module);
      return atom(b.name);
    case "instance":
      return instanceRead(em, b.name, mode);
  }
}

// ---- dotted access -------------------------------------------------------

/** Where a dotted access on `obj` goes, decided from what `obj` is bound to. */
export type MemberBase =
  | { kind: "global" }
  | { kind: "self" }
  | { kind: "other" }
  | { kind: "enum"; name: string }
  | { kind: "object"; name: string }
  /** A local known to hold an instance, or any other value: `getGmlEntityField`. */
  | { kind: "value"; code: string }
  /** A local that is not an instance (a struct): plain property access. */
  | { kind: "plain"; code: string }
  /** An instance variable of the caller: `getGmlRefVar` resolves what it holds. */
  | { kind: "instanceVar"; name: string };

export function memberBase(em: GmlEmitter, objExpr: Expr): MemberBase {
  const obj = unparen(objExpr);
  if (obj.type !== "Identifier")
    return { kind: "value", code: sub(em, objExpr, PREC.assign, "raw") };
  const b = em.bind(obj);
  switch (b.kind) {
    case "globalScope":
      return { kind: "global" };
    case "self":
      return { kind: "self" };
    case "other":
      return { kind: "other" };
    case "enum":
      return { kind: "enum", name: b.name };
    case "asset":
      return b.symbol.assetKind === "object"
        ? { kind: "object", name: b.symbol.name }
        : { kind: "value", code: assetLiteral(b.symbol, em.opts.spriteFrames) };
    case "local":
      return b.symbol.holdsEntity === true
        ? { kind: "value", code: b.js }
        : { kind: "plain", code: b.js };
    case "instance":
      return em.selfIsStruct()
        ? { kind: "plain", code: `this.${b.name}` }
        : { kind: "instanceVar", name: b.name };
    default:
      return { kind: "value", code: readIdentifier(em, obj, b, "raw").code };
  }
}

function readMember(em: GmlEmitter, e: Member, mode: ValueMode): Piece {
  const base = memberBase(em, e.object);
  const p = JSON.stringify(e.property);
  switch (base.kind) {
    case "global":
      return globalRead(e.property, mode);
    case "self": {
      const v = builtinVar(e.property);
      if (v && !em.selfIsStruct()) return call(v.read);
      return instanceRead(em, e.property, mode);
    }
    case "other":
      if (!em.hasOther()) {
        em.note(
          "approximation",
          "'other' outside a collision event or 'with' is undefined",
          e,
        );
        return atom("undefined");
      }
      if (e.property === "id") return atom("_other");
      return num(`GmlActions.getGmlEntityField(_ctx, _other, ${p})`, mode);
    case "enum":
      em.usesEnums = true;
      return call(`GmlEnums.${base.name}.${e.property}`);
    case "object":
      return num(
        `GmlActions.getGmlObjectVar(_entity, _ctx, ${JSON.stringify(base.name)}, ${p})`,
        mode,
      );
    case "instanceVar":
      return num(
        `GmlActions.getGmlRefVar(_entity, _ctx, ${JSON.stringify(base.name)}, ${p})`,
        mode,
      );
    case "plain":
      return call(`${base.code}.${e.property}`);
    case "value":
      if (e.property === "id") return atom(base.code);
      return num(
        `GmlActions.getGmlEntityField(_ctx, ${base.code}, ${p})`,
        mode,
      );
  }
}

// ---- indexing ------------------------------------------------------------

/** `e` as an array: a local as-is, an instance variable through `getGmlArrayVar`, anything else through `gmlArr`. */
export function arrayOf(em: GmlEmitter, e: Expr): string {
  const x = unparen(e);
  if (x.type === "Identifier") {
    const b = em.bind(x);
    if (b.kind === "local") return b.js;
    if (b.kind === "instance" && !em.selfIsStruct())
      return `GmlActions.getGmlArrayVar(_entity, _ctx, ${JSON.stringify(b.name)})`;
  }
  return `GmlActions.gmlArr(${sub(em, e, PREC.assign, "raw")})`;
}

/** `e` as a `Map`: a local as-is, anything else through `gmlMap`. */
export function mapOf(em: GmlEmitter, e: Expr): string {
  const x = unparen(e);
  if (x.type === "Identifier") {
    const b = em.bind(x);
    if (b.kind === "local") return b.js;
  }
  return `GmlActions.gmlMap(${sub(em, e, PREC.assign, "raw")})`;
}

/** The instance a `target.alarm[n]` addresses, for the alarm accessors. */
export function alarmOwner(em: GmlEmitter, target: Expr): string {
  const base = memberBase(em, target);
  switch (base.kind) {
    case "object":
      return JSON.stringify(base.name);
    case "other":
      return em.hasOther() ? "_other" : "undefined";
    case "self":
      return "_entity";
    case "instanceVar":
      return `GmlActions.getGmlVar(_entity, _ctx, ${JSON.stringify(base.name)})`;
    case "global":
    case "enum":
      return "undefined";
    case "plain":
    case "value":
      return base.code;
  }
}

/** Index expressions of an access, each emitted as a number. */
export function indexCodes(em: GmlEmitter, e: Index): string[] {
  return e.indices.map((i) => sub(em, i, PREC.assign));
}

/** The key of a `[?` / `[$` access, emitted as-is (keys may be strings). */
export function keyCode(em: GmlEmitter, e: Index): string {
  const k = e.indices[0];
  return k ? sub(em, k, PREC.assign, "raw") : "undefined";
}

function readIndex(em: GmlEmitter, e: Index, mode: ValueMode): Piece {
  const idx = indexCodes(em, e);
  const obj = unparen(e.object);
  switch (e.accessor) {
    case "?":
      return call(`${mapOf(em, e.object)}.get(${keyCode(em, e)})`);
    case "$":
      return call(
        `GmlActions.getGmlEntityField(_ctx, ${sub(em, e.object, PREC.assign, "raw")}, ${keyCode(em, e)})`,
      );
    case "#":
      return call(
        `GmlActions.gmlArr(${arrayOf(em, e.object)}[${idx[0] ?? "0"}])[${idx[1] ?? "0"}]`,
      );
    default:
      break;
  }
  if (obj.type === "Identifier" && e.accessor !== "|") {
    const b = em.bind(obj);
    const rest = b.kind === "argumentArray" ? em.argumentArray() : undefined;
    if (rest !== undefined) return num(`${rest}[${idx[0] ?? "0"}]`, mode);
    const arr = b.kind === "local" ? undefined : builtinArray(obj.name);
    if (arr) return call(arr.read(idx[0] ?? "0"));
  }
  if (obj.type === "Member" && obj.property === "alarm" && e.accessor === "[") {
    return call(
      `GmlActions.gmlNum(GmlActions.get_gml_instance_alarm(_ctx, ${alarmOwner(em, obj.object)}, ${idx[0] ?? "0"}))`,
    );
  }
  let code = `${arrayOf(em, e.object)}[${idx[0] ?? "0"}]`;
  for (const i of idx.slice(1)) code = `GmlActions.gmlArr(${code})[${i}]`;
  return call(code);
}

// ---- operators -----------------------------------------------------------

function unary(em: GmlEmitter, op: string, arg: Expr): Piece {
  const mode: ValueMode = op === "!" ? "raw" : "num";
  const operand = sub(em, arg, PREC.unary, mode);
  const sep = (op === "-" || op === "+") && operand.startsWith(op) ? " " : "";
  return { code: `${op}${sep}${operand}`, prec: PREC.unary };
}

const LOGICAL = new Set(["||", "&&", "??"]);

function binary(em: GmlEmitter, e: Binary): Piece {
  if (e.op === "^^")
    return atom(
      `(Boolean(${sub(em, e.left, PREC.assign, "raw")}) !== Boolean(${sub(em, e.right, PREC.assign, "raw")}))`,
    );
  if (e.op === "div")
    return call(
      `Math.trunc(${sub(em, e.left, PREC.multiplicative)} / ${sub(em, e.right, PREC.multiplicative + 1)})`,
    );
  const info = BINARY[e.op] ?? {
    prec: PREC.equality,
    mode: "raw" as ValueMode,
  };
  const side = (x: Expr, prec: number): string => {
    const p = emitExpr(em, x, info.mode);
    // `??` cannot be mixed with `||`/`&&` without parentheses.
    const mixes =
      LOGICAL.has(e.op) &&
      x.type === "Binary" &&
      LOGICAL.has(x.op) &&
      x.op !== e.op &&
      (e.op === "??" || x.op === "??");
    return mixes ? `(${p.code})` : wrap(p, prec);
  };
  return {
    code: `${side(e.left, info.prec)} ${e.op} ${side(e.right, info.prec + 1)}`,
    prec: info.prec,
  };
}

function newExpr(em: GmlEmitter, e: Extract<Expr, { type: "New" }>): Piece {
  const args = e.args.map((a) => sub(em, a, PREC.assign));
  const callee = unparen(e.callee);
  if (callee.type === "Identifier") {
    const b = em.bind(callee);
    if (b.kind === "function") {
      em.useFunction(b.name, b.module);
      return call(`new ${b.name}(${["_entity", "_ctx", ...args].join(", ")})`);
    }
    if (b.kind === "local") return call(`new ${b.js}(${args.join(", ")})`);
    em.note(
      "unknown-call",
      `constructor '${callee.name}' is not defined in the project`,
      e,
    );
    return call(
      `new (GmlActions.gmlUnknown(${JSON.stringify(callee.name)}))(${args.join(", ")})`,
    );
  }
  return call(`new ${sub(em, e.callee, PREC.call, "raw")}(${args.join(", ")})`);
}

/** Target of `with (...)`: an object type by name, a special instance keyword, or an instance value. */
export function withTargetCode(em: GmlEmitter, target: Expr): string {
  const t = unparen(target);
  if (t.type === "Identifier") {
    const b = em.bind(t);
    switch (b.kind) {
      case "self":
        return em.selfIsStruct() ? "this" : "_entity";
      case "other":
        return em.hasOther() ? "_other" : "undefined";
      case "all":
        return '"all"';
      case "noone":
        return '"noone"';
      case "asset":
        return JSON.stringify(b.symbol.name);
      default:
        return readIdentifier(em, t, b, "raw").code;
    }
  }
  return sub(em, target, PREC.assign, "raw");
}
