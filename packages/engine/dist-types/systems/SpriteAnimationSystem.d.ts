import type { Scene } from "../Scene.js";
/**
 * Advances every `Sprite`'s `currentFrame` by `frameSpeed` each tick —
 * `image_index`/`image_speed` semantics: `image_speed` is frames
 * advanced per game-step, can be fractional, and `image_index` wraps via
 * modulo against the sprite's frame count when looping (the
 * default for `image_speed > 0`) or clamps at the last frame when not.
 *
 * General-purpose — this is a plain per-`Sprite` tick, the
 * same shape `LightingSystem`/`TimelineSystem` already use for "walk every
 * entity with this component, update a field". `Game.update()` calls
 * `SpriteAnimationSystem.update(scene, dt)` once per frame for every loaded
 * scene (main + overlays), the same per-frame reach every other always-on
 * engine system gets — any game
 * using a multi-frame `Sprite` benefits.
 *
 * `dt`-independent by design, matching the per-*step* (not
 * per-*second*) `image_speed` unit: a fixed 60fps game and one running at a
 * different frame rate both advance `frameSpeed` frames per `update()` call,
 * not `frameSpeed * dt`. This mirrors `PhysicsSystem`'s callers stepping by
 * a whole tick rather than a multiplied delta for script-driven content.
 */
export declare class SpriteAnimationSystem {
  update(scene: Scene): void;
}
