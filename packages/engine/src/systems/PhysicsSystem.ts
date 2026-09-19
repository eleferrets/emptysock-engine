import type RAPIER_TYPE from "@dimforge/rapier2d-compat";
import type { Entity } from "../core/Entity.js";
import type { Transform } from "../components/Transform.js";
import type { PhysicsBody, ContactInfo } from "../components/PhysicsBody.js";

type RapierModule = typeof RAPIER_TYPE;
type World = InstanceType<RapierModule["World"]>;
type EventQueue = InstanceType<RapierModule["EventQueue"]>;

export interface PhysicsWorldOptions {
  gravity?: { x: number; y: number };
}

export class PhysicsSystem {
  private _RAPIER: RapierModule | null = null;
  private _world: World | null = null;
  private _eventQueue: EventQueue | null = null;
  private readonly _colliderToBody: Map<number, PhysicsBody> = new Map();
  private readonly _activeSensorPairs: Map<string, [PhysicsBody, PhysicsBody]> =
    new Map();

  async init(options: PhysicsWorldOptions = {}): Promise<void> {
    const RAPIER = await import("@dimforge/rapier2d-compat");
    await RAPIER.init();
    this._RAPIER = RAPIER;
    const gravity = options.gravity ?? { x: 0, y: -9.81 };
    this._world = new RAPIER.World(gravity);
    this._eventQueue = new RAPIER.EventQueue(true);
  }

  get world(): World {
    if (this._world === null) throw new Error("PhysicsSystem not initialized");
    return this._world;
  }

  get RAPIER(): RapierModule {
    if (this._RAPIER === null) throw new Error("PhysicsSystem not initialized");
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
    if (RAPIER === null || world === null)
      throw new Error("PhysicsSystem not initialized");

    const pb = entity.getComponent<PhysicsBody>("PhysicsBody");
    if (pb === undefined) return;
    if (pb.bodyHandle !== null) return; // already registered

    const transform = entity.getComponent<Transform>("Transform");
    const x = transform?.x ?? 0;
    const y = transform?.y ?? 0;

    // Rigid body descriptor
    let bodyDesc: ReturnType<typeof RAPIER.RigidBodyDesc.dynamic>;
    switch (pb.bodyType) {
      case "fixed":
        bodyDesc = RAPIER.RigidBodyDesc.fixed();
        break;
      case "kinematicPositionBased":
        bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased();
        break;
      case "kinematicVelocityBased":
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
    if (pb.shape === "circle") {
      colliderDesc = RAPIER.ColliderDesc.ball(pb.radius);
    } else if (pb.shape === "capsule") {
      colliderDesc = RAPIER.ColliderDesc.capsule(pb.height / 2, pb.radius);
    } else {
      colliderDesc = RAPIER.ColliderDesc.cuboid(pb.width / 2, pb.height / 2);
    }

    colliderDesc
      .setDensity(pb.density)
      .setFriction(pb.friction)
      .setRestitution(pb.restitution)
      .setSensor(pb.isSensor)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);

    const collider = world.createCollider(colliderDesc, body);
    pb.colliderHandle = collider.handle;
    this._colliderToBody.set(collider.handle, pb);
  }

  /**
   * Sync Rapier body positions back to Transform components.
   * Call after step() each frame.
   */
  syncToTransforms(entities: Iterable<Entity>): void {
    if (this._world === null) return;
    for (const entity of entities) {
      const pb = entity.getComponent<PhysicsBody>("PhysicsBody");
      if (pb === undefined || pb.bodyHandle === null) continue;
      const body = this._world.getRigidBody(pb.bodyHandle);
      const translation = body.translation();
      const transform = entity.getComponent<Transform>("Transform");
      if (transform !== undefined) {
        transform.x = translation.x;
        transform.y = translation.y;
        transform.rotation = body.rotation();
      }
    }
  }

  /**
   * Advance the physics world by exactly one step of `fixedDt` seconds and
   * fire collision/sensor callbacks. Accumulation is handled externally by
   * `SceneManager` — call this from `onFixedUpdate(dt)` (which is already
   * driven by the scene manager's accumulator loop) rather than from
   * `onUpdate(dt)`.
   */
  step(fixedDt: number): void {
    if (this._world === null || this._eventQueue === null) return;
    this._world.timestep = fixedDt;
    this._world.step(this._eventQueue);
    this._drainCollisionEvents(this._eventQueue);
  }

  private _drainCollisionEvents(queue: EventQueue): void {
    queue.drainCollisionEvents((h1: number, h2: number, started: boolean) => {
      const body1 = this._colliderToBody.get(h1);
      const body2 = this._colliderToBody.get(h2);
      if (body1 === undefined || body2 === undefined) return;

      const isSensor = body1.isSensor || body2.isSensor;
      const key = `${Math.min(h1, h2)}:${Math.max(h1, h2)}`;

      if (isSensor) {
        if (started) {
          this._activeSensorPairs.set(key, [body1, body2]);
          body1.isSensor
            ? body1.dispatchSensorEnter(body2)
            : body2.dispatchSensorEnter(body1);
        } else {
          this._activeSensorPairs.delete(key);
          body1.isSensor
            ? body1.dispatchSensorExit(body2)
            : body2.dispatchSensorExit(body1);
        }
      } else {
        const contact: ContactInfo = { impactForce: 0 };
        if (started) {
          body1.dispatchCollisionEnter(body2, contact);
          body2.dispatchCollisionEnter(body1, contact);
        } else {
          body1.dispatchCollisionExit(body2, contact);
          body2.dispatchCollisionExit(body1, contact);
        }
      }
    });

    for (const [b1, b2] of this._activeSensorPairs.values()) {
      b1.isSensor ? b1.dispatchSensorStay(b2) : b2.dispatchSensorStay(b1);
    }
  }

  destroy(): void {
    this._world?.free();
    this._world = null;
    this._RAPIER = null;
    this._eventQueue = null;
    this._colliderToBody.clear();
    this._activeSensorPairs.clear();
  }
}
