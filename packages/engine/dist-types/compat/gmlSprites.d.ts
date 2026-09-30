/**
 * GameMaker sprite-asset semantics on the engine's `Sprite` component:
 * assigning `sprite_index`, `sprite_get_number`, and detecting the
 * Animation End event.
 *
 * A sprite value in transpiled GML is its texture path
 * (`./assets/sprites/<name>/frame_0.png`, or `frame_{n}.png` for a
 * multi-frame sprite, the same path the importer puts on the prefab), so
 * `sprite_index == spr_walk` compares paths. The frame count, playback
 * speed and size come from the asset registry (`asset-index.json`).
 */
import type { Entity } from "../Entity.js";
import type { GmlActionContext } from "./gmlActions.js";
/** Frame count of a sprite value (a texture path or a sprite name); 0 when unknown. */
export declare function sprite_get_number(
  ctx: GmlActionContext,
  sprite: unknown,
): number;
/**
 * `sprite_index = sprite`: sets the texture and, from the asset registry,
 * the frame count and size, so a multi-frame sprite animates and
 * `image_number` is right. As in GameMaker, `image_index` is kept (wrapped
 * into the new frame range) and `image_speed` is not reset. `-1`, `""`,
 * `undefined` remove the sprite.
 */
export declare function set_gml_sprite_index(
  entity: Entity,
  ctx: GmlActionContext,
  sprite: unknown,
): void;
/**
 * True once each time the entity's animation reaches its end: the frame
 * index wrapped around since the previous call, or a non-looping sprite
 * arrived at its last frame. Generated code calls this once per step for
 * objects with an Animation End event (`Other_7`).
 */
export declare function gml_animation_ended(entity: Entity): boolean;
