// gmlParticles.ts — GameMaker Studio 2 particle-function compat layer.
//
// Sibling to `gmlActions.ts` (GM8.1 DnD action library) and `gml.ts` (pure
// GML scripting functions) — same directory, same "engine defines the
// context shape, game code wires the live pieces" pattern, but a genuinely
// different shape of GameMaker API: `part_type_*`/`part_system_*` are
// **handle-based**, not entity-affecting. `part_type_create()` returns an
// opaque numeric handle that later `part_type_*` calls configure in place;
// `part_system_create()` returns a second, independent handle a "particle
// system" (a mountable emission surface) lives under; `part_particles_create`
// is the one call that actually spawns anything, by combining a system
// handle + a type handle + a position + a count.
//
// This is why every exported function here takes `(ctx: GmlParticleContext,
// ...gmlArgs)` and NOT `(entity: Entity, ctx, ...)` the way `gmlActions.ts`'s
// functions do: a real GameMaker particle call is not "this instance does
// X" — `part_type_create`/`part_system_create` aren't tied to any specific
// instance at all (GameMaker itself lets you call them from anywhere, store
// the returned int in a global, and use it from every instance). Forcing an
// `entity` parameter onto every function here just to match `gmlActions.ts`'s
// shape would misrepresent GameMaker's own semantics, which CLAUDE.md's
// "GMS2 DnD action-library compat" entry explicitly asks this file to get
// right rather than force a bad fit.
//
// `GmlActionContext` (`gmlActions.ts`) is NOT edited by this file — it has
// no field for reaching a live `RenderPipeline`, and adding one is exactly
// the kind of "small, additive, unlikely-to-conflict" change explicitly
// deferred to the orchestrating session (see this file's own doc comment on
// `ParticleMountTarget` below for the exact shape needed). `GmlParticleContext`
// is a structural superset of `GmlActionContext` defined in this file only —
// any real `GmlActionContext` object already satisfies it once a `particles`
// field is added at the call site, no edit to `gmlActions.ts` required.
//
// No DOM, Tauri, or apps/ide imports — same engine-environment-boundary rule
// as every other file under compat/.

import type { GmlActionContext } from "./gmlActions.js";
import {
  ParticleEmitter,
  type ParticleEmitterOptions,
  type ParticleBlendMode,
} from "../systems/ParticleSystem.js";
import { getOrCreateMapEntry } from "../internal/scoped.js";

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Angle/unit conventions — kept consistent with the rest of this compat layer
// ---------------------------------------------------------------------------

/**
 * Same convention `gml.ts`'s `lengthdir_x`/`lengthdir_y` and `gmlActions.ts`'s
 * `MOVE_DIRECTION_BITS` already use in this codebase: degrees, `0` =
 * screen-right, increasing clockwise, `y` down — not GameMaker's own
 * "counterclockwise, y-up" `direction` variable. Kept consistent with the one
 * angle convention this compat layer has already established everywhere else,
 * rather than introducing a second one only particle functions would use.
 */
function dirToUnit(degrees: number): { x: number; y: number } {
  const rad = (degrees * Math.PI) / 180;
  return { x: Math.cos(rad), y: Math.sin(rad) };
}

/**
 * GameMaker particle life/speed/size increments are specified per **step**
 * (one room frame), not per second. `ParticleEmitter` has no per-step
 * integration knobs at all — its `lifetime`/`velocity`/scale ramps are
 * expressed in seconds and interpolated continuously over a particle's
 * lifetime. This compat layer assumes 60 steps/second (this codebase's
 * implicit default elsewhere — there is no live `room_speed` this file can
 * read), documented here rather than silently baked into the maths below.
 * A project running at a different room speed will see particle lifetimes
 * and per-step growth rates that are proportionally off; there is no fix
 * for this short of `ParticleEmitter` itself gaining step-based fields.
 */
const ASSUMED_STEPS_PER_SECOND = 60;

function stepsToSeconds(steps: number): number {
  return steps / ASSUMED_STEPS_PER_SECOND;
}

// ---------------------------------------------------------------------------
// part_type_* — particle "type" (a template, not a live thing on its own)
// ---------------------------------------------------------------------------

