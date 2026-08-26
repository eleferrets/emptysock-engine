import type RAPIER_TYPE from '@dimforge/rapier2d-compat';
import type { Entity } from '../core/Entity.js';
import type { Transform } from '../components/Transform.js';
import { PhysicsBody } from '../components/PhysicsBody.js';

type RapierModule = typeof RAPIER_TYPE;
type World = InstanceType<RapierModule['World']>;

export interface PhysicsWorldOptions {
  gravity?: { x: number; y: number };
  timestep?: number;
}

export class PhysicsSystem {
  private _RAPIER: RapierModule | null = null;
  private _world: World | null = null;
  private _timestep: number = 1 / 60;
  private _accumulator: number = 0;

  async init(options: PhysicsWorldOptions = {}): Promise<void> {
    const RAPIER = await import('@dimforge/rapier2d-compat');
    await RAPIER.init();
    this._RAPIER = RAPIER;
    this._timestep = options.timestep ?? 1 / 60;
    const gravity = options.gravity ?? { x: 0, y: -9.81 };
    this._world = new RAPIER.World(gravity);
  }

  get world(): World {
    if (this._world === null) throw new Error('PhysicsSystem not initialized');
    return this._world;
  }

  get RAPIER(): RapierModule {
    if (this._RAPIER === null) throw new Error('PhysicsSystem not initialized');
    return this._RAPIER;
  }

  /**
   * Register an entity's PhysicsBody component with the Rapier world.
   * Reads position from a Transform component on the same entity.
   * Stores body/collider handles back on the PhysicsBody for later sync.
   */
  registerEntity(entity: Entity): void {
    const RAPIER = this._RAPIER;
    const world = this._world;
    if (RAPIER === null || world === null) throw new Error('PhysicsSystem not initialized');

    const pb = entity.getComponent<PhysicsBody>('PhysicsBody');
    if (pb === undefined) return;
    if (pb.bodyHandle !== null) return; // already registered

    const transform = entity.getComponent<Transform>('Transform');
    const x = transform?.x ?? 0;
    const y = transform?.y ?? 0;

    // Rigid body descriptor
    let bodyDesc: ReturnType<typeof RAPIER.RigidBodyDesc.dynamic>;
    switch (pb.bodyType) {
      case 'fixed':
        bodyDesc = RAPIER.RigidBodyDesc.fixed();
        break;
      case 'kinematicPositionBased':
        bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased();
        break;
      case 'kinematicVelocityBased':
        bodyDesc = RAPIER.RigidBodyDesc.kinematicVelocityBased();
        break;
      default:
        bodyDesc = RAPIER.RigidBodyDesc.dynamic();
    }
    bodyDesc.setTranslation(x, y);

    const body = world.createRigidBody(bodyDesc);
    pb.bodyHandle = body.handle;

    // Collider descriptor
    let colliderDesc: ReturnType<typeof RAPIER.ColliderDesc.ball>;
    if (pb.shape === 'circle') {
      colliderDesc = RAPIER.ColliderDesc.ball(pb.radius);
    } else if (pb.shape === 'capsule') {
      colliderDesc = RAPIER.ColliderDesc.capsule(pb.height / 2, pb.radius);
    } else {
      colliderDesc = RAPIER.ColliderDesc.cuboid(pb.width / 2, pb.height / 2);
    }

    colliderDesc
      .setDensity(pb.density)
      .setFriction(pb.friction)
      .setRestitution(pb.restitution)
      .setSensor(pb.isSensor);

    const collider = world.createCollider(colliderDesc, body);
    pb.colliderHandle = collider.handle;
  }

  /**
   * Sync Rapier body positions back to Transform components.
   * Call after step() each frame.
   */
  syncToTransforms(entities: Iterable<Entity>): void {
    if (this._world === null) return;
    for (const entity of entities) {
      const pb = entity.getComponent<PhysicsBody>('PhysicsBody');
      if (pb === undefined || pb.bodyHandle === null) continue;
      const body = this._world.getRigidBody(pb.bodyHandle);
      if (body === null || body === undefined) continue;
      const translation = body.translation();
      const transform = entity.getComponent<Transform>('Transform');
      if (transform !== undefined) {
        transform.x = translation.x;
        transform.y = translation.y;
        transform.rotation = body.rotation();
      }
    }
  }

  /** Fixed-timestep step with accumulator. */
  step(deltaTime: number): void {
    if (this._world === null) return;
    this._accumulator += deltaTime;
    while (this._accumulator >= this._timestep) {
      this._world.step();
      this._accumulator -= this._timestep;
    }
  }

  destroy(): void {
    this._world?.free();
    this._world = null;
    this._RAPIER = null;
  }
}
