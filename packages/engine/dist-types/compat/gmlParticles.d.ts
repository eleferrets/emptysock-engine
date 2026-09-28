import type { GmlActionContext } from "./gmlActions.js";
import { ParticleEmitter } from "../systems/ParticleSystem.js";
/**
 * The one thing `gmlActions.ts`'s `GmlActionContext` doesn't have: a way to
 * actually mount a `ParticleEmitter` into live rendering. Structurally
 * exactly `RenderPipeline.mountParticles`/`.unmountParticles` (see
 * `systems/RenderPipeline.ts`) — not imported directly, since `RenderPipeline`
 * pulls in pixi.js and this file must not (engine-environment-boundary rule
 * again; this is the same "engine depends on the interface, never a concrete
 * implementation" pattern `StorageAdapter`/`TileLayerSource` already use).
 * Omit it and `part_particles_create` still simulates real particles
 * (`ParticleEmitter.emit()` genuinely runs) — they're just never mounted
 * anywhere visible, an honest degradation rather than a thrown error.
 */
export interface ParticleMountTarget {
  mountParticles(emitter: ParticleEmitter, layerName?: string): Promise<void>;
  unmountParticles(emitter: ParticleEmitter): void;
}
/**
 * `GmlActionContext` plus the one extra field this file's functions need.
 * A real `GmlActionContext` already satisfies every field but `particles` —
 * callers construct one of these by spreading their existing context and
 * adding `particles: pipeline`, no change to `gmlActions.ts` required.
 *
 * Follow-up for whoever wires this in for real: the cleanest long-term home
 * for `particles` is directly on `GmlActionContext` itself (next to
 * `drawTarget`), so a single shared context object threads through both
 * `gmlActions.ts` and this file's functions instead of two separate context
 * shapes existing side by side. Left as a real, separate, not-yet-done
 * follow-up per this task's own scope boundary (`gmlActions.ts` is another
 * agent's file this session).
 */
export interface GmlParticleContext extends GmlActionContext {
  readonly particles?: ParticleMountTarget;
}
/** GMS2 `part_type_create()` — allocates a new particle type and returns its handle. Never fails. */
export declare function part_type_create(): number;
/** GMS2 `part_type_destroy(ind)` — frees a particle type. Any emitter already spawned from it (via `part_particles_create`) keeps running; only future `part_particles_create` calls against a destroyed type id no-op. */
export declare function part_type_destroy(ind: number): void;
/** GMS2 `part_type_exists(ind)`. */
export declare function part_type_exists(ind: number): boolean;
/** GMS2 `part_type_clear(ind)` — resets an existing type back to its just-created defaults. Unknown id: honest no-op + warning. */
export declare function part_type_clear(ind: number): void;
/**
 * GMS2 `part_type_shape(ind, shape)` — GameMaker's built-in particle bitmap
 * shapes (`pt_shape_pixel`, `pt_shape_disk`, `pt_shape_star`, …). This engine
 * has no equivalent library of built-in particle bitmaps — `ParticleEmitter`
 * only ever draws a texture path (or a plain white square with no texture
 * set, per `RenderPipeline.mountParticles`'s doc comment). The shape constant
 * is stored (so calling this is never an error) but has no visual effect
 * unless `part_type_sprite` is also called to supply a real texture — an
 * honest, stated gap, not a fabricated mapping.
 */
export declare function part_type_shape(ind: number, shape: number): void;
/**
 * GMS2 `part_type_sprite(ind, sprite, animate, stretch, random)` — sets the
 * particle's drawn texture. `sprite` is accepted as the sprite's asset path
 * (this compat layer has no GameMaker sprite-resource-index concept, the
 * same "pass the real path/id through" shape `action_sprite_set` already
 * uses for `Sprite.texturePath`). `animate`/`stretch`/`random` (sub-image
 * animation/stretch-to-lifetime/random-start-frame) have no equivalent on
 * `ParticleEmitter` — accepted for signature parity, not applied.
 */
export declare function part_type_sprite(
  ind: number,
  sprite: string,
  _animate?: boolean,
  _stretch?: boolean,
  _random?: boolean,
): void;
/**
 * GMS2 `part_type_size(ind, size_min, size_max, size_incr, size_wiggle)`.
 * `size_wiggle` (a per-step random fluctuation, redrawn every step) is a
 * real, exact translation onto `ParticleEmitter.options.sizeWiggle` —
 * `ParticleEmitter.update()` adds a fresh `[-sizeWiggle, sizeWiggle]`
 * random offset to the particle's scale every step, on top of the
 * deterministic ramp below. `size_incr` (per-step linear growth) is
 * translated, in `_configToEmitterOptions`, into `endScale` once the type's
 * life is known.
 */
