/**
 * Types shared by the GML -> TypeScript emitter modules.
 *
 * Emitted code runs inside a generated function whose calling instance is
 * `_entity` and whose action context is `_ctx`; compat calls go through the
 * `GmlActions` namespace import and project enums through `GmlEnums`.
 */

import type { ProjectSymbols } from "../project-symbols.js";

/** What kind of generated function a GML body becomes. */
export type BodyKind =
  /** An object event: `(_entity, _ctx)`. */
  | "event"
  /** A collision event: `(_entity, _other, _ctx)`; `other` is `_other`. */
  | "collision"
  /** A script-level function: `(_entity, _ctx, ...params)`. */
  | "script";

export interface EmitOptions {
  project: ProjectSymbols;
  kind: BodyKind;
  /** Object whose event this is (its `self`), for events and collisions. */
  object?: string;
  /** Namespace of this body's `static` slots (unique per generated function). */
  functionId: string;
  /** Callable project functions: function name -> script module that exports it. */
  callables: ReadonlyMap<string, string>;
  /**
   * Emits the call `event_inherited()` becomes (the parent object's handler
   * for this event), or undefined when the object has no parent handler.
   */
  inherited?: () => string | undefined;
  /** Frame count per sprite asset; a multi-frame sprite's texture path is `frame_{n}.png`. */
  spriteFrames?: ReadonlyMap<string, number>;
  /** Source path used in diagnostics. */
  path?: string;
}

export type EmitDiagnosticKind =
  /** A statement that did not parse; emitted as a comment. */
  | "parse"
  /** A call to a name with no project or runtime definition. */
  | "unknown-call"
  /** A lexical binding hides a project asset of the same name. */
  | "shadow"
  /** A construct emitted as an approximation (e.g. `break` inside `with`). */
  | "approximation"
  /** A known source defect repaired before emission. */
  | "source-repair"
  /** A dotted access on a value whose instance type is unknown. */
  | "dynamic-access";

export interface EmitDiagnostic {
  kind: EmitDiagnosticKind;
  message: string;
  start: number;
  end: number;
}

/** An emitted expression with the JavaScript precedence of its outermost operator. */
export interface Piece {
  code: string;
  prec: number;
}

/**
 * JavaScript precedence levels used to parenthesise emitted expressions.
 * Higher binds tighter.
 */
export const PREC = {
  assign: 2,
  conditional: 3,
  nullish: 4,
  or: 4,
  and: 5,
  bitOr: 6,
  bitXor: 7,
  bitAnd: 8,
  equality: 9,
  relational: 10,
  shift: 11,
  additive: 12,
  multiplicative: 13,
  unary: 15,
  postfix: 16,
  call: 17,
  atom: 18,
} as const;

/**
 * How a read is used: `num` wraps dynamically typed values in
 * `GmlActions.gmlNum` (arithmetic, arguments, stored values), `raw` keeps
 * them untouched (indexed, dotted, called, compared for identity).
 */
export type ValueMode = "num" | "raw";

export interface EmitResult {
  code: string;
  /** Script modules this body calls or references (`import { f } from "./<module>.js"`). */
  imports: ReadonlyMap<string, string>;
  usesEnums: boolean;
  /** Uses a DnD motion/alarm action that needs `gmlActionsStep` every Step. */
  usesMotion: boolean;
  diagnostics: readonly EmitDiagnostic[];
}

/** JavaScript precedence of each GML binary operator and how its operands are read. */
export const BINARY: Readonly<
  Record<string, { prec: number; mode: ValueMode }>
> = {
  "||": { prec: PREC.or, mode: "raw" },
  "&&": { prec: PREC.and, mode: "raw" },
  "??": { prec: PREC.nullish, mode: "raw" },
  "|": { prec: PREC.bitOr, mode: "num" },
  "^": { prec: PREC.bitXor, mode: "num" },
  "&": { prec: PREC.bitAnd, mode: "num" },
  "==": { prec: PREC.equality, mode: "raw" },
  "!=": { prec: PREC.equality, mode: "raw" },
  "<": { prec: PREC.relational, mode: "num" },
  ">": { prec: PREC.relational, mode: "num" },
  "<=": { prec: PREC.relational, mode: "num" },
  ">=": { prec: PREC.relational, mode: "num" },
  "<<": { prec: PREC.shift, mode: "num" },
  ">>": { prec: PREC.shift, mode: "num" },
  "+": { prec: PREC.additive, mode: "num" },
  "-": { prec: PREC.additive, mode: "num" },
  "*": { prec: PREC.multiplicative, mode: "num" },
  "/": { prec: PREC.multiplicative, mode: "num" },
  "%": { prec: PREC.multiplicative, mode: "num" },
};

/** JavaScript precedence of binary operator `op`. */
export function binaryPrec(op: string): number {
  return BINARY[op]?.prec ?? PREC.equality;
}

/** `value` as the right operand of binary operator `op`, parenthesised when needed. */
export function rightOperand(op: string, value: Piece): string {
  return value.prec > binaryPrec(op) ? value.code : `(${value.code})`;
}
