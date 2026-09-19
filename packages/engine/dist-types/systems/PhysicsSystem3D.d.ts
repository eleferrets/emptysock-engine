/**
 * PhysicsSystem3D — full 3D rigid-body physics via @dimforge/rapier3d-compat.
 *
 * Quick-start:
 *   const physics = new PhysicsSystem3D();
 *   await physics.init({ x: 0, y: -9.81, z: 0 });
 *
 *   const box = physics.addBody({ shape: 'box', bodyType: 'dynamic', position: { x: 0, y: 5, z: 0 } });
 *   box.setLinearDamping(0.2);
 *
 *   physics.onCollisionEnter((a, b) => console.log('hit', a, b));
 *
 *   // in game loop (onUpdate — must NOT be async):
 *   physics.update(dt);
 *   const pos = box.getPosition();
 *
 *   // When the scene unloads, ALWAYS call destroy() — Rapier3D holds WASM
 *   // memory the GC cannot see.  See CLAUDE.md § PhysicsSystem3D must be destroyed.
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
  /** Half-extents for box shape (default 0.5, 0.5, 0.5). */
  halfExtents?: Vec3;
  /** Radius for sphere / capsule / cylinder / cone. */
  radius?: number;
  /** Half-height for capsule / cylinder / cone. */
  halfHeight?: number;
  position?: Vec3;
  rotation?: Quat;
  density?: number;
  restitution?: number;
  friction?: number;
  /** When true the collider generates overlap events but does not block movement. */
  isSensor?: boolean;
  /** Enable continuous collision detection for fast-moving bodies (bullets, etc.). */
  ccdEnabled?: boolean;
}
export interface RaycastHit {
  /** The body that was hit. */
  bodyIndex: number;
  /** Distance along the ray from the origin to the hit point. */
  distance: number;
  /** World-space hit point. */
  point: Vec3;
  /** Surface normal at the hit point. */
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
  /**
   * Raycast downward from the body's centre by `distance` world units.
   * Returns true if the ray hits any other collider within that distance.
   * More reliable than testing linvel.y (which passes for slow-falling bodies).
   */
  isGrounded(distance?: number): boolean;
}
export declare class PhysicsSystem3D {
  private _rapier;
  private _world;
  private _eventQueue;
  /** index → rigidBody */
  private readonly _bodies;
  /** rigidBody handle → index */
  private readonly _handleToIndex;
  /** collider handle → index (for collision event lookup) */
  private readonly _colliderHandleToIndex;
  private _nextIndex;
  private readonly _onEnterCallbacks;
  private readonly _onExitCallbacks;
  init(gravity?: Vec3): Promise<void>;
  /** Register a callback fired when two bodies begin overlapping this frame. */
  onCollisionEnter(cb: CollisionCallback): void;
  /** Register a callback fired when two bodies stop overlapping. */
  onCollisionExit(cb: CollisionCallback): void;
  addBody(options?: PhysicsBody3DOptions): Physics3DHandle;
  removeBody(index: number): void;
  /**
   * Cast a ray from `origin` in `direction` (does not need to be normalised)
   * up to `maxDistance` world units. Returns the closest hit, or null.
   */
  castRay(
    origin: Vec3,
    direction: Vec3,
    maxDistance: number,
  ): RaycastHit | null;
  /** Step the simulation by dt seconds. Call once per game-loop tick. */
  update(dt: number): void;
  private _drainCollisionEvents;
  /**
   * Free all Rapier WASM memory. MUST be called when the scene unloads.
   * The GC cannot see Rapier's WASM heap — not calling this leaks memory permanently.
   */
  destroy(): void;
  [Symbol.dispose](): void;
  get isInitialized(): boolean;
}
export {};