export declare function part_type_size(
  ind: number,
  sizeMin: number,
  sizeMax: number,
  sizeIncr?: number,
  sizeWiggle?: number,
): void;
/** GMS2 `part_type_colour1(ind, colour)` / US `part_type_color1` — a single fixed colour for the particle's whole life. */
export declare function part_type_colour1(ind: number, colour: number): void;
export declare const part_type_color1: typeof part_type_colour1;
/** GMS2 `part_type_colour2(ind, colour1, colour2)` / US `part_type_color2` — linear gradient from `colour1` at birth to `colour2` at death. */
export declare function part_type_colour2(
  ind: number,
  colour1: number,
  colour2: number,
): void;
export declare const part_type_color2: typeof part_type_colour2;
/**
 * GMS2 `part_type_colour3(ind, colour1, colour2, colour3)` / US
 * `part_type_color3` — a genuine 3-stop gradient over the particle's life.
 * `ParticleEmitter.options.colorGradient` accepts an arbitrary-length stop
 * array (`ParticleSystem.ts`'s `sampleGradient` interpolates across however
 * many stops are given) — this is a real, exact translation, not an
 * approximation, unlike `part_type_alpha3` below.
 */
export declare function part_type_colour3(
  ind: number,
  colour1: number,
  colour2: number,
  colour3: number,
): void;
export declare const part_type_color3: typeof part_type_colour3;
/** GMS2 `part_type_alpha1(ind, alpha)` — fixed alpha for the particle's whole life. */
export declare function part_type_alpha1(ind: number, alpha: number): void;
/** GMS2 `part_type_alpha2(ind, alpha1, alpha2)` — linear fade from `alpha1` at birth to `alpha2` at death. Exact translation onto `ParticleEmitter.options.startAlpha`/`.endAlpha`. */
export declare function part_type_alpha2(
  ind: number,
  alpha1: number,
  alpha2: number,
): void;
/**
 * GMS2 `part_type_alpha3(ind, alpha1, alpha2, alpha3)` — a real 3-point alpha
 * curve in GameMaker. Unlike colour (which genuinely supports N stops on
 * this engine), `ParticleEmitter.options` only has `startAlpha`/`endAlpha` —
 * no middle stop. `alpha2` (the middle value) is therefore dropped, using
 * only `alpha1`/`alpha3` as start/end — an honest, documented approximation,
 * not a fabricated 3-point curve.
 */
export declare function part_type_alpha3(
  ind: number,
  alpha1: number,
  _alpha2: number,
  alpha3: number,
): void;
/**
 * GMS2 `part_type_speed(ind, speed_min, speed_max, speed_incr, speed_wiggle)`.
 * `speed_wiggle` (a per-step random fluctuation of speed alone, redrawn
 * every step) is a real, exact translation onto
 * `ParticleEmitter.options.speedWiggle`. `speed_incr` (per-step
 * acceleration) has no `ParticleEmitter` equivalent beyond the constant
 * `acceleration` vector `part_type_gravity` already provides, and is still
 * accepted but not applied — an honest, narrower gap than before.
 */
export declare function part_type_speed(
  ind: number,
  speedMin: number,
  speedMax: number,
  _speedIncr?: number,
  speedWiggle?: number,
): void;
/**
 * GMS2 `part_type_direction(ind, dir_min, dir_max, dir_incr, dir_wiggle)` —
 * initial launch direction range, in GameMaker's own degrees convention
 * (converted to this codebase's convention — see `dirToUnit`'s doc comment —
 * at emitter-build time, not here, so the stored config stays in GameMaker's
 * own units for anyone inspecting it). `dir_wiggle` (per-step direction
 * drift, redrawn every step, in degrees) is a real, exact translation onto
 * `ParticleEmitter.options.dirWiggle`. `dir_incr` (per-step steady
 * rotation of the launch direction) has no equivalent and is still
 * accepted but not applied.
 */
export declare function part_type_direction(
  ind: number,
  dirMin: number,
  dirMax: number,
  _dirIncr?: number,
  dirWiggle?: number,
): void;
/**
 * GMS2 `part_type_blend(ind, additive)` — sets the particle type's blend
 * mode: normal alpha blending (`additive` falsy) or additive blending
 * (`additive` truthy, GameMaker's `pt_blend_add`/the common glowing-embers
 * look). Translated exactly onto `ParticleEmitterOptions.blendMode`, which
 * `RenderPipeline.mountParticles()` applies to the mounted
 * `ParticleContainer`'s own `blendMode` — pixi batches every particle in a
 * container under one blend mode, matching GameMaker's own per-type (not
 * per-particle) blend setting.
 */
