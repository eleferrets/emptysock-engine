/**
 * Stores: `=`, compound assignments and `++`/`--`, for every kind of GML
 * target. One lowering per target kind; a compound store is always the
 * plain store of `read op (value)` built from that same target's read, so
 * `obj.hp -= d`, `global.n++`, `list[| i] += 1` and `view_xview += 4` are
 * all handled by construction rather than by a per-shape special case.
 */

import type { Assign, Expr, Index, Update } from "../ast.js";
import { builtinArray } from "../lower/builtin-vars.js";
import type { GmlEmitter } from "./emitter.js";
import {
  alarmOwner,
  arrayOf,
  emitExpr,
  indexCodes,
  keyCode,
  mapOf,
  memberBase,
  sub,
  unparen,
  wrap,
} from "./expr.js";
import { PREC, rightOperand, type Piece } from "./types.js";

/** A store target: how to read it and how to write a value to it. */
interface Target {
  /** The current value; `raw` skips the numeric coercion of a dynamic read. */
  read(mode?: "num" | "raw"): string;
  write(value: string): string;
  /** A native JavaScript lvalue (a local, a struct field) supports `op=` and `++` directly. */
  lvalue?: string;
  /** A dedicated compound store (component fields take `op=` in place). */
  compound?: (op: string, value: Piece) => string;
}

/** Operator of a compound assignment (`+=` -> `+`); undefined for `=`. */
function binaryOf(op: string): string | undefined {
  return op === "=" ? undefined : op.slice(0, -1);
}

function quoted(s: string): string {
  return JSON.stringify(s);
}

function dynamic(read: string, write: (v: string) => string): Target {
  return {
    read: (mode = "num") =>
      mode === "num" ? `GmlActions.gmlNum(${read})` : read,
    write,
  };
}

function instanceTarget(em: GmlEmitter, name: string): Target {
  if (em.selfIsStruct())
    return {
      read: () => `this.${name}`,
      write: (v) => `this.${name} = ${v}`,
      lvalue: `this.${name}`,
    };
  const get = `GmlActions.getGmlVar(_entity, _ctx, ${quoted(name)})`;
  return dynamic(
    get,
    (v) => `GmlActions.setGmlVar(_entity, _ctx, ${quoted(name)}, ${v})`,
  );
}

function globalTarget(name: string): Target {
  return dynamic(
    `_ctx.game?.globals.get(${quoted(name)})`,
    (v) => `_ctx.game?.globals.set(${quoted(name)}, ${v})`,
  );
}

function identifierTarget(
  em: GmlEmitter,
  e: Extract<Expr, { type: "Identifier" }>,
): Target {
  const b = em.bind(e);
  switch (b.kind) {
    case "local":
      return { read: () => b.js, write: (v) => `${b.js} = ${v}`, lvalue: b.js };
    case "static": {
      const slot = `GmlActions.gmlStatics[${quoted(em.staticKey(b.symbol.name, b.symbol.decl?.range[0] ?? e.start))}]`;
      return dynamic(slot, (v) => `${slot} = ${v}`);
    }
    case "global":
      return globalTarget(b.name);
    case "argument": {
      const slot = em.argument(b.index);
      if (slot !== undefined)
        return {
          read: () => slot,
          write: (v) => `${slot} = ${v}`,
          lvalue: slot,
        };
      break;
    }
    case "builtinVar": {
      const v = b.v;
      if (v.write && !em.selfIsStruct()) {
        const write = v.write;
        return {
          read: () => v.read,
          write: (x) => write(x),
          ...(v.compound ? { compound: v.compound } : {}),
        };
      }
      break;
    }
    default:
      break;
  }
  return instanceTarget(em, e.name);
}

function memberTarget(
  em: GmlEmitter,
  e: Extract<Expr, { type: "Member" }>,
): Target {
  const base = memberBase(em, e.object);
  const p = quoted(e.property);
  switch (base.kind) {
    case "global":
      return globalTarget(e.property);
    case "self":
      return identifierTarget(em, {
        type: "Identifier",
        name: e.property,
        start: e.propertyStart,
        end: e.end,
      });
    case "other":
      return dynamic(
        `GmlActions.getGmlEntityField(_ctx, _other, ${p})`,
        (v) => `GmlActions.setGmlEntityField(_ctx, _other, ${p}, ${v})`,
      );
    case "object":
      return dynamic(
        `GmlActions.getGmlObjectVar(_entity, _ctx, ${quoted(base.name)}, ${p})`,
        (v) =>
          `GmlActions.setGmlObjectVar(_entity, _ctx, ${quoted(base.name)}, ${p}, ${v})`,
      );
    case "instanceVar":
      return dynamic(
        `GmlActions.getGmlRefVar(_entity, _ctx, ${quoted(base.name)}, ${p})`,
        (v) =>
          `GmlActions.setGmlRefVar(_entity, _ctx, ${quoted(base.name)}, ${p}, ${v})`,
      );
    case "plain": {
      const lv = `${base.code}.${e.property}`;
      return { read: () => lv, write: (v) => `${lv} = ${v}`, lvalue: lv };
    }
    case "value":
    case "enum": {
      const obj = base.kind === "enum" ? `GmlEnums.${base.name}` : base.code;
      return dynamic(
        `GmlActions.getGmlEntityField(_ctx, ${obj}, ${p})`,
        (v) => `GmlActions.setGmlEntityField(_ctx, ${obj}, ${p}, ${v})`,
      );
    }
  }
}