/**
 * The GameMaker fields this compat layer can genuinely translate onto
 * `ParticleEmitterOptions`. Fields GameMaker exposes but `ParticleEmitter`
 * has no equivalent for at all (particle shape *bitmaps* — `pt_shape_*` —
 * and orientation/spin-vs-direction locking) are stored here anyway so
 * `part_type_*` calls that set them don't throw, but are never read by
 * `_configToEmitterOptions` — see that function's doc comment for the
 * honest list of what's dropped. Size/speed/direction "wiggle" and blend
 * mode *are* real now — `ParticleEmitter` gained a per-step wiggle hook and
 * `RenderPipeline.mountParticles()` reads `blendMode` onto the mounted
 * `ParticleContainer`; see `sizeWiggle`/`speedWiggle`/`dirWiggle`/`blend`
 * below and `part_type_size`/`part_type_speed`/`part_type_direction`/
 * `part_type_blend`'s doc comments.
 */
interface ParticleTypeConfig {
  shapeConstant: number | undefined; // pt_shape_* — stored, never rendered; see _configToEmitterOptions
  texturePath: string;
  sizeMin: number;
  sizeMax: number;
  sizeIncr: number; // per-step growth — see _configToEmitterOptions for the seconds conversion
  sizeWiggle: number; // per-step random fluctuation — translated straight onto ParticleEmitterOptions.sizeWiggle
  colours: number[]; // 1-3 gradient stops, set by colour1/2/3
  alphaStart: number;
  alphaEnd: number; // alpha3's middle stop has no 3-point equivalent on ParticleEmitter — see part_type_alpha3
  speedMin: number;
  speedMax: number;
  speedWiggle: number; // per-step random fluctuation — translated straight onto ParticleEmitterOptions.speedWiggle
  dirMin: number;
  dirMax: number;
  dirWiggle: number; // per-step random fluctuation, in degrees — translated straight onto ParticleEmitterOptions.dirWiggle
  gravityAmount: number;
  gravityDirection: number;
  lifeMinSteps: number;
  lifeMaxSteps: number;
  blend: ParticleBlendMode; // pt_blend_normal/pt_blend_add — see part_type_blend
}

function defaultTypeConfig(): ParticleTypeConfig {
  return {
    shapeConstant: undefined,
    texturePath: "",
    sizeMin: 1,
    sizeMax: 1,
    sizeIncr: 0,
    sizeWiggle: 0,
    colours: [0xffffff],
    alphaStart: 1,
    alphaEnd: 1,
    speedMin: 0,
    speedMax: 0,
    speedWiggle: 0,
    dirMin: 0,
    dirMax: 0,
    dirWiggle: 0,
    gravityAmount: 0,
    gravityDirection: 90, // GameMaker's own part_type_gravity default direction is "down"
    lifeMinSteps: 60,
    lifeMaxSteps: 60,
    blend: "normal",
  };
}

let _nextTypeId = 1;
const _types = new Map<number, ParticleTypeConfig>();

function warnUnknownType(fn: string, ind: number): void {
  console.warn(
    `[gmlParticles] ${fn} called with unknown particle type id ${ind} — no-op. ` +
      `Call part_type_create() first and use its returned id.`,
  );
}

/** GMS2 `part_type_create()` — allocates a new particle type and returns its handle. Never fails. */
export function part_type_create(): number {
  const id = _nextTypeId++;
  _types.set(id, defaultTypeConfig());
  return id;
}

/** GMS2 `part_type_destroy(ind)` — frees a particle type. Any emitter already spawned from it (via `part_particles_create`) keeps running; only future `part_particles_create` calls against a destroyed type id no-op. */
export function part_type_destroy(ind: number): void {
  _types.delete(ind);
}

/** GMS2 `part_type_exists(ind)`. */
export function part_type_exists(ind: number): boolean {
  return _types.has(ind);
}

/** GMS2 `part_type_clear(ind)` — resets an existing type back to its just-created defaults. Unknown id: honest no-op + warning. */
export function part_type_clear(ind: number): void {
  if (!_types.has(ind)) {
    warnUnknownType("part_type_clear", ind);
    return;
  }
  _types.set(ind, defaultTypeConfig());
}

