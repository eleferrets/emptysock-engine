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
import { Sprite } from "../components/Sprite.js";
import { assetRegistryOf } from "../systems/AssetRegistry.js";
import type { GmlActionContext } from "./gmlActions.js";

const SPRITE_DIR = /^(.*\/assets\/sprites\/[^/]+\/)/;

/** `ref`'s path in the importer's convention for a sprite with `frames` frames. */
function spritePath(ref: string, frames: number): string {
  const dir = SPRITE_DIR.exec(ref)?.[1];
  if (dir === undefined) return ref;
  return frames > 1 ? `${dir}frame_{n}.png` : `${dir}frame_0.png`;
}

/** Frame count of a sprite value (a texture path or a sprite name); 0 when unknown. */
export function sprite_get_number(
  ctx: GmlActionContext,
  sprite: unknown,
): number {
  return assetRegistryOf(ctx)?.frameCount(sprite) ?? 0;
}

/**
 * `sprite_index = sprite`: sets the texture and, from the asset registry,
 * the frame count and size, so a multi-frame sprite animates and
 * `image_number` is right. As in GameMaker, `image_index` is kept (wrapped
 * into the new frame range) and `image_speed` is not reset. `-1`, `""`,
 * `undefined` remove the sprite.
 */
export function set_gml_sprite_index(
  entity: Entity,
  ctx: GmlActionContext,
  sprite: unknown,
): void {
  const sp = entity.get(Sprite);
  if (sp === undefined) return;
  if (
    sprite === -1 ||
    sprite === "" ||
    sprite === undefined ||
    sprite === null
  ) {
    sp.texturePath = "";
    sp.frameCount = 1;
    sp.currentFrame = 0;
    return;
  }
  if (typeof sprite !== "string") return;
  const entry = assetRegistryOf(ctx)?.get("sprite", sprite);
  const frames =
    entry?.frameCount ?? (sprite.includes("{n}") ? sp.frameCount : 1);
  sp.texturePath = spritePath(sprite, frames);
  sp.frameCount = Math.max(1, frames);
  sp.currentFrame = sp.frameCount > 1 ? sp.currentFrame % sp.frameCount : 0;
  if (entry?.width !== undefined) sp.width = entry.width;
  if (entry?.height !== undefined) sp.height = entry.height;
}

const lastFrame = new WeakMap<Entity, number>();

/**
 * True once each time the entity's animation reaches its end: the frame
 * index wrapped around since the previous call, or a non-looping sprite
 * arrived at its last frame. Generated code calls this once per step for
 * objects with an Animation End event (`Other_7`).
 */
export function gml_animation_ended(entity: Entity): boolean {
  const sp = entity.get(Sprite);
  if (sp === undefined || sp.frameCount <= 1) return false;
  const prev = lastFrame.get(entity);
  const cur = sp.currentFrame;
  lastFrame.set(entity, cur);
  if (prev === undefined) return false;
  if (sp.frameSpeed > 0)
    return sp.loop
      ? cur < prev
      : prev < sp.frameCount - 1 && cur >= sp.frameCount - 1;
  if (sp.frameSpeed < 0) return sp.loop ? cur > prev : prev > 0 && cur <= 0;
  return false;
}
