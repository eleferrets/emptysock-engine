import type { Scene } from "../Scene.js";
import { Sprite } from "../components/Sprite.js";

/**
 * Advances every `Sprite`'s `currentFrame` by `frameSpeed` each tick —
 * GameMaker's real `image_index`/`image_speed` semantics (confirmed against
 * manual.gamemaker.io's Image reference pages): `image_speed` is frames
 * advanced per game-step, can be fractional, and `image_index` wraps via
 * modulo against the sprite's frame count when looping (GameMaker's own
 * default for `image_speed > 0`) or clamps at the last frame when not.
 *
 * General-purpose, not GML-specific — this is a plain per-`Sprite` tick, the
 * same shape `LightingSystem`/`TimelineSystem` already use for "walk every
 * entity with this component, update a field". `Game.update()` calls
 * `SpriteAnimationSystem.update(scene, dt)` once per frame for every loaded
 * scene (main + overlays), the same per-frame reach every other always-on
 * engine system gets — animation isn't a GMS2-import-only concept, any game
 * using a multi-frame `Sprite` benefits.
 *
 * `dt`-independent by design, matching GameMaker's own per-*step* (not
 * per-*second*) `image_speed` unit: a fixed 60fps game and one running at a
 * different frame rate both advance `frameSpeed` frames per `update()` call,
 * not `frameSpeed * dt`. This mirrors `PhysicsSystem`'s callers stepping by
 * a whole tick rather than a multiplied delta for GML-sourced content.
 */
export class SpriteAnimationSystem {
  update(scene: Scene): void {
    scene.each(Sprite, (sprite) => {
      if (sprite.frameCount <= 1) return;
      if (sprite.frameSpeed === 0) return;

      let next = sprite.currentFrame + sprite.frameSpeed;

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- `Sprite.loop`'s declared default (`true`) narrows its inferred type to the literal `true`, but this is a live, mutable component field a game can set `false` at runtime.
      if (sprite.loop) {
        // Real modulo (never negative), so a negative frameSpeed (playing
        // backwards) wraps correctly too, not just forward playback.
        next =
          ((next % sprite.frameCount) + sprite.frameCount) % sprite.frameCount;
      } else {
        const last = sprite.frameCount - 1;
        if (next > last) next = last;
        else if (next < 0) next = 0;
      }

      sprite.currentFrame = next;
    });
  }
}