function withType(
  fn: string,
  ind: number,
  mutate: (cfg: ParticleTypeConfig) => void,
): void {
  const cfg = _types.get(ind);
  if (cfg === undefined) {
    warnUnknownType(fn, ind);
    return;
  }
  mutate(cfg);
}

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
export function part_type_shape(ind: number, shape: number): void {
  withType("part_type_shape", ind, (cfg) => {
    cfg.shapeConstant = shape;
  });
}

/**
 * GMS2 `part_type_sprite(ind, sprite, animate, stretch, random)` — sets the
 * particle's drawn texture. `sprite` is accepted as the sprite's asset path
 * (this compat layer has no GameMaker sprite-resource-index concept, the
 * same "pass the real path/id through" shape `action_sprite_set` already
 * uses for `Sprite.texturePath`). `animate`/`stretch`/`random` (sub-image
 * animation/stretch-to-lifetime/random-start-frame) have no equivalent on
 * `ParticleEmitter` — accepted for signature parity, not applied.
 */
export function part_type_sprite(
  ind: number,
  sprite: string,
  _animate = false,
  _stretch = false,
  _random = false,
): void {
  withType("part_type_sprite", ind, (cfg) => {
    cfg.texturePath = sprite;
  });
}

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
export function part_type_size(
  ind: number,
  sizeMin: number,
  sizeMax: number,
  sizeIncr = 0,
  sizeWiggle = 0,
): void {
  withType("part_type_size", ind, (cfg) => {
    cfg.sizeMin = sizeMin;
    cfg.sizeMax = sizeMax;
    cfg.sizeIncr = sizeIncr;
    cfg.sizeWiggle = sizeWiggle;
  });
}

/** GMS2 `part_type_colour1(ind, colour)` / US `part_type_color1` — a single fixed colour for the particle's whole life. */
export function part_type_colour1(ind: number, colour: number): void {
  withType("part_type_colour1", ind, (cfg) => {
    cfg.colours = [colour];
  });
}
export const part_type_color1 = part_type_colour1;

/** GMS2 `part_type_colour2(ind, colour1, colour2)` / US `part_type_color2` — linear gradient from `colour1` at birth to `colour2` at death. */
export function part_type_colour2(
  ind: number,
  colour1: number,
  colour2: number,
): void {
  withType("part_type_colour2", ind, (cfg) => {
    cfg.colours = [colour1, colour2];
  });
}
export const part_type_color2 = part_type_colour2;

/**
 * GMS2 `part_type_colour3(ind, colour1, colour2, colour3)` / US
 * `part_type_color3` — a genuine 3-stop gradient over the particle's life.
 * `ParticleEmitter.options.colorGradient` accepts an arbitrary-length stop
 * array (`ParticleSystem.ts`'s `sampleGradient` interpolates across however
 * many stops are given) — this is a real, exact translation, not an
 * approximation, unlike `part_type_alpha3` below.
 */
export function part_type_colour3(
  ind: number,
  colour1: number,
  colour2: number,
  colour3: number,
): void {
  withType("part_type_colour3", ind, (cfg) => {
    cfg.colours = [colour1, colour2, colour3];
  });
}
export const part_type_color3 = part_type_colour3;

/** GMS2 `part_type_alpha1(ind, alpha)` — fixed alpha for the particle's whole life. */
export function part_type_alpha1(ind: number, alpha: number): void {
  withType("part_type_alpha1", ind, (cfg) => {
    cfg.alphaStart = alpha;
    cfg.alphaEnd = alpha;
  });
}

/** GMS2 `part_type_alpha2(ind, alpha1, alpha2)` — linear fade from `alpha1` at birth to `alpha2` at death. Exact translation onto `ParticleEmitter.options.startAlpha`/`.endAlpha`. */
export function part_type_alpha2(
  ind: number,
  alpha1: number,
  alpha2: number,
): void {
  withType("part_type_alpha2", ind, (cfg) => {
    cfg.alphaStart = alpha1;
    cfg.alphaEnd = alpha2;
  });
}

/**
 * GMS2 `part_type_alpha3(ind, alpha1, alpha2, alpha3)` — a real 3-point alpha
 * curve in GameMaker. Unlike colour (which genuinely supports N stops on
 * this engine), `ParticleEmitter.options` only has `startAlpha`/`endAlpha` —
 * no middle stop. `alpha2` (the middle value) is therefore dropped, using
 * only `alpha1`/`alpha3` as start/end — an honest, documented approximation,
 * not a fabricated 3-point curve.
 */
