import type RAPIER_TYPE from "@dimforge/rapier2d-compat";
import type { Entity } from "../Entity.js";
import type { Scene } from "../Scene.js";
import type { GmlActionContext } from "../compat/gmlActions.js";
type RapierModule = typeof RAPIER_TYPE;
type World = InstanceType<RapierModule["World"]>;
export interface PhysicsSystemOptions {
  gravity?: {
    x: number;
    y: number;
  };
  /**
   * Seconds per physics step (ENGINE_DESIGN.md §10.3/§15.2 — fixed timestep,
   * independent of render framerate). Default 1/60.
   */
  fixedTimestep?: number;
  /**
   * ENGINE_DESIGN.md §15.2: swap `@dimforge/rapier2d-compat` for
   * `@dimforge/rapier2d-deterministic-compat` — same API, a slower
   * non-SIMD WASM build that's bit-for-bit reproducible across platforms.
   * Off by default; most games never need it and shouldn't pay the cost.
   */
  deterministic?: boolean;
}
interface Snapshot {
  x: number;
  y: number;
  rotation: number;
}
interface Vec2 {
  x: number;
  y: number;
}
/** Thrown by the query methods below when called before `init()` (or after `destroy()`). */
export declare class PhysicsNotInitializedError extends Error {
  constructor();
}
/** Result of `PhysicsSystem.raycast` — `null` means the ray genuinely hit nothing. */
export interface RaycastHit2D {
  entity: Entity;
  point: Vec2;
  normal: Vec2;
  toi: number;
}
/** Live state of a registered `PhysicsBody`, as read straight from Rapier. */
export interface BodyState2D {
  position: Vec2;
  rotation: number;
  velocity: Vec2;
  type: string;
  isSensor: boolean;
}
/**
 * `PhysicsSystem` (ECS core) — wraps Rapier2D behind `PhysicsBody` (ENGINE_DESIGN.md
 * §6). One instance per scene, created/destroyed by `Game.loadScene`/
 * `unloadScene` (§4) unless `manageLifecycle: false` is passed.
 *
 * Fixed timestep + interpolation (§10.3): `update(scene, dt)` accumulates
 * real frame time and steps Rapier at exactly `fixedTimestep` seconds per
 * step, however many (zero or more) that frame's `dt` calls for. Between
 * steps it keeps the previous and current post-step transform for every
 * registered body, and exposes `interpolationAlpha` (0..1, how far into the
 * *next* step the current render frame falls) plus `getInterpolatedTransform`
 * so a renderer can lerp `previous -> current` by `alpha` instead of
 * snapping bodies to whatever position the last physics step left them at —
 * this is the API surface the Rendering track consumes; this track does not
 * wire it into an actual renderer.
 */
export declare class PhysicsSystem {
  private _RAPIER;
  private _world;
  private _eventQueue;
  private readonly _timestep;
  private readonly _records;
  private readonly _colliderToEid;
  /** Active sensor pairs, key `min(eid1,eid2):max(eid1,eid2)` — drives sensorStay. */
  private readonly _activeSensorPairs;
  /**
   * Optional — set via `attachGmlDispatch()` by a game that wants physics
   * contacts to also fire a GMS2-imported object's GML `onCollideWith<Type>`
   * handler (CLAUDE.md's "GML behavior dispatch" entry: a `physicsObject:
   * true` GameMaker object still has a real Collision event in GameMaker
   * even though it also gets a `PhysicsBody`). `undefined` by default —
   * `PhysicsSystem` has no GML concept otherwise and must not require one to
   * function, the same "engine defines the interface, whoever has a live
   * instance wires the concrete implementation" pattern as `StorageAdapter`.
   */
  private _gmlContext;
  init(options?: PhysicsSystemOptions): Promise<void>;
  get world(): World;
  /** How far (0..1) the current render frame sits between the last two physics steps. */
  get interpolationAlpha(): number;
  /** Linearly interpolated transform for a registered body, for rendering. */
  getInterpolatedTransform(entity: Entity, alpha?: number): Snapshot;
  /**
   * Advance the simulation by `dt` real seconds: registers any new
   * `PhysicsBody`s found on `scene`, steps Rapier zero or more times at the
   * fixed timestep, and dispatches collision/sensor callbacks after each
   * step (ENGINE_DESIGN.md §4 steps 3–4). Called from `Game.update()`.
   */
  /**
   * Opts this `PhysicsSystem` into also dispatching a real physics contact
   * to a `GmlBehaviorState` entity's `onCollideWith<Type>` handler, for GML
   * fidelity on `physicsObject: true` GMS2-imported objects (see this
   * field's own doc comment). Pass a `GmlActionContext` once, typically the
   * same one a game already builds for `GmlBehaviorSystem`/`gmlActions.ts`
   * calls; omit this call entirely for a project with no GML behaviors —
   * `_drainCollisionEvents` no-ops the dispatch when this is unset.
   */
  attachGmlDispatch(ctx: GmlActionContext): void;
  update(scene: Scene, dt: number): void;
  private _registerNewBodies;
  private _registerEntity;
  private _unregisterDeadBodies;
  private _step;
  private _drainCollisionEvents;
  /**
   * Cast a ray into the world and return the first collider it hits, mapped
   * back to the registered `Entity` that owns it (ENGINE_DESIGN.md §8 — the
   * primitive the MCP query bridge's `raycast2d` query wraps). `null` means
   * a real "nothing along this ray" result, distinct from the
   * `PhysicsNotInitializedError` thrown when there is no world to query at
   * all — callers (the query bridge in particular) must not conflate the
   * two into a single "empty" shape.
   */
  raycast(
    origin: Vec2,
    direction: Vec2,
    maxToi?: number,
    solid?: boolean,
  ): RaycastHit2D | null;
  /**
   * All registered entities whose collider overlaps a circle at `center`
   * with radius `radius` (ENGINE_DESIGN.md §8's `overlapCircle2d` query
   * primitive). Empty array is a real "nothing overlapping" result;
   * `PhysicsNotInitializedError` is the "no world to query" case.
   */
  overlapCircle(center: Vec2, radius: number): Entity[];
  /**
   * Live Rapier state for a registered `PhysicsBody`, straight off the
   * rigid body — the primitive `physics_body_state` in `emptysock-mcp`
   * wraps. `undefined` means "this entity has no registered body" (not yet
   * stepped, wrong entity, dead handle) — a real, meaningful absence, not
   * the "no world at all" case `PhysicsNotInitializedError` covers.
   */
  getBodyState(entity: Entity): BodyState2D | undefined;
  /**
   * ENGINE_DESIGN.md's PhysicsSystem3D-must-be-destroyed decision (CLAUDE.md)
   * applies here too: Rapier allocates its world/body buffers in WASM linear
   * memory outside the JS heap, invisible to the GC. Always call this when a
   * scene unloads.
   */
  destroy(): void;
}
export {};
//# sourceMappingURL=PhysicsSystem.d.ts.map
