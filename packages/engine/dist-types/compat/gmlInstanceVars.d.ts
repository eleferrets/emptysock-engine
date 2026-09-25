import type { World } from "bitecs";
import type { Entity } from "../Entity.js";
import type { GmlActionContext } from "./gmlActions.js";
export declare function getGmlVar(
  entity: Entity,
  _ctx: GmlActionContext,
  name: string,
): unknown;
export declare function setGmlVar(
  entity: Entity,
  _ctx: GmlActionContext,
  name: string,
  value: unknown,
): unknown;
export declare function hasGmlVar(
  entity: Entity,
  _ctx: GmlActionContext,
  name: string,
): boolean;
/** Clears every stored instance variable for this `(world, eid)` pair — called from `Scene.destroy()`. */
export declare function clearGmlInstanceVars(world: World, eid: number): void;
/**
 * Coerces a dynamically-typed GML value to a real `number` at runtime — see
 * this function's own implementation doc comment in `gmlInstanceVars.ts`
 * for the full reasoning (a real, valid-JS-at-runtime alternative to a
 * TypeScript-only `as number` type assertion, used by `gms2-transpile.ts`/
 * `gms2-codegen.ts`'s bare-read rewrites).
 */
export declare function gmlNum(value: unknown): number;
