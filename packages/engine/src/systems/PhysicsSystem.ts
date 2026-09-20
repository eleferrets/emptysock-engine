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

/** Internal bookkeeping stored per registered entity. */
interface _BodyRecord {
  bodyHandle: number;
  colliderHandle: number;
  entity: Entity;
}

export class PhysicsSystem {
  private _RAPIER: RapierModule | null = null;
  private _world: World | null = null;
  private _eventQueue: EventQueue | null = null;
  /** Maps entity id → Rapier handles. Keeps Rapier internals off PhysicsBody. */
  private readonly _entityHandles: Map<number, _BodyRecord> = new Map();
  /** Maps collider handle → entity for O(1) lookup during collision drain. */
  private readonly _colliderToEntity: Map<number, Entity> = new Map();
  /**
   * Active sensor pairs — key is `min(h1,h2):max(h1,h2)` — used to fire
   * sensorStay events on each step.
   */
  private readonly _activeSensorPairs: Map<string, [Entity, Entity]> =
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
   * Body and collider handles are stored internally; they are not written back
   * to PhysicsBody.
   */
  registerEntity(entity: Entity): void {
    const RAPIER = this._RAPIER;
    const world = this._world;
    if (RAPIER === null || world === null)
      throw new Error("PhysicsSystem not initialized");

    const pb = entity.getComponent<PhysicsBody>("PhysicsBody");
    if (pb === undefined) return;
    if (this._entityHandles.has(entity.id)) return; // already registered

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

    const record: _BodyRecord = {
      bodyHandle: body.handle,
      colliderHandle: collider.handle,
      entity,
    };
    this._entityHandles.set(entity.id, record);
    this._colliderToEntity.set(collider.handle, entity);
    pb.bodyHandle = body.handle;
    pb.colliderHandle = collider.handle;
  }

  /**
   * Sync Rapier body positions back to Transform components.
   * Call after step() each frame.
   */
  syncToTransforms(entities: Iterable<Entity>): void {
    if (this._world === null) return;
    for (const entity of entities) {
      const record = this._entityHandles.get(entity.id);
      if (record === undefined) continue;
      const body = this._world.getRigidBody(record.bodyHandle);
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
      const entity1 = this._colliderToEntity.get(h1);
      const entity2 = this._colliderToEntity.get(h2);
      if (entity1 === undefined || entity2 === undefined) return;

      const pb1 = entity1.getComponent<PhysicsBody>("PhysicsBody");
      const pb2 = entity2.getComponent<PhysicsBody>("PhysicsBody");

      const isSensor =
        (pb1 !== undefined && pb1.isSensor) ||
        (pb2 !== undefined && pb2.isSensor);
      const key = `${Math.min(h1, h2)}:${Math.max(h1, h2)}`;

      if (isSensor) {
        if (started) {
          this._activeSensorPairs.set(key, [entity1, entity2]);
          entity1.emit("sensorEnter", entity2);
          entity2.emit("sensorEnter", entity1);
          if (pb1 !== undefined && pb2 !== undefined) {
            pb1.dispatchSensorEnter(pb2);
            pb2.dispatchSensorEnter(pb1);
          }
        } else {
          this._activeSensorPairs.delete(key);
          entity1.emit("sensorExit", entity2);
          entity2.emit("sensorExit", entity1);
          if (pb1 !== undefined && pb2 !== undefined) {
            pb1.dispatchSensorExit(pb2);
            pb2.dispatchSensorExit(pb1);
          }
        }
      } else {
        const contact: ContactInfo = { impactForce: 0 };
        if (started) {
          entity1.emit("collisionEnter", entity2, contact);
          entity2.emit("collisionEnter", entity1, contact);
          if (pb1 !== undefined && pb2 !== undefined) {
            pb1.dispatchCollisionEnter(pb2, contact);
            pb2.dispatchCollisionEnter(pb1, contact);
          }
        } else {
          entity1.emit("collisionExit", entity2, contact);
          entity2.emit("collisionExit", entity1, contact);
          if (pb1 !== undefined && pb2 !== undefined) {
            pb1.dispatchCollisionExit(pb2, contact);
            pb2.dispatchCollisionExit(pb1, contact);
          }
        }
      }
    });

    for (const [e1, e2] of this._activeSensorPairs.values()) {
      e1.emit("sensorStay", e2);
      e2.emit("sensorStay", e1);
      const pb1 = e1.getComponent<PhysicsBody>("PhysicsBody");
      const pb2 = e2.getComponent<PhysicsBody>("PhysicsBody");
      if (pb1 !== undefined && pb2 !== undefined) {
        pb1.dispatchSensorStay(pb2);
        pb2.dispatchSensorStay(pb1);
      }
    }
  }

  destroy(): void {
    this._world?.free();
    this._world = null;
    this._RAPIER = null;
    this._eventQueue = null;
    this._entityHandles.clear();
    this._colliderToEntity.clear();
    this._activeSensorPairs.clear();
  }
}
