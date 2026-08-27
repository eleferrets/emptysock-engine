/**
 * PhysicsSystem3D — full 3D rigid-body physics via @dimforge/rapier3d-compat.
 *
 * Usage:
 *   const physics = new PhysicsSystem3D();
 *   await physics.init({ x: 0, y: -9.81, z: 0 });
 *   const box = physics.addBody({ shape: 'box', bodyType: 'dynamic', position: { x: 0, y: 5, z: 0 } });
 *   // in game loop:
 *   physics.update(dt);
 *   const pos = box.getPosition();
 */

export interface Vec3 { x: number; y: number; z: number; }
export interface Quat { x: number; y: number; z: number; w: number; }

export type BodyType3D = 'dynamic' | 'static' | 'kinematic';
export type Shape3D    = 'box' | 'sphere' | 'capsule' | 'cylinder' | 'cone';

export interface PhysicsBody3DOptions {
  bodyType?:    BodyType3D;
  shape?:       Shape3D;
  /** Half-extents for box shape (default 0.5, 0.5, 0.5). */
  halfExtents?: Vec3;
  /** Radius for sphere/capsule/cylinder/cone. */
  radius?:      number;
  /** Half-height for capsule/cylinder/cone. */
  halfHeight?:  number;
  position?:    Vec3;
  rotation?:    Quat;
  density?:     number;
  restitution?: number;
  friction?:    number;
  isSensor?:    boolean;
}

export interface Physics3DHandle {
  readonly bodyIndex: number;
  setPosition(pos: Vec3): void;
  getPosition(): Vec3;
  getRotation(): Quat;
  applyImpulse(impulse: Vec3, wakeUp?: boolean): void;
  applyTorqueImpulse(torque: Vec3, wakeUp?: boolean): void;
  setLinearVelocity(vel: Vec3, wakeUp?: boolean): void;
  getLinearVelocity(): Vec3;
  setAngularVelocity(vel: Vec3, wakeUp?: boolean): void;
  getAngularVelocity(): Vec3;
  setGravityScale(scale: number): void;
  isGrounded(): boolean;
}

type Rapier3D = typeof import('@dimforge/rapier3d-compat');

export class PhysicsSystem3D {
  private _rapier: Rapier3D | null = null;
  private _world: InstanceType<Rapier3D['World']> | null = null;
  private readonly _handles: Map<number, InstanceType<Rapier3D['RigidBody']>> = new Map();
  private _nextIndex = 0;

  async init(gravity: Vec3 = { x: 0, y: -9.81, z: 0 }): Promise<void> {
    const R = await import('@dimforge/rapier3d-compat');
    await R.init();
    this._rapier = R;
    this._world = new R.World(gravity);
  }

  addBody(options: PhysicsBody3DOptions = {}): Physics3DHandle {
    const R = this._rapier;
    const world = this._world;
    if (R === null || world === null) {
      throw new Error('[PhysicsSystem3D] Call init() before addBody().');
    }

    // Rigid body descriptor
    let rbDesc: InstanceType<Rapier3D['RigidBodyDesc']>;
    switch (options.bodyType ?? 'dynamic') {
      case 'static':    rbDesc = R.RigidBodyDesc.fixed();                      break;
      case 'kinematic': rbDesc = R.RigidBodyDesc.kinematicPositionBased();     break;
      default:          rbDesc = R.RigidBodyDesc.dynamic();                    break;
    }
    const pos = options.position ?? { x: 0, y: 0, z: 0 };
    rbDesc.setTranslation(pos.x, pos.y, pos.z);
    if (options.rotation !== undefined) {
      const q = options.rotation;
      rbDesc.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
    }

    const body = world.createRigidBody(rbDesc);
    const index = this._nextIndex++;
    this._handles.set(index, body);

    // Collider
    let colDesc: InstanceType<Rapier3D['ColliderDesc']>;
    const shape = options.shape ?? 'box';
    switch (shape) {
      case 'sphere':   colDesc = R.ColliderDesc.ball(options.radius ?? 0.5); break;
      case 'capsule':  colDesc = R.ColliderDesc.capsule(options.halfHeight ?? 0.5, options.radius ?? 0.25); break;
      case 'cylinder': colDesc = R.ColliderDesc.cylinder(options.halfHeight ?? 0.5, options.radius ?? 0.5); break;
      case 'cone':     colDesc = R.ColliderDesc.cone(options.halfHeight ?? 0.5, options.radius ?? 0.5); break;
      default: {
        const he = options.halfExtents ?? { x: 0.5, y: 0.5, z: 0.5 };
        colDesc = R.ColliderDesc.cuboid(he.x, he.y, he.z);
      }
    }
    colDesc.setDensity(options.density ?? 1.0);
    colDesc.setRestitution(options.restitution ?? 0.0);
    colDesc.setFriction(options.friction ?? 0.7);
    if (options.isSensor === true) colDesc.setSensor(true);
    world.createCollider(colDesc, body);

    const handle: Physics3DHandle = {
      bodyIndex: index,
      setPosition(p: Vec3): void { body.setTranslation(p, true); },
      getPosition(): Vec3 { const t = body.translation(); return { x: t.x, y: t.y, z: t.z }; },
      getRotation(): Quat { const r = body.rotation(); return { x: r.x, y: r.y, z: r.z, w: r.w }; },
      applyImpulse(imp: Vec3, wake = true): void { body.applyImpulse(imp, wake); },
      applyTorqueImpulse(t: Vec3, wake = true): void { body.applyTorqueImpulse(t, wake); },
      setLinearVelocity(vel: Vec3, wake = true): void { body.setLinvel(vel, wake); },
      getLinearVelocity(): Vec3 { const v = body.linvel(); return { x: v.x, y: v.y, z: v.z }; },
      setAngularVelocity(vel: Vec3, wake = true): void { body.setAngvel(vel, wake); },
      getAngularVelocity(): Vec3 { const v = body.angvel(); return { x: v.x, y: v.y, z: v.z }; },
      setGravityScale(scale: number): void { body.setGravityScale(scale, true); },
      isGrounded(): boolean {
        // Simple ground check: linear velocity Y near zero and body is not airborne
        return Math.abs(body.linvel().y) < 0.1;
      },
    };
    return handle;
  }

  removeBody(index: number): void {
    const body = this._handles.get(index);
    if (body !== undefined && this._world !== null) {
      this._world.removeRigidBody(body);
      this._handles.delete(index);
    }
  }

  /** Step the simulation by dt seconds. Call once per game loop tick. */
  update(dt: number): void {
    if (this._world === null) return;
    this._world.timestep = Math.max(0.001, Math.min(dt, 0.05));
    this._world.step();
  }

  destroy(): void {
    this._world?.free();
    this._world = null;
    this._handles.clear();
  }

  get isInitialized(): boolean { return this._world !== null; }
}
