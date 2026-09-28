import type { Entity } from "../Entity.js";
import type { World } from "bitecs";
import type { GmlActionContext } from "./gmlActions.js";
/** The shader `shader_set` last bound on this entity, if it hasn't been reset. */
export declare function getGmlActiveShader(entity: Entity): string | undefined;
export declare function clearGmlShaderState(world: World, eid: number): void;
export declare function shader_set(
  entity: Entity,
  ctx: GmlActionContext,
  shader: string,
): void;
export declare function shader_reset(
  entity: Entity,
  ctx: GmlActionContext,
): void;
/** `shader_get_uniform(shader, name)` — GML returns an opaque handle; here the handle is the uniform's name. */
export declare function shader_get_uniform(
  _shader: string,
  name: string,
): string;
/** `shader_is_compiled(shader)` — true once a source is registered; GPU compilation itself is not observable. */
export declare function shader_is_compiled(shader: string): boolean;
export declare function shader_set_uniform_f(
  entity: Entity,
  _ctx: GmlActionContext,
  handle: string,
  ...values: number[]
): void;
export declare function shader_set_uniform_i(
  entity: Entity,
  _ctx: GmlActionContext,
  handle: string,
  ...values: number[]
): void;
export declare function shader_set_uniform_f_array(
  entity: Entity,
  _ctx: GmlActionContext,
  handle: string,
  values: number[],
): void;
export declare function shader_set_uniform_i_array(
  entity: Entity,
  _ctx: GmlActionContext,
  handle: string,
  values: number[],
): void;
