import type { Entity } from "../Entity.js";
import type { GmlActionContext } from "./gmlActions.js";
/**
 * `layer_exists(layer)` — real membership check against the live
 * `LayerSystem`. `false` (never throws) when no `layers` was attached to
 * `ctx` at all, the same "context-not-wired is an honest no-op" shape every
 * other optional `GmlActionContext` field already follows.
 */
export declare function layer_exists(
  ctx: GmlActionContext,
  layer: string,
): boolean;
/**
 * `layer_get_id(layer_name)` — GameMaker returns a numeric layer id; this
 * compat layer has no numeric id concept for a layer (the same "id is
 * really just the name" choice `action_sound`'s `soundName`-as-id already
 * makes), so the layer's own name is returned unchanged when it exists, or
 * `-1` (GameMaker's own real `layer_get_id` "not found" sentinel) otherwise.
 */
export declare function layer_get_id(
  ctx: GmlActionContext,
  layerName: string,
): string | number;
/** `layer_x(layer, x)` — sets a named layer's real render-position x offset (`LayerSystem.setOffset`, applied by `RenderSystem.syncLayerOffsets()`). A no-op against an undefined layer. */
export declare function layer_x(
  ctx: GmlActionContext,
  layer: string,
  x: number,
): void;
/** `layer_y(layer, y)` — the y-axis counterpart to `layer_x`. */
export declare function layer_y(
  ctx: GmlActionContext,
  layer: string,
  y: number,
): void;
/** `layer_get_x(layer)` — reads back a named layer's current x offset (`0` if never set or the layer/context is missing — `LayerSystem.getOffset()`'s own honest default). */
export declare function layer_get_x(
  ctx: GmlActionContext,
  layer: string,
): number;
/** `layer_get_y(layer)` — the y-axis counterpart to `layer_get_x`. */
export declare function layer_get_y(
  ctx: GmlActionContext,
  layer: string,
): number;
/**
 * `layer_force_draw_depth(force, depth)` — a real GameMaker function with a
 * genuine, documented honest gap: it's a runtime-performance toggle telling
 * GameMaker's own legacy depth-sorting renderer to stop re-sorting every
 * frame and pin everything to one depth. `LayerSystem`'s own doc comment
 * states this engine's depth sorting is *always* explicit (`layer.addEntity`
 * with an explicit depth) and never implicitly re-sorted in the first
 * place — there is no implicit-resort behaviour here for this function to
 * turn off, so it accepts its real arguments (matching real call sites'
 * argument count) and honestly no-ops rather than fabricating an effect.
 */
export declare function layer_force_draw_depth(
  _ctx: GmlActionContext,
  _force: boolean,
  _depth: number,
): void;
/**
 * `layer_add_instance(layer, instance)` — moves an already-existing instance
 * onto a named layer, keeping its current depth (GameMaker's own real
 * semantic: this changes which layer an instance draws on without
 * recreating it). Routes straight to `LayerSystem.addEntity()`, the same
 * placement call `RenderPipeline`'s render-order sync already reads every
 * frame — no separate compat-layer bookkeeping needed. A no-op when no
 * `layers` was attached to `ctx`.
 */
export declare function layer_add_instance(
  ctx: GmlActionContext,
  layer: string,
  instance: Entity,
): void;
/** `layer_sprite_get_id(layer, name)` — the sprite element's entity, or `undefined` (GameMaker's `-1`/`noone`). */
export declare function layer_sprite_get_id(
  ctx: GmlActionContext,
  layer: unknown,
  spriteElementName: string,
): Entity | undefined;
/** `layer_sprite_destroy(element)` — destroys the element's entity; a safe no-op for anything that is not a live entity. */
export declare function layer_sprite_destroy(
  ctx: GmlActionContext,
  spriteElementId: unknown,
): void;
/** `layer_sprite_get_x(element)` — 0 for an unknown element. */
export declare function layer_sprite_get_x(
  _ctx: GmlActionContext,
  spriteElementId: unknown,
): number;
/** `layer_sprite_get_y(element)`. */
export declare function layer_sprite_get_y(
  _ctx: GmlActionContext,
  spriteElementId: unknown,
): number;
/** `layer_sprite_x(element, x)`. */
export declare function layer_sprite_x(
  _ctx: GmlActionContext,
  spriteElementId: unknown,
  x: number,
): void;
/** `layer_sprite_y(element, y)`. */
export declare function layer_sprite_y(
  _ctx: GmlActionContext,
  spriteElementId: unknown,
  y: number,
): void;
/** `layer_sequence_get_instance(layer, name)` — the sequence element's entity (carrying a `GmlSequenceState`), or `undefined`. */
export declare function layer_sequence_get_instance(
  ctx: GmlActionContext,
  layer: unknown,
  sequenceElementName: string,
): Entity | undefined;
/** `layer_sequence_destroy(element)`. */
export declare function layer_sequence_destroy(
  ctx: GmlActionContext,
  sequenceElementId: unknown,
): void;
/**
 * Resolves a bare GML `layer` read (the calling instance's own creation
 * layer, used e.g. as `instance_create_layer(x, y, layer, obj)`'s "same
 * layer as me" argument) to the entity's current `LayerSystem` placement, or
 * `"default"` (`LayerSystem`'s own default layer, and the layer every
 * `Scene.spawn()`ed entity implicitly starts on before any `layer_add_instance`
 * call moves it) when no placement is tracked yet.
 */
export declare function gml_current_layer(
  entity: Entity,
  ctx: GmlActionContext,
): string;
