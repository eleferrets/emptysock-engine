/**
 * `PhysicsSystem3D` — full 3D rigid-body physics via
 * `@dimforge/rapier3d-compat` (or the deterministic-compat build, §15.2).
 *
 * It exposes a handle-returning `addBody()` API rather than a `PhysicsBody`
 * component (there is no 3D component) — there is no plan to retrofit it
 * onto `PhysicsBody`/bitECS, since `SceneLifecycle` (Game.ts) only has room
 * for one physics system slot and 3D games are the minority case
 * (ENGINE_DESIGN.md §10 round 1 item 3: "3D is not held to the same
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

import type * as _Rapier3DModule from "@dimforge/rapier3d-compat";
import {
  FixedTimestepAccumulator,
  lerpSnapshot,
} from "./FixedTimestepAccumulator.js";

type Rapier3D = typeof _Rapier3DModule;
type RapierEventQueue = InstanceType<Rapier3D["EventQueue"]>;

interface Snapshot3D {
  position: Vec3;
  rotation: Quat;
}

export class PhysicsSystem3D {
  private _rapier: Rapier3D | null = null;
  private _world: InstanceType<Rapier3D["World"]> | null = null;
  private _eventQueue: RapierEventQueue | null = null;
  private readonly _bodies: Map<number, InstanceType<Rapier3D["RigidBody"]>> =
    new Map();
  private readonly _handleToIndex: Map<number, number> = new Map();
  private readonly _colliderHandleToIndex: Map<number, number> = new Map();
  private _nextIndex = 0;
  private readonly _onEnterCallbacks: CollisionCallback[] = [];
  private readonly _onExitCallbacks: CollisionCallback[] = [];

  private readonly _timestep = new FixedTimestepAccumulator();
  private readonly _snapshots = new Map<
    number,
    { previous: Snapshot3D; current: Snapshot3D }
  >();

  async init(options: PhysicsSystem3DOptions = {}): Promise<void> {
    // See the matching comment in ecs/systems/PhysicsSystem.ts — a
    // non-literal specifier keeps the deterministic build an optional,
    // opt-in dependency rather than a hard one.
    const moduleName = options.deterministic
      ? "@dimforge/rapier3d-deterministic-compat"
      : "@dimforge/rapier3d-compat";
    const R = (await import(moduleName)) as unknown as Rapier3D;
    await R.init();
    this._rapier = R;
    this._timestep.fixedTimestep = options.fixedTimestep ?? 1 / 60;
    const gravity = options.gravity ?? { x: 0, y: -9.81, z: 0 };
    this._world = new R.World(gravity);
    this._eventQueue = new R.EventQueue(true);
  }

  onCollisionEnter(cb: CollisionCallback): void {
    this._onEnterCallbacks.push(cb);
  }

  onCollisionExit(cb: CollisionCallback): void {
    this._onExitCallbacks.push(cb);
  }

  /** How far (0..1) the current render frame sits between the last two physics steps. */
  get interpolationAlpha(): number {
    return this._timestep.alpha;
  }

  /** Linearly interpolated transform for a body, for rendering. */
  getInterpolatedTransform(
    bodyIndex: number,
    alpha = this._timestep.alpha,
  ): Snapshot3D {
    return lerpSnapshot(
      (index) => this._snapshots.get(index),
      bodyIndex,
      alpha,
      () => ({
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
      }),
      (previous, current, a) => ({
        position: {
          x:
            previous.position.x +
            (current.position.x - previous.position.x) * a,
          y:
            previous.position.y +
            (current.position.y - previous.position.y) * a,
          z:
            previous.position.z +
            (current.position.z - previous.position.z) * a,
        },
        // Rotation interpolation is left linear-per-component (not slerp) —
        // good enough for the alpha window between two fixed steps, which is
        // never more than one step's worth of rotation; a renderer wanting a
        // true slerp can do it itself from `previous`/`current` quats.
        rotation: current.rotation,
      }),
    );
  }

  addBody(options: PhysicsBody3DOptions = {}): Physics3DHandle {
    const R = this._rapier;
    const world = this._world;
    if (R === null || world === null) {
      throw new Error("[PhysicsSystem3D] Call init() before addBody().");
    }

    let rbDesc: InstanceType<Rapier3D["RigidBodyDesc"]>;
    switch (options.bodyType ?? "dynamic") {
      case "static":
        rbDesc = R.RigidBodyDesc.fixed();
        break;
      case "kinematic":
        rbDesc = R.RigidBodyDesc.kinematicPositionBased();
        break;
      default:
        rbDesc = R.RigidBodyDesc.dynamic();
        break;
    }
    const pos = options.position ?? { x: 0, y: 0, z: 0 };
    rbDesc.setTranslation(pos.x, pos.y, pos.z);
    if (options.rotation !== undefined) {
      rbDesc.setRotation(options.rotation);
    }
    if (options.ccdEnabled === true) {
      rbDesc.setCcdEnabled(true);
    }

    const body = world.createRigidBody(rbDesc);
    const index = this._nextIndex++;
    this._bodies.set(index, body);
    this._handleToIndex.set(body.handle, index);

    let colDesc: InstanceType<Rapier3D["ColliderDesc"]>;
    const shape = options.shape ?? "box";
    switch (shape) {
      case "sphere":
        colDesc = R.ColliderDesc.ball(options.radius ?? 0.5);
        break;
      case "capsule":
        colDesc = R.ColliderDesc.capsule(
          options.halfHeight ?? 0.5,
          options.radius ?? 0.25,
        );
        break;
      case "cylinder":
        colDesc = R.ColliderDesc.cylinder(
          options.halfHeight ?? 0.5,
          options.radius ?? 0.5,
        );
        break;
      case "cone":
        colDesc = R.ColliderDesc.cone(
          options.halfHeight ?? 0.5,
          options.radius ?? 0.5,
        );
        break;
      default: {
        const he = options.halfExtents ?? { x: 0.5, y: 0.5, z: 0.5 };
        colDesc = R.ColliderDesc.cuboid(he.x, he.y, he.z);
      }
    }
    colDesc.setDensity(options.density ?? 1.0);
    colDesc.setRestitution(options.restitution ?? 0.0);
    colDesc.setFriction(options.friction ?? 0.7);
    if (options.isSensor === true) colDesc.setSensor(true);
    const collider = world.createCollider(colDesc, body);
    this._colliderHandleToIndex.set(collider.handle, index);

    const initialSnapshot: Snapshot3D = {
      position: { ...pos },
      rotation: options.rotation ?? { x: 0, y: 0, z: 0, w: 1 },
    };
    this._snapshots.set(index, {
      previous: { ...initialSnapshot },
      current: { ...initialSnapshot },
    });

    const handle: Physics3DHandle = {
      bodyIndex: index,
      setPosition: (p) => {
        body.setTranslation(p, true);
      },
      getPosition: () => {
        const t = body.translation();
        return { x: t.x, y: t.y, z: t.z };
      },
      getRotation: () => {
        const r = body.rotation();
        return { x: r.x, y: r.y, z: r.z, w: r.w };
      },
      setLinearVelocity: (v, wake = true) => {
        body.setLinvel(v, wake);
      },
      getLinearVelocity: () => {
        const v = body.linvel();
        return { x: v.x, y: v.y, z: v.z };
      },
      setAngularVelocity: (v, wake = true) => {
        body.setAngvel(v, wake);
      },
      getAngularVelocity: () => {
        const v = body.angvel();
        return { x: v.x, y: v.y, z: v.z };
      },
      applyForce: (f, wake = true) => {
        body.addForce(f, wake);
      },
      applyImpulse: (f, wake = true) => {
        body.applyImpulse(f, wake);
      },
      applyTorqueImpulse: (t, wake = true) => {
        body.applyTorqueImpulse(t, wake);
      },
      setLinearDamping: (d) => {
        body.setLinearDamping(d);
      },
      setAngularDamping: (d) => {
        body.setAngularDamping(d);
      },
      setGravityScale: (s) => {
        body.setGravityScale(s, true);
      },
      isGrounded: (distance = 0.15) => {
        const t = body.translation();
        const origin = { x: t.x, y: t.y, z: t.z };
        const dir = { x: 0, y: -1, z: 0 };
        const ray = new R.Ray(origin, dir);
        const hit = world.castRay(
          ray,
          distance,
          true,
          undefined,
          undefined,
          undefined,
          body,
        );
        return hit !== null;
      },
    };

    return handle;
  }

  removeBody(index: number): void {
    const body = this._bodies.get(index);
    if (body !== undefined && this._world !== null) {
      this._handleToIndex.delete(body.handle);
      for (const [ch, idx] of this._colliderHandleToIndex) {
        if (idx === index) this._colliderHandleToIndex.delete(ch);
      }
      this._world.removeRigidBody(body);
      this._bodies.delete(index);
      this._snapshots.delete(index);
    }
  }

  castRay(
    origin: Vec3,
    direction: Vec3,
    maxDistance: number,
  ): RaycastHit | null {
    if (this._world === null || this._rapier === null) return null;
    const R = this._rapier;
    const ray = new R.Ray(origin, direction);
    const hit = this._world.castRayAndGetNormal(ray, maxDistance, true);
    if (hit === null) return null;
    const n = hit.normal;
    const point = {
      x: origin.x + direction.x * hit.timeOfImpact,
      y: origin.y + direction.y * hit.timeOfImpact,
      z: origin.z + direction.z * hit.timeOfImpact,
    };
    const rbHandle = hit.collider.parent()?.handle ?? -1;
    const bodyIndex = this._handleToIndex.get(rbHandle) ?? -1;
    return {
      bodyIndex,
      distance: hit.timeOfImpact,
      point,
      normal: { x: n.x, y: n.y, z: n.z },
    };
  }

  /**
   * Fixed-timestep accumulation (§10.3), mirroring the 2D `PhysicsSystem`:
   * `dt` (real frame time) accumulates and the world steps zero or more
   * times at exactly `fixedTimestep` seconds each, keeping a
   * previous/current snapshot per body for `getInterpolatedTransform`.
   */
  update(dt: number): void {
    if (this._world === null || this._rapier === null) return;
    this._timestep.advance(dt, (fixedDt) => this._step(fixedDt));
  }

  private _step(fixedDt: number): void {
    const world = this._world;
    if (world === null) return;
    world.timestep = fixedDt;
    world.step(this._eventQueue ?? undefined);

    for (const [index, body] of this._bodies) {
      const t = body.translation();
      const r = body.rotation();
      const snap = this._snapshots.get(index);
      if (snap === undefined) continue;
      snap.previous = snap.current;
      snap.current = {
        position: { x: t.x, y: t.y, z: t.z },
        rotation: { x: r.x, y: r.y, z: r.z, w: r.w },
      };
    }

    this._drainCollisionEvents();
  }

  private _drainCollisionEvents(): void {
    if (this._eventQueue === null) return;
    if (
      this._onEnterCallbacks.length === 0 &&
      this._onExitCallbacks.length === 0
    ) {
      this._eventQueue.clear();
      return;
    }

    this._eventQueue.drainCollisionEvents(
      (handle1: number, handle2: number, started: boolean) => {
        const a = this._colliderHandleToIndex.get(handle1) ?? -1;
        const b = this._colliderHandleToIndex.get(handle2) ?? -1;
        const callbacks = started
          ? this._onEnterCallbacks
          : this._onExitCallbacks;
        for (const cb of callbacks) cb({ bodyA: a, bodyB: b });
      },
    );
  }

  /**
   * Free all Rapier WASM memory. MUST be called when the scene unloads —
   * see CLAUDE.md "PhysicsSystem3D must be destroyed".
   */
  destroy(): void {
    this._eventQueue?.free();
    this._eventQueue = null;
    this._world?.free();
    this._world = null;
    this._rapier = null;
    this._bodies.clear();
    this._handleToIndex.clear();
    this._colliderHandleToIndex.clear();
    this._snapshots.clear();
    this._timestep.reset();
  }

  [Symbol.dispose](): void {
    this.destroy();
  }

  get isInitialized(): boolean {
    return this._world !== null;
  }
}
