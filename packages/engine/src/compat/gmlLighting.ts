// gmlLighting.ts — compat layer for a real GameMaker custom lighting system
// (the community "lightrender + per-instance light object" pattern — see
// CLAUDE.md's lighting-system research note and this file's own tests for
// the exact shape) onto this engine's real `LightingSystem`/`LightSource`/
// `LightOccluder`.
//
// GameMaker itself has no built-in dynamic-lighting API — every real GML
// project that wants shadow-casting 2D lighting hand-rolls it (a
// `lightrender`-style controller object plus per-instance "light" objects
// whose Create event registers themselves with it, e.g. the community
// `Crystal`/`ED5`/"Ultra-Fast 2D Dynamic Lighting" assets this pass
// researched). There is therefore no fixed GML function name to transpile
// a call site *from* the way `gmlActions.ts`'s DnD actions or
// `gmlCollisionQueries.ts`'s `place_meeting` family have — those exist
// because GameMaker itself defines that syntax. What a GMS2-imported
// object's Create event *can* say, once this file exists, is "attach a
// light to me" in real TypeScript against this engine's own API —
// `GmlActions.light_attach(_entity, _ctx, radius, colour)` — the same
// call shape `action_create_object`/`place_meeting`/etc. already use, so a
// hand-written or lightly-adapted `.behavior.ts` Create handler reads as a
// drop-in replacement for whatever the old `lightrender`/light-object pair
// used to do, cutting the custom lighting system out entirely (the user's
// stated goal — see CLAUDE.md's lighting entry and this pass's own task).
//
// Same `(entity, ctx, ...gmlArgs)` shape as `gmlActions.ts`'s functions —
// every one of these is entity-affecting (attaches/reconfigures/removes a
// component on the calling instance), the same reasoning that shape's own
// doc comment gives for `action_move`/`action_sprite_set`/etc. Ambient/
// global lighting control is the one exception (`lighting_set_ambient`,
// `lighting_get_ambient`) — GameMaker's own custom lighting systems
// universally expose ambient darkness as a single global setting (a
// `lightrender`-style controller's own instance variable, e.g.
// `global.ambient_darkness`), never a per-instance one, so those two take
// `ctx` alone, mirroring `gmlParticles.ts`'s own "GameMaker's own semantics
// decide whether `entity` belongs in the signature" precedent.
//
// No DOM, Tauri, or apps/ide imports — same engine-environment-boundary
// rule as every other file under compat/.

import type { Entity } from "../Entity.js";
import type { GmlActionContext } from "./gmlActions.js";
import { LightSource } from "../components/LightSource.js";
import { LightOccluder } from "../components/LightOccluder.js";
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
export function light_attach(
  entity: Entity,
  _ctx: GmlLightingContext,
  radius: number,
  colour: number,
  options: {
    intensity?: number;
    falloff?: number;
    offsetX?: number;
    offsetY?: number;
    coneAngle?: number;
    coneDirection?: number;
  } = {},
): void {
  const existing = entity.get(LightSource);
  const values = {
    radius,
    colour,
    intensity: options.intensity ?? existing?.intensity ?? 1,
    falloff: options.falloff ?? existing?.falloff ?? 1,
    offsetX: options.offsetX ?? existing?.offsetX ?? 0,
    offsetY: options.offsetY ?? existing?.offsetY ?? 0,
    coneAngle: options.coneAngle ?? existing?.coneAngle ?? 360,
    coneDirection: options.coneDirection ?? existing?.coneDirection ?? 0,
    enabled: true,
  };
  if (existing) {
    Object.assign(existing, values);
  } else {
    entity.add(LightSource, values);
  }
}

/** Turns an entity's attached light off/on without removing the component — mirrors `LightSource.enabled`'s own "extinguished torch" doc comment, and GameMaker's common `light_enabled = false` idiom. No-op if `entity` has no `LightSource`. */
export function light_set_enabled(
  entity: Entity,
  _ctx: GmlLightingContext,
  enabled: boolean,
): void {
  const light = entity.get(LightSource);
  if (light) light.enabled = enabled;
}