export declare function part_type_blend(ind: number, additive: boolean): void;
/**
 * GMS2 `part_type_gravity(ind, amount, direction)` — a constant acceleration
 * applied every step, translated exactly onto `ParticleEmitter.options.acceleration`.
 */
export declare function part_type_gravity(
  ind: number,
  amount: number,
  direction: number,
): void;
/**
 * GMS2 `part_type_life(ind, life_min, life_max)` — in GameMaker steps, per
 * `ASSUMED_STEPS_PER_SECOND`'s doc comment. Converted to seconds only when
 * an emitter is actually built (`_configToEmitterOptions`), so the stored
 * config always holds GameMaker's own step-based values.
 */
export declare function part_type_life(
  ind: number,
  lifeMin: number,
  lifeMax: number,
): void;
/** GMS2 `part_system_create()` — allocates a new particle system and returns its handle. */
export declare function part_system_create(): number;
/** GMS2 `part_system_exists(ind)`. */
export declare function part_system_exists(ind: number): boolean;
/**
 * GMS2 `part_system_destroy(ind)` — unmounts (via `ctx.particles`, if given)
 * and clears every emitter this system ever spawned, then frees the handle.
 * Unknown id: honest no-op + warning, matching every other `part_*` function
 * here.
 */
export declare function part_system_destroy(
  ind: number,
  ctx: GmlParticleContext,
): void;
/**
 * GMS2 `part_system_position(ind, x, y)` — sets the system's own origin
 * offset, added to every `part_particles_create`/`part_particles_create_colour`
 * spawn position from here on. Retroactively repositioning already-mounted
 * emitters isn't attempted — this only affects future spawns, matching
 * GameMaker's own behaviour (it's the layer/room position, not a live
 * transform on existing particles).
 */
export declare function part_system_position(
  ind: number,
  x: number,
  y: number,
): void;
/**
 * GMS2 `part_system_depth(ind, depth)` — GameMaker's per-system draw-depth
 * (z-order among room layers). This engine's `RenderPipeline` sorts by named
 * layer (`mountParticles(emitter, layerName)`), not a numeric depth value —
 * there is no depth-to-layer-name mapping this compat layer can invent
 * honestly (a project's actual layer names/ordering are project-specific).
 * Accepted for signature parity; has no effect. A project that needs a
 * specific draw layer should call `ctx.particles.mountParticles(emitter,
 * layerName)` directly rather than relying on this.
 */
export declare function part_system_depth(_ind: number, _depth: number): void;
/**
 * GMS2 `part_particles_clear(ps)` — clears every particle currently alive in
 * every emitter this system has spawned, without destroying the system or
 * its type emitters (they can still be burst into again).
 */
export declare function part_particles_clear(ps: number): void;
/**
 * GMS2 `part_particles_create(ps, x, y, parttype, number)` — the one call
 * that actually spawns visible particles: bursts `number` particles of type
 * `parttype` at `(x, y)` (plus the system's own `part_system_position`
 * offset) into system `ps`. Lazily builds (and, if `ctx.particles` is wired,
 * mounts) one `ParticleEmitter` per `(ps, parttype)` pair the first time
 * that combination is used — see `ParticleSystemState.emitters`'s doc
 * comment for why it's one emitter per type, not one per system.
 */
export declare function part_particles_create(
  ctx: GmlParticleContext,
  ps: number,
  x: number,
  y: number,
  parttype: number,
  number_: number,
): void;
/**
 * GMS2 `part_particles_create_colour(ps, x, y, parttype, colour, number)` /
 * US `part_particles_create_color` — same as `part_particles_create`, but
 * this one burst uses a fixed `colour` instead of the type's own configured
 * gradient. GameMaker keeps the type's own colour config for *other* spawns
 * of the same type — this compat layer reproduces that by swapping
 * `options.colorGradient` for just the duration of this one `emit()` call
 * (each spawned particle's `colour` is sampled once at spawn and stored on
 * the particle itself — see `ParticleSystem.ts`'s `_spawnOne` — so it's safe
 * to restore the gradient immediately after `emit()` returns; already-alive
 * particles from earlier bursts are unaffected).
 */
export declare function part_particles_create_colour(
  ctx: GmlParticleContext,
  ps: number,
  x: number,
  y: number,
  parttype: number,
  colour: number,
  number_: number,
): void;
export declare const part_particles_create_color: typeof part_particles_create_colour;
//# sourceMappingURL=gmlParticles.d.ts.map