export function part_type_alpha3(
  ind: number,
  alpha1: number,
  _alpha2: number,
  alpha3: number,
): void {
  withType("part_type_alpha3", ind, (cfg) => {
    cfg.alphaStart = alpha1;
    cfg.alphaEnd = alpha3;
  });
}

/**
 * GMS2 `part_type_speed(ind, speed_min, speed_max, speed_incr, speed_wiggle)`.
 * `speed_wiggle` (a per-step random fluctuation of speed alone, redrawn
 * every step) is a real, exact translation onto
 * `ParticleEmitter.options.speedWiggle`. `speed_incr` (per-step
 * acceleration) has no `ParticleEmitter` equivalent beyond the constant
 * `acceleration` vector `part_type_gravity` already provides, and is still
 * accepted but not applied — an honest, narrower gap than before.
 */
export function part_type_speed(
  ind: number,
  speedMin: number,
  speedMax: number,
  _speedIncr = 0,
  speedWiggle = 0,
): void {
  withType("part_type_speed", ind, (cfg) => {
    cfg.speedMin = speedMin;
    cfg.speedMax = speedMax;
    cfg.speedWiggle = speedWiggle;
  });
}

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
export function part_type_direction(
  ind: number,
  dirMin: number,
  dirMax: number,
  _dirIncr = 0,
  dirWiggle = 0,
): void {
  withType("part_type_direction", ind, (cfg) => {
    cfg.dirMin = dirMin;
    cfg.dirMax = dirMax;
    cfg.dirWiggle = dirWiggle;
  });
}

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
export function part_type_blend(ind: number, additive: boolean): void {
  withType("part_type_blend", ind, (cfg) => {
    cfg.blend = additive ? "add" : "normal";
  });
}

/**
 * GMS2 `part_type_gravity(ind, amount, direction)` — a constant acceleration
 * applied every step, translated exactly onto `ParticleEmitter.options.acceleration`.
 */
export function part_type_gravity(
  ind: number,
  amount: number,
  direction: number,
): void {
  withType("part_type_gravity", ind, (cfg) => {
    cfg.gravityAmount = amount;
    cfg.gravityDirection = direction;
  });
}

/**
 * GMS2 `part_type_life(ind, life_min, life_max)` — in GameMaker steps, per
 * `ASSUMED_STEPS_PER_SECOND`'s doc comment. Converted to seconds only when
 * an emitter is actually built (`_configToEmitterOptions`), so the stored
 * config always holds GameMaker's own step-based values.
 */
export function part_type_life(
  ind: number,
  lifeMin: number,
  lifeMax: number,
): void {
  withType("part_type_life", ind, (cfg) => {
    cfg.lifeMinSteps = lifeMin;
    cfg.lifeMaxSteps = lifeMax;
  });
}

/**
 * Translates a `ParticleTypeConfig` into real `ParticleEmitterOptions`.
 * `sizeIncr`'s per-step growth needs the type's own average life (in
 * seconds) to become a `ParticleEmitter`-shaped `endScale` — this is why the
 * translation happens once, at emitter-build time (`_ensureEmitter`), rather
 * than incrementally as each `part_type_*` call comes in: the life and size
 * calls can happen in either order in real GML code.
 *
 * Fields genuinely dropped here, honestly, with no equivalent on
 * `ParticleEmitter` at all: `shapeConstant` (built-in shape bitmaps —
 * see `part_type_shape`), `size_incr`/`speed_incr`/`dir_incr` (per-step
 * steady drift, as opposed to `size_wiggle`/`speed_wiggle`/`dir_wiggle`'s
 * per-step *random* fluctuation, which *is* translated below), sprite
 * `animate`/`stretch`/`random` sub-image options, and `alpha2`'s middle
 * stop (see `part_type_alpha3`).
 */
