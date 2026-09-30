/**
 * GML built-in table: the single source of truth for "is this name a language
 * or runtime built-in, and what does it mean positionally" that used to be
 * scattered across name lists in the former regex transpiler and gms2-source-bugs.ts.
 *
 * Standard library only. Data lives in builtins-data.ts.
 */

import { GML_KEYWORDS, GML_SPECIAL_IDENTS } from "./lexer.js";
import * as D from "./builtins-data.js";

export type BuiltinKind =
  "function" | "variable" | "constant" | "keyword" | "special";

/** What an argument position means to the transpiler. */
export type ParamKind =
  | "asset:object"
  | "asset:sprite"
  | "asset:sound"
  | "asset:room"
  | "asset:shader"
  | "asset:font";

/** How the transpiler threads the calling context into a compat call. */
export type Threading =
  /** `Compat.fn(_entity, _ctx, ...args)` */
  | "entity+ctx"
  /** `Compat.fn(_ctx, ...args)` */
  | "ctx"
  /** `Compat.fn(_entity, ...args)` */
  | "entity"
  /** `Compat.fn(...args)` */
  | "pure";

export interface BuiltinInfo {
  name: string;
  kind: BuiltinKind;
  threading?: Threading;
  /** Argument index -> meaning. */
  params?: Readonly<Record<number, ParamKind>>;
  /** Return type worth tracking for entity dataflow. */
  returns?: "instance";
  /** True when the value is a compat export emitted as `GmlActions.<name>`. */
  runtimeExport?: boolean;
}

const table = new Map<string, BuiltinInfo>();

function put(info: BuiltinInfo): void {
  const prev = table.get(info.name);
  table.set(
    info.name,
    prev
      ? { ...prev, ...info, params: { ...prev.params, ...info.params } }
      : info,
  );
}

for (const k of GML_KEYWORDS) put({ name: k, kind: "keyword" });
for (const k of GML_SPECIAL_IDENTS) put({ name: k, kind: "special" });
for (const n of D.BUILTIN_VARIABLES)
  if (!table.has(n)) put({ name: n, kind: "variable" });

const threaded: Array<[readonly string[], Threading]> = [
  [D.THREADED_ENTITY_CTX, "entity+ctx"],
  [D.THREADED_CTX_ONLY, "ctx"],
  [D.THREADED_CTX_ONLY_PARTICLE, "ctx"],
  [D.THREADED_ENTITY_ONLY, "entity"],
  [D.PURE_FUNCTIONS, "pure"],
  [D.PURE_FUNCTIONS_PARTICLE, "pure"],
  [D.AUDIO_EMITTER_FUNCTIONS, "pure"],
];
for (const [names, threading] of threaded) {
  for (const n of names)
    put({ name: n, kind: "function", threading, runtimeExport: true });
}
for (const list of [
  D.COLOUR_CONSTANTS,
  D.MISC_CONSTANTS,
  D.INPUT_CONSTANTS,
  D.DRAW_CONSTANTS,
]) {
  for (const n of list) put({ name: n, kind: "constant", runtimeExport: true });
}
for (const n of D.SPRITE_ARG0_FUNCTIONS)
  put({ name: n, kind: "function", params: { 0: "asset:sprite" } });
put({
  name: "action_sprite_set",
  kind: "function",
  params: { 0: "asset:sprite" },
});
for (const [n, idx] of Object.entries(D.OBJECT_ARG_FUNCTIONS)) {
  put({ name: n, kind: "function", params: { [idx]: "asset:object" } });
}
for (const [n, kind] of Object.entries(D.NAMED_ASSET_ARG0)) {
  put({ name: n, kind: "function", params: { 0: `asset:${kind}` } });
}
for (const n of D.ENTITY_RETURNING_CALLS)
  put({ name: n, kind: "function", returns: "instance" });
for (const n of ["pi", "infinity", "NaN"]) put({ name: n, kind: "constant" });

export const BUILTINS: ReadonlyMap<string, BuiltinInfo> = table;

export function lookupBuiltin(name: string): BuiltinInfo | undefined {
  return table.get(name);
}

/** Constant families GML defines with a prefix (`c_white`, `vk_left`, `fa_center`, ...). Fallback classifier for names not enumerated. */
export const GML_CONSTANT_PREFIX =
  /^(?:c|vk|mb|fa|bm|bm_dest|bm_src|gp|gp_face|cr|ev|os|display|gamespeed|browser|device|asset|audio|layerelementtype|seq|event|matrix|buffer|ds|phy|ty|lb|tf|ps|pt|pr|se|of|ef|text|ani|kbv|input|timeline|path|tile|tm|surface|spritespeed|sprite|gpu|shadowtype|ugc|steam|network|socket|async|cmpfunc|mip|tex|vertex|vertex_type|vertex_usage|nineslice|part|particle|dll|external|lighttype|opt)_[A-Za-z0-9_]+$/;

/** True for a built-in constant: enumerated, or matching a known constant prefix family. */
export function builtinConstant(name: string): boolean {
  return table.get(name)?.kind === "constant" || GML_CONSTANT_PREFIX.test(name);
}

/** True when `name` is any built-in the source-bug scan must never report as an undefined identifier. */
export function isKnownBuiltinName(name: string): boolean {
  return (
    D.SOURCE_BUG_KEYWORDS.includes(name) ||
    table.has(name) ||
    GML_CONSTANT_PREFIX.test(name)
  );
}

/** Object-type argument index for a call, if any. */
export function objectArgIndex(fn: string): number | undefined {
  const p = table.get(fn)?.params;
  if (!p) return undefined;
  for (const [i, k] of Object.entries(p))
    if (k === "asset:object") return Number(i);
  return undefined;
}

/** True when argument 0 of `fn` is a sprite asset. */
export function isSpriteArg0(fn: string): boolean {
  return table.get(fn)?.params?.[0] === "asset:sprite";
}

/** Names of calls that return a live Entity. */
export function entityReturningCalls(): string[] {
  return [...table.values()]
    .filter((b) => b.returns === "instance")
    .map((b) => b.name);
}

/**
 * Runtime helpers the transpiler emits as `GmlActions.<name>` that are not GML
 * built-ins themselves (compat plumbing). Cross-checked against the engine's
 * exports in builtins.test.ts.
 */
export const RUNTIME_HELPERS: readonly string[] = [
  "getGmlVar",
  "setGmlVar",
  "setGmlVarDefault",
  "getGmlObjectVar",
  "setGmlObjectVar",
  "getGmlRefVar",
  "setGmlRefVar",
  "getGmlEntityField",
  "setGmlEntityField",
  "getGmlArrayVar",
  "gmlArr",
  "gmlMap",
  "gmlNum",
  "gmlStatics",
  "with_each",
];

export const TRANSPILER_RESERVED_IDENTIFIERS: ReadonlySet<string> = new Set(
  D.TRANSPILER_RESERVED_IDENTIFIERS,
);
export const SOURCE_BUG_KEYWORDS: ReadonlySet<string> = new Set(
  D.SOURCE_BUG_KEYWORDS,
);
