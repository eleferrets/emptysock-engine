/**
 * `PhysicsSystem3D` — full 3D rigid-body physics via
 * `@dimforge/rapier3d-compat` (or the deterministic-compat build, §15.2).
 *
 * It exposes a handle-returning `addBody()` API rather than a `PhysicsBody`
 * component (there is no 3D component) — there is no plan to retrofit it
 * onto `PhysicsBody`/bitECS, since `SceneLifecycle` (Game.ts) only has room
 * for one physics system slot and 3D games are the minority case
 * (the engine design notes round 1 item 3: "3D is not held to the same
 * 'hide everything' bar as 2D"). A 3D game constructs and owns this
 * directly, the same way `{ manageLifecycle: false }` hands back raw
 * systems for manual ownership — see `Game.ts`'s escape hatch. It adds
 * fixed-timestep accumulation + interpolation alpha (matching the 2D
 * `PhysicsSystem`) and the deterministic-build swap.
 *
 * Quick-start:
 *   const physics = new PhysicsSystem3D();
 *   await physics.init({ gravity: { x: 0, y: -9.81, z: 0 } });
 *   const box = physics.addBody({ shape: "box", bodyType: "dynamic", position: { x: 0, y: 5, z: 0 } });
 *   // in game loop (onUpdate — must NOT be async):
 *   physics.update(dt);
 *   const alpha = physics.interpolationAlpha; // for a renderer to lerp with
 *   // when the scene unloads, ALWAYS call destroy() — see CLAUDE.md
 *   // "PhysicsSystem3D must be destroyed".
 *   physics.destroy();
 */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}
export interface Quat {
  x: number;
  y: number;
  z: number;
  w: number;
}
export type BodyType3D = "dynamic" | "static" | "kinematic";
export type Shape3D = "box" | "sphere" | "capsule" | "cylinder" | "cone";
export interface PhysicsBody3DOptions {
  bodyType?: BodyType3D;
  shape?: Shape3D;
  halfExtents?: Vec3;
  radius?: number;
  halfHeight?: number;
  position?: Vec3;
  rotation?: Quat;
  density?: number;
  restitution?: number;
  friction?: number;
  isSensor?: boolean;
  ccdEnabled?: boolean;
}
export interface RaycastHit {
  bodyIndex: number;
  distance: number;
  point: Vec3;
  normal: Vec3;
}
export interface CollisionEvent {
  bodyA: number;
  bodyB: number;
}
type CollisionCallback = (event: CollisionEvent) => void;
export interface Physics3DHandle {
  readonly bodyIndex: number;
  setPosition(pos: Vec3): void;
  getPosition(): Vec3;
  getRotation(): Quat;
  setLinearVelocity(vel: Vec3, wakeUp?: boolean): void;
  getLinearVelocity(): Vec3;
  setAngularVelocity(vel: Vec3, wakeUp?: boolean): void;
  getAngularVelocity(): Vec3;
  applyForce(force: Vec3, wakeUp?: boolean): void;
  applyImpulse(impulse: Vec3, wakeUp?: boolean): void;
  applyTorqueImpulse(torque: Vec3, wakeUp?: boolean): void;
  setLinearDamping(damping: number): void;
  setAngularDamping(damping: number): void;
  setGravityScale(scale: number): void;
  isGrounded(distance?: number): boolean;
}
export interface PhysicsSystem3DOptions {
  gravity?: Vec3;
  /** Seconds per physics step (§10.3). Default 1/60. */
  fixedTimestep?: number;
  /** §15.2 — swap in the deterministic-compat WASM build. */
  deterministic?: boolean;
}
interface Snapshot3D {
  position: Vec3;
  rotation: Quat;
}
export declare class PhysicsSystem3D {
  private _rapier;
  private _world;
  private _eventQueue;
  private readonly _bodies;
  private readonly _handleToIndex;
  private readonly _colliderHandleToIndex;
  private _nextIndex;
  private readonly _onEnterCallbacks;
  private readonly _onExitCallbacks;
  private readonly _timestep;
  private readonly _snapshots;
  init(options?: PhysicsSystem3DOptions): Promise<void>;
  onCollisionEnter(cb: CollisionCallback): void;
  onCollisionExit(cb: CollisionCallback): void;
  /** How far (0..1) the current render frame sits between the last two physics steps. */
  get interpolationAlpha(): number;
  /** Linearly interpolated transform for a body, for rendering. */
  getInterpolatedTransform(bodyIndex: number, alpha?: number): Snapshot3D;
  addBody(options?: PhysicsBody3DOptions): Physics3DHandle;
  removeBody(index: number): void;
  castRay(
    origin: Vec3,
    direction: Vec3,
    maxDistance: number,
  ): RaycastHit | null;
  /**
   * Fixed-timestep accumulation (§10.3), mirroring the 2D `PhysicsSystem`:
   * `dt` (real frame time) accumulates and the world steps zero or more
   * times at exactly `fixedTimestep` seconds each, keeping a
   * previous/current snapshot per body for `getInterpolatedTransform`.
   */
  update(dt: number): void;
  private _step;
  private _drainCollisionEvents;
  /**
   * Free all Rapier WASM memory. MUST be called when the scene unloads —
   * see CLAUDE.md "PhysicsSystem3D must be destroyed".
   */
  destroy(): void;
  [Symbol.dispose](): void;
  get isInitialized(): boolean;
}
export {};
