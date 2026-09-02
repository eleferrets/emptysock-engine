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

  // Transform
  setPosition(pos: Vec3): void;
  getPosition(): Vec3;
  getRotation(): Quat;

  // Velocity
  setLinearVelocity(vel: Vec3, wakeUp?: boolean): void;
  getLinearVelocity(): Vec3;
  setAngularVelocity(vel: Vec3, wakeUp?: boolean): void;
  getAngularVelocity(): Vec3;

  // Forces — use applyForce for continuous per-frame forces, applyImpulse for one-shot kicks
  applyForce(force: Vec3, wakeUp?: boolean): void;
  applyImpulse(impulse: Vec3, wakeUp?: boolean): void;
  applyTorqueImpulse(torque: Vec3, wakeUp?: boolean): void;

  // Damping
  setLinearDamping(damping: number): void;
  setAngularDamping(damping: number): void;

  // Gravity
  setGravityScale(scale: number): void;

  /**
   * Raycast downward from the body's centre by `distance` world units.
   * Returns true if the ray hits any other collider within that distance.
   * More reliable than testing linvel.y (which passes for slow-falling bodies).
   */
  isGrounded(distance?: number): boolean;
}

type Rapier3D = typeof import("@dimforge/rapier3d-compat");
type RapierEventQueue = InstanceType<Rapier3D["EventQueue"]>;

export class PhysicsSystem3D {
  private _rapier: Rapier3D | null = null;
  private _world: InstanceType<Rapier3D["World"]> | null = null;
  private _eventQueue: RapierEventQueue | null = null;
  /** index → rigidBody */
  private readonly _bodies: Map<number, InstanceType<Rapier3D["RigidBody"]>> =
    new Map();
  /** rigidBody handle → index */
  private readonly _handleToIndex: Map<number, number> = new Map();
  /** collider handle → index (for collision event lookup) */
  private readonly _colliderHandleToIndex: Map<number, number> = new Map();
  private _nextIndex = 0;
  private readonly _onEnterCallbacks: CollisionCallback[] = [];
  private readonly _onExitCallbacks: CollisionCallback[] = [];

  async init(gravity: Vec3 = { x: 0, y: -9.81, z: 0 }): Promise<void> {
    const R = await import("@dimforge/rapier3d-compat");
    await R.init();
    this._rapier = R;
    this._world = new R.World(gravity);
    this._eventQueue = new R.EventQueue(true);
  }

  /** Register a callback fired when two bodies begin overlapping this frame. */
  onCollisionEnter(cb: CollisionCallback): void {
    this._onEnterCallbacks.push(cb);
  }

  /** Register a callback fired when two bodies stop overlapping. */
  onCollisionExit(cb: CollisionCallback): void {
    this._onExitCallbacks.push(cb);
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
        if (world === null || R === null) return false;
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
      // Remove any collider handle mappings for this body
      for (const [ch, idx] of this._colliderHandleToIndex) {
        if (idx === index) this._colliderHandleToIndex.delete(ch);
      }
      this._world.removeRigidBody(body);
      this._bodies.delete(index);
    }
  }

  /**
   * Cast a ray from `origin` in `direction` (does not need to be normalised)
   * up to `maxDistance` world units. Returns the closest hit, or null.
   */
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

  /** Step the simulation by dt seconds. Call once per game-loop tick. */
  update(dt: number): void {
    if (this._world === null || this._rapier === null) return;
    // Clamp dt to avoid instability at very low frame rates
    this._world.timestep = Math.max(0.001, Math.min(dt, 0.05));
    this._world.step(this._eventQueue ?? undefined);
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
   * Free all Rapier WASM memory. MUST be called when the scene unloads.
   * The GC cannot see Rapier's WASM heap — not calling this leaks memory permanently.
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
  }

  [Symbol.dispose](): void { this.destroy(); }

  get isInitialized(): boolean {
    return this._world !== null;
  }
}
