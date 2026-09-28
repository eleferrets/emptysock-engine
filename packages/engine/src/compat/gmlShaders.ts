import type { Entity } from "../Entity.js";
import type { World } from "bitecs";
import { Sprite } from "../components/Sprite.js";
import { getOrCreate } from "../internal/scoped.js";
import {
  hasGmlShader,
  setGmlShaderUniform,
} from "../systems/ShaderRegistry.js";
import type { GmlActionContext } from "./gmlActions.js";

// ---------------------------------------------------------------------------
// shader_set / shader_reset / shader_*uniform* — real per-entity shader filters
// ---------------------------------------------------------------------------
//
// A shader is a pixi Filter built (lazily, one shared instance per shader id)
// by `RenderPipeline` from the source held in `systems/ShaderRegistry.ts`.
// Two attachment paths, chosen by whether a Draw event is running:
//
//  - Inside a Draw/Draw GUI dispatch (`ctx.drawTarget` set — the real
//    `shader_set(sh_white); draw_self(); shader_reset();` shape): the draw
//    target's `setShader()` makes every sprite drawn until `shader_reset()`
//    carry the filter. It cannot go through `Sprite.shader`, because the Draw
//    event sets and clears it within a single call, before any render sync.
//  - Outside a Draw event: `Sprite.shader` is written (plain data) and
//    `RenderPipeline._syncOne()` applies it to the entity's own sprite until
//    `shader_reset()` clears it.
//
// `activeByWorld` remembers each entity's current shader in both cases:
// `shader_set_uniform_*` targets "the currently bound shader", as in GML.
// Uniforms live per shader id and are shared by every entity using it —
// GameMaker's are global-until-changed state too. A shader id nothing
// registered is a warned no-op (rendered unfiltered), never a throw.

const activeByWorld = new WeakMap<World, Map<number, string>>();
const warned = new Set<string>();

function warnOnce(message: string): void {
  if (warned.has(message)) return;
  warned.add(message);
  console.warn(`[gml shader] ${message}`);
}

/** The shader `shader_set` last bound on this entity, if it hasn't been reset. */
export function getGmlActiveShader(entity: Entity): string | undefined {
  return activeByWorld.get(entity.world)?.get(entity.eid);
}

export function clearGmlShaderState(world: World, eid: number): void {
  activeByWorld.get(world)?.delete(eid);
}

export function shader_set(
  entity: Entity,
  ctx: GmlActionContext,
  shader: string,
): void {
  if (!hasGmlShader(shader)) {
    warnOnce(
      `shader_set("${shader}"): no shader registered under that name — drawing unfiltered.`,
    );
  }
  getOrCreate(activeByWorld, entity.world, () => new Map()).set(
    entity.eid,
    shader,
  );
  const target = ctx.drawTarget;
  if (target?.setShader !== undefined) {
    target.setShader(shader);
    return;
  }
  const sprite = entity.get(Sprite);
  if (sprite !== undefined) sprite.shader = shader;
}

export function shader_reset(entity: Entity, ctx: GmlActionContext): void {
  activeByWorld.get(entity.world)?.delete(entity.eid);
  const target = ctx.drawTarget;
  if (target?.setShader !== undefined) {
    target.setShader(null);
    return;
  }
  const sprite = entity.get(Sprite);
  if (sprite !== undefined && sprite.shader !== "") sprite.shader = "";
}

/** `shader_get_uniform(shader, name)` — GML returns an opaque handle; here the handle is the uniform's name. */
export function shader_get_uniform(_shader: string, name: string): string {
  return name;
}

/** `shader_is_compiled(shader)` — true once a source is registered; GPU compilation itself is not observable. */
export function shader_is_compiled(shader: string): boolean {
  return hasGmlShader(shader);
}

function writeUniform(
  entity: Entity,
  handle: string,
  kind: "f" | "i",
  values: number[],
): void {
  const shader = getGmlActiveShader(entity);
  if (shader === undefined) {
    warnOnce(
      `shader_set_uniform_${kind}("${handle}"): no shader is set on this instance — ignored.`,
    );
    return;
  }
  if (!setGmlShaderUniform(shader, handle, kind, values)) {
    warnOnce(
      `shader_set_uniform_${kind}("${handle}"): shader "${shader}" is not registered — ignored.`,
    );
  }
}

export function shader_set_uniform_f(
  entity: Entity,
  _ctx: GmlActionContext,
  handle: string,
  ...values: number[]
): void {
  writeUniform(entity, handle, "f", values);
}

export function shader_set_uniform_i(
  entity: Entity,
  _ctx: GmlActionContext,
  handle: string,
  ...values: number[]
): void {
  writeUniform(entity, handle, "i", values);
}

export function shader_set_uniform_f_array(
  entity: Entity,
  _ctx: GmlActionContext,
  handle: string,
  values: number[],
): void {
  writeUniform(entity, handle, "f", values);
}

export function shader_set_uniform_i_array(
  entity: Entity,
  _ctx: GmlActionContext,
  handle: string,
  values: number[],
): void {
  writeUniform(entity, handle, "i", values);
}