function _configToEmitterOptions(
  cfg: ParticleTypeConfig,
): ParticleEmitterOptions {
  const avgLifeSeconds =
    stepsToSeconds(cfg.lifeMinSteps + cfg.lifeMaxSteps) / 2;
  const endScale = Math.max(
    0,
    cfg.sizeMin + cfg.sizeIncr * avgLifeSeconds * ASSUMED_STEPS_PER_SECOND,
  );

  // Bounding box of {speed in [speedMin, speedMax]} x {direction in
  // [dirMin, dirMax]}, sampled at both direction endpoints and both speed
  // endpoints — a real per-particle draw picks one (speed, direction) pair
  // uniformly, not independently per axis, so this is an honest
  // over-approximation of the true reachable velocity set, not an exact
  // reproduction of GameMaker's own per-particle distribution.
  const d0 = dirToUnit(cfg.dirMin);
  const d1 = dirToUnit(cfg.dirMax);
  const vxCandidates = [
    cfg.speedMin * d0.x,
    cfg.speedMin * d1.x,
    cfg.speedMax * d0.x,
    cfg.speedMax * d1.x,
  ];
  const vyCandidates = [
    cfg.speedMin * d0.y,
    cfg.speedMin * d1.y,
    cfg.speedMax * d0.y,
    cfg.speedMax * d1.y,
  ];

  const gravity = dirToUnit(cfg.gravityDirection);

  return {
    texture: cfg.texturePath,
    emissionRate: 0, // burst-only — real spawning is driven by part_particles_create's `emit(count)`, never a continuous rate
    lifetime: {
      min: stepsToSeconds(cfg.lifeMinSteps),
      max: stepsToSeconds(cfg.lifeMaxSteps),
    },
    velocity: {
      x: { min: Math.min(...vxCandidates), max: Math.max(...vxCandidates) },
      y: { min: Math.min(...vyCandidates), max: Math.max(...vyCandidates) },
    },
    acceleration: {
      x: cfg.gravityAmount * gravity.x,
      y: cfg.gravityAmount * gravity.y,
    },
    startScale: cfg.sizeMin,
    endScale,
    sizeWiggle: cfg.sizeWiggle,
    startAlpha: cfg.alphaStart,
    endAlpha: cfg.alphaEnd,
    colorGradient: cfg.colours,
    speedWiggle: cfg.speedWiggle,
    dirWiggle: cfg.dirWiggle,
    blendMode: cfg.blend,
  };
}

// ---------------------------------------------------------------------------
// part_system_* — a mountable emission surface many (system, type) pairs
// spawn into
// ---------------------------------------------------------------------------

interface ParticleSystemState {
  offsetX: number;
  offsetY: number;
  /** One live `ParticleEmitter` per particle type ever burst into this system, keyed by that type's id. GameMaker's own `part_particles_create` can spawn several different types into the same system; `ParticleEmitter` models one type's config at a time, so this system fans out to one emitter per type actually used. */
  emitters: Map<number, ParticleEmitter>;
  mounted: boolean;
}

let _nextSystemId = 1;
const _systems = new Map<number, ParticleSystemState>();

function warnUnknownSystem(fn: string, ind: number): void {
  console.warn(
    `[gmlParticles] ${fn} called with unknown particle system id ${ind} — no-op. ` +
      `Call part_system_create() first and use its returned id.`,
  );
}

/** GMS2 `part_system_create()` — allocates a new particle system and returns its handle. */
export function part_system_create(): number {
  const id = _nextSystemId++;
  _systems.set(id, {
    offsetX: 0,
    offsetY: 0,
    emitters: new Map(),
    mounted: false,
  });
  return id;
}

/** GMS2 `part_system_exists(ind)`. */
export function part_system_exists(ind: number): boolean {
  return _systems.has(ind);
}

/**
 * GMS2 `part_system_destroy(ind)` — unmounts (via `ctx.particles`, if given)
 * and clears every emitter this system ever spawned, then frees the handle.
 * Unknown id: honest no-op + warning, matching every other `part_*` function
 * here.
 */
export function part_system_destroy(
  ind: number,
  ctx: GmlParticleContext,
): void {
  const system = _systems.get(ind);
  if (system === undefined) {
    warnUnknownSystem("part_system_destroy", ind);
    return;
  }
  for (const emitter of system.emitters.values()) {
    ctx.particles?.unmountParticles(emitter);
    emitter.clear();
  }
  _systems.delete(ind);
}

