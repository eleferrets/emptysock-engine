import type { Entity } from "../Entity.js";
import type { GmlActionContext } from "./gmlActions.js";
import type { LightingSystem } from "../systems/LightingSystem.js";
/**
 * `GmlActionContext` plus an optional live `LightingSystem` — structurally
 * additive, the same "any real `GmlActionContext` already satisfies this
 * once the one extra field is present" shape `gmlParticles.ts`'s
 * `GmlParticleContext`/`gmlCamera.ts`'s `GmlCameraContext` already
 * establish. `lighting` is optional because a project that never uses
 * `light_attach`/`lighting_set_ambient` doesn't need a `LightingSystem`
 * wired at all — `LightSource`/`LightOccluder` components still work with
 * no `LightingSystem` present (a future frame's `collectLights()` call
 * just wouldn't happen), only `lighting_set_ambient`/`lighting_get_ambient`
 * genuinely need one, and those honestly no-op/return the default without
 * one rather than throwing.
 */
export interface GmlLightingContext extends GmlActionContext {
  readonly lighting?: LightingSystem;
}
/**
 * Attaches a real, live `LightSource` to `entity` — the "add a light to
 * this instance" idiom every real GameMaker lighting-system tutorial/asset
 * exposes as its primary API (e.g. a `lightrender`-style controller's
 * `light_create(x, y, radius, colour)`, or a per-instance light object's
 * own Create event setting its own radius/colour/intensity variables for a
 * controller to read). `colour` follows this engine's own `0xRRGGBB`
 * convention (the same one `Sprite.tint`/`action_sprite_color` already use
 * after their own GameMaker-BGR conversion — a caller passing a GameMaker
 * `make_colour_rgb(r, g, b)` result should convert it the same way
 * `action_sprite_color` does before calling this).
 *
 * Idempotent re-attach: calling this again on an entity that already has a
 * `LightSource` reconfigures the existing one in place (matching
 * `timeline_index`'s own "re-targeting" semantics — `Entity.add()` is
 * one-shot, so a second `light_attach` call on the same entity uses
 * `.get()` + field writes instead of a second `.add()`, which would throw).
 */
export declare function light_attach(
  entity: Entity,
  _ctx: GmlLightingContext,
  radius: number,
  colour: number,
  options?: {
    intensity?: number;
    falloff?: number;
    offsetX?: number;
    offsetY?: number;
    coneAngle?: number;
    coneDirection?: number;
  },
): void;
/** Turns an entity's attached light off/on without removing the component — mirrors `LightSource.enabled`'s own "extinguished torch" doc comment, and GameMaker's common `light_enabled = false` idiom. No-op if `entity` has no `LightSource`. */
export declare function light_set_enabled(
  entity: Entity,
  _ctx: GmlLightingContext,
  enabled: boolean,
): void;
/** Reconfigures an already-attached light's colour/intensity/radius live (a flickering torch, a colour-cycling neon sign). No-op if `entity` has no `LightSource` — never throws, matching this file's other setters. */
export declare function light_set_colour(
  entity: Entity,
  _ctx: GmlLightingContext,
  colour: number,
): void;
export declare function light_set_radius(
  entity: Entity,
  _ctx: GmlLightingContext,
  radius: number,
): void;
/** The real primitive a flicker effect is built from — GameMaker lighting assets implement flicker as ordinary per-step GML (`light_set_intensity(0.8 + random(0.2))`), not an engine-owned animation, matching this engine's own `LightSource.intensity` field being plain per-frame-settable state with no built-in animation curve of its own. */
export declare function light_set_intensity(
  entity: Entity,
  _ctx: GmlLightingContext,
  intensity: number,
): void;
/** Removes `entity`'s `LightSource` entirely (as opposed to `light_set_enabled(entity, ctx, false)`, which keeps the component around toggled off). No-op if it has none. */
export declare function light_remove(
  entity: Entity,
  _ctx: GmlLightingContext,
): void;
/**
 * Attaches a real `LightOccluder` box to `entity` — the "this wall casts a
 * shadow" idiom. `width`/`height` default to the entity's current `Sprite`
 * half-extents doubled when omitted (via the same `spriteHalfExtents`
 * fallback `action_if_collision`/`gmlCollisionQueries.ts` already use for
 * "no explicit size given, derive one from the sprite"), so a plain
 * `light_occluder_attach(_entity, _ctx)` call on a wall object with a
 * sprite works with no size arguments at all — matching how a real
 * GameMaker lighting asset's "mark this object as a shadow caster" helper
 * is typically called (no manual box each time).
 */
export declare function light_occluder_attach(
  entity: Entity,
  _ctx: GmlLightingContext,
  width?: number,
  height?: number,
): void;
export declare function light_occluder_set_enabled(
  entity: Entity,
  _ctx: GmlLightingContext,
  enabled: boolean,
): void;
export declare function light_occluder_remove(
  entity: Entity,
  _ctx: GmlLightingContext,
): void;
/**
 * Sets the scene-wide ambient darkness a real `lightrender`-style
 * controller owns as one global setting (`0` = pitch black except lit
 * areas, `1` = fully lit — matches `AmbientLight.level`'s own doc comment
 * exactly, deliberately the same convention). A no-op with no
 * `ctx.lighting` wired — the honest "nothing to configure" case, not a
 * thrown error, matching every other optional-context function in this
 * compat layer (`ctx.game?.` in `gmlActions.ts`, etc.).
 */
export declare function lighting_set_ambient(
  ctx: GmlLightingContext,
  colour: number,
  level: number,
): void;
export declare function lighting_get_ambient(ctx: GmlLightingContext): {
  colour: number;
  level: number;
};