/** Reconfigures an already-attached light's colour/intensity/radius live (a flickering torch, a colour-cycling neon sign). No-op if `entity` has no `LightSource` — never throws, matching this file's other setters. */
export function light_set_colour(
  entity: Entity,
  _ctx: GmlLightingContext,
  colour: number,
): void {
  const light = entity.get(LightSource);
  if (light) light.colour = colour;
}

export function light_set_radius(
  entity: Entity,
  _ctx: GmlLightingContext,
  radius: number,
): void {
  const light = entity.get(LightSource);
  if (light) light.radius = radius;
}

/** The real primitive a flicker effect is built from — GameMaker lighting assets implement flicker as ordinary per-step GML (`light_set_intensity(0.8 + random(0.2))`), not an engine-owned animation, matching this engine's own `LightSource.intensity` field being plain per-frame-settable state with no built-in animation curve of its own. */
export function light_set_intensity(
  entity: Entity,
  _ctx: GmlLightingContext,
  intensity: number,
): void {
  const light = entity.get(LightSource);
  if (light) light.intensity = intensity;
}

/** Removes `entity`'s `LightSource` entirely (as opposed to `light_set_enabled(entity, ctx, false)`, which keeps the component around toggled off). No-op if it has none. */
export function light_remove(entity: Entity, _ctx: GmlLightingContext): void {
  if (entity.has(LightSource)) entity.remove(LightSource);
}

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
export function light_occluder_attach(
  entity: Entity,
  _ctx: GmlLightingContext,
  width?: number,
  height?: number,
): void {
  const existing = entity.get(LightOccluder);
  const size = resolveOccluderSize(entity, width, height);
  const values = {
    width: size.width,
    height: size.height,
    offsetX: existing?.offsetX ?? 0,
    offsetY: existing?.offsetY ?? 0,
    enabled: true,
  };
  if (existing) {
    Object.assign(existing, values);
  } else {
    entity.add(LightOccluder, values);
  }
}

export function light_occluder_set_enabled(
  entity: Entity,
  _ctx: GmlLightingContext,
  enabled: boolean,
): void {
  const occluder = entity.get(LightOccluder);
  if (occluder) occluder.enabled = enabled;
}

export function light_occluder_remove(
  entity: Entity,
  _ctx: GmlLightingContext,
): void {
  if (entity.has(LightOccluder)) entity.remove(LightOccluder);
}

/**
 * Sets the scene-wide ambient darkness a real `lightrender`-style
 * controller owns as one global setting (`0` = pitch black except lit
 * areas, `1` = fully lit — matches `AmbientLight.level`'s own doc comment
 * exactly, deliberately the same convention). A no-op with no
 * `ctx.lighting` wired — the honest "nothing to configure" case, not a
 * thrown error, matching every other optional-context function in this
 * compat layer (`ctx.game?.` in `gmlActions.ts`, etc.).
 */
export function lighting_set_ambient(
  ctx: GmlLightingContext,
  colour: number,
  level: number,
): void {
  if (!ctx.lighting) return;
  ctx.lighting.ambient = { colour, level };
}

export function lighting_get_ambient(ctx: GmlLightingContext): {
  colour: number;
  level: number;
} {
  return ctx.lighting?.ambient ?? { colour: 0xffffff, level: 0 };
}

function resolveOccluderSize(
  entity: Entity,
  width: number | undefined,
  height: number | undefined,
): { width: number; height: number } {
  if (width !== undefined && height !== undefined) {
    return { width, height };
  }
  // Deliberately duplicated rather than imported: `spriteHalfExtents` in
  // `gmlActions.ts` is not exported (it's that file's own private helper),
  // and importing `gmlActions.ts` here just for this one small, stable
  // fallback formula would create a needless cross-file coupling for a
  // three-line default. Sprite has no width/height of its own — this
  // engine's real texture-size lookup, same honest limitation
  // `action_if_collision`'s own doc comment already states.
  const DEFAULT_HALF_EXTENT = 16;
  return {
    width: width ?? DEFAULT_HALF_EXTENT * 2,
    height: height ?? DEFAULT_HALF_EXTENT * 2,
  };
}