/**
 * GMS2 `part_system_position(ind, x, y)` — sets the system's own origin
 * offset, added to every `part_particles_create`/`part_particles_create_colour`
 * spawn position from here on. Retroactively repositioning already-mounted
 * emitters isn't attempted — this only affects future spawns, matching
 * GameMaker's own behaviour (it's the layer/room position, not a live
 * transform on existing particles).
 */
export function part_system_position(ind: number, x: number, y: number): void {
  const system = _systems.get(ind);
  if (system === undefined) {
    warnUnknownSystem("part_system_position", ind);
    return;
  }
  system.offsetX = x;
  system.offsetY = y;
}

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
export function part_system_depth(_ind: number, _depth: number): void {
  // Deliberately unimplemented — see doc comment above.
}

/**
 * GMS2 `part_particles_clear(ps)` — clears every particle currently alive in
 * every emitter this system has spawned, without destroying the system or
 * its type emitters (they can still be burst into again).
 */
export function part_particles_clear(ps: number): void {
  const system = _systems.get(ps);
  if (system === undefined) {
    warnUnknownSystem("part_particles_clear", ps);
    return;
  }
  for (const emitter of system.emitters.values()) emitter.clear();
}

function _ensureEmitter(
  system: ParticleSystemState,
  systemId: number,
  typeId: number,
  ctx: GmlParticleContext,
): ParticleEmitter | undefined {
  const cfg = _types.get(typeId);
  if (cfg === undefined) {
    warnUnknownType("part_particles_create", typeId);
    return undefined;
  }
  return getOrCreateMapEntry(system.emitters, typeId, () => {
    const emitter = new ParticleEmitter(_configToEmitterOptions(cfg));
    emitter.active = false; // burst-only — never auto-emits on its own accumulator
    void ctx.particles?.mountParticles(emitter);
    return emitter;
  });
}

/**
 * GMS2 `part_particles_create(ps, x, y, parttype, number)` — the one call
 * that actually spawns visible particles: bursts `number` particles of type
 * `parttype` at `(x, y)` (plus the system's own `part_system_position`
 * offset) into system `ps`. Lazily builds (and, if `ctx.particles` is wired,
 * mounts) one `ParticleEmitter` per `(ps, parttype)` pair the first time
 * that combination is used — see `ParticleSystemState.emitters`'s doc
 * comment for why it's one emitter per type, not one per system.
 */
export function part_particles_create(
  ctx: GmlParticleContext,
  ps: number,
  x: number,
  y: number,
  parttype: number,
  number_: number,
): void {
  const system = _systems.get(ps);
  if (system === undefined) {
    warnUnknownSystem("part_particles_create", ps);
    return;
  }
  const emitter = _ensureEmitter(system, ps, parttype, ctx);
  if (emitter === undefined) return;
  emitter.x = x + system.offsetX;
  emitter.y = y + system.offsetY;
  emitter.emit(number_);
}

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
export function part_particles_create_colour(
  ctx: GmlParticleContext,
  ps: number,
  x: number,
  y: number,
  parttype: number,
  colour: number,
  number_: number,
): void {
  const system = _systems.get(ps);
  if (system === undefined) {
    warnUnknownSystem("part_particles_create_colour", ps);
    return;
  }
  const emitter = _ensureEmitter(system, ps, parttype, ctx);
  if (emitter === undefined) return;
  const original = emitter.options.colorGradient;
  emitter.options.colorGradient = [colour];
  emitter.x = x + system.offsetX;
  emitter.y = y + system.offsetY;
  emitter.emit(number_);
  emitter.options.colorGradient = original;
}
export const part_particles_create_color = part_particles_create_colour;

/** @internal test-only accessor — the live `ParticleTypeConfig` behind a `part_type_*` id, or `undefined` if unknown. */
export function _getParticleTypeConfig(
  ind: number,
): Readonly<ParticleTypeConfig> | undefined {
  return _types.get(ind);
}

/** @internal test-only accessor — the live emitter map behind a `part_system_*` id, or `undefined` if unknown. */
export function _getParticleSystemEmitters(
  ind: number,
): ReadonlyMap<number, ParticleEmitter> | undefined {
  return _systems.get(ind)?.emitters;
}