function indexTarget(em: GmlEmitter, e: Index): Target {
  const idx = indexCodes(em, e);
  const first = idx[0] ?? "0";
  const obj = unparen(e.object);
  switch (e.accessor) {
    case "?": {
      const m = mapOf(em, e.object);
      const k = keyCode(em, e);
      return dynamic(`${m}.get(${k})`, (v) => `${m}.set(${k}, ${v})`);
    }
    case "$": {
      const s = sub(em, e.object, PREC.assign, "raw");
      const k = keyCode(em, e);
      return dynamic(
        `GmlActions.getGmlEntityField(_ctx, ${s}, ${k})`,
        (v) => `GmlActions.setGmlEntityField(_ctx, ${s}, ${k}, ${v})`,
      );
    }
    case "#": {
      const lv = `GmlActions.gmlArr(${arrayOf(em, e.object)}[${first}])[${idx[1] ?? "0"}]`;
      return dynamic(lv, (v) => `${lv} = ${v}`);
    }
    default:
      break;
  }
  const objBinding = obj.type === "Identifier" ? em.bind(obj) : undefined;
  const rest =
    objBinding?.kind === "argumentArray" ? em.argumentArray() : undefined;
  if (rest !== undefined) {
    const lv = `${rest}[${first}]`;
    return {
      read: () => `GmlActions.gmlNum(${lv})`,
      write: (v) => `${lv} = ${v}`,
      lvalue: lv,
    };
  }
  if (
    obj.type === "Identifier" &&
    e.accessor !== "|" &&
    objBinding?.kind !== "local"
  ) {
    const arr = builtinArray(obj.name);
    if (arr) {
      if (obj.name === "alarm") em.usesMotion = true;
      return { read: () => arr.read(first), write: (v) => arr.write(first, v) };
    }
  }
  if (obj.type === "Member" && obj.property === "alarm" && e.accessor === "[") {
    const owner = alarmOwner(em, obj.object);
    return {
      read: () =>
        `GmlActions.gmlNum(GmlActions.get_gml_instance_alarm(_ctx, ${owner}, ${first}))`,
      write: (v) =>
        `GmlActions.set_gml_instance_alarm(_ctx, ${owner}, ${first}, GmlActions.gmlNum(${v}))`,
    };
  }
  let lv = `${arrayOf(em, e.object)}[${first}]`;
  for (const i of idx.slice(1)) lv = `GmlActions.gmlArr(${lv})[${i}]`;
  return dynamic(lv, (v) => `${lv} = ${v}`);
}

function targetOf(em: GmlEmitter, e: Expr): Target | undefined {
  const t = unparen(e);
  switch (t.type) {
    case "Identifier":
      return identifierTarget(em, t);
    case "Member":
      return memberTarget(em, t);
    case "Index":
      return indexTarget(em, t);
    default:
      return undefined;
  }
}

/** `value` stored into `target` with GML operator `op` (`=`, `+=`, ...). */
function store(
  em: GmlEmitter,
  target: Expr,
  op: string,
  value: () => Piece,
): string {
  const t = targetOf(em, target);
  if (!t) {
    em.note(
      "approximation",
      "assignment to an expression that is not a variable",
      target,
    );
    return `/* not assignable */ ${value().code}`;
  }
  const bin = binaryOf(op);
  if (bin === undefined) return t.write(value().code);
  if (t.lvalue !== undefined) return `${t.lvalue} ${op} ${value().code}`;
  if (t.compound && bin !== "??") return t.compound(bin, value());
  if (bin === "??")
    return t.write(`${t.read("raw")} ?? ${wrap(value(), PREC.nullish + 1)}`);
  return t.write(`${t.read()} ${bin} ${rightOperand(bin, value())}`);
}

export function emitAssign(em: GmlEmitter, a: Assign): string {
  const mode = a.op === "=" ? "raw" : "num";
  return store(em, a.left, a.op, () => emitExpr(em, a.right, mode));
}

const ONE: Piece = { code: "1", prec: PREC.atom };

/** `x++;` / `--x;` as a statement: `x++` on a JavaScript lvalue, else a compound store of 1. */
export function emitUpdateStatement(em: GmlEmitter, u: Update): string {
  const t = targetOf(em, u.arg);
  if (t?.lvalue !== undefined) return `${t.lvalue}${u.op}`;
  return store(em, u.arg, u.op === "++" ? "+=" : "-=", () => ONE);
}

/** `++`/`--` whose value is used: native on a JavaScript lvalue, else the stored value (prefix) or it minus the step (postfix). */
export function emitUpdateExpr(em: GmlEmitter, u: Update): Piece {
  const t = targetOf(em, u.arg);
  if (t?.lvalue !== undefined)
    return u.prefix
      ? { code: `${u.op}${t.lvalue}`, prec: PREC.unary }
      : { code: `${t.lvalue}${u.op}`, prec: PREC.postfix };
  const stored = emitUpdateStatement(em, u);
  if (u.prefix)
    return { code: `GmlActions.gmlNum(${stored})`, prec: PREC.call };
  return {
    code: `GmlActions.gmlNum(${stored}) ${u.op === "++" ? "-" : "+"} 1`,
    prec: PREC.additive,
  };
}
