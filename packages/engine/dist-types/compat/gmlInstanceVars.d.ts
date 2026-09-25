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
