import type RAPIER_TYPE from "@dimforge/rapier2d-compat";
import { entityExists } from "bitecs";
import type { Entity } from "../Entity.js";
import type { Scene } from "../Scene.js";
import {
  PhysicsBody,
  getPhysicsCallbacks,
  type ContactInfo,
} from "../components/PhysicsBody.js";

type RapierModule = typeof RAPIER_TYPE;
type World = InstanceType<RapierModule["World"]>;
type EventQueue = InstanceType<RapierModule["EventQueue"]>;

export interface PhysicsSystemOptions {
  gravity?: { x: number; y: number };
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

/** Internal bookkeeping stored per registered entity. */
interface BodyRecord {
  entity: Entity;
  bodyHandle: number;
  colliderHandle: number;
  /** State at the end of the previous fixed step — interpolation "from". */
  previous: Snapshot;
  /** State at the end of the most recent fixed step — interpolation "to". */
  current: Snapshot;
}

/**
 * v2 `PhysicsSystem` — wraps Rapier2D behind `PhysicsBody` (ENGINE_DESIGN.md
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
export class PhysicsSystem {
  private _RAPIER: RapierModule | null = null;
  private _world: World | null = null;
  private _eventQueue: EventQueue | null = null;
  private _fixedTimestep = 1 / 60;
  private _accumulator = 0;
  private _alpha = 0;

  private readonly _records = new Map<number, BodyRecord>();
  private readonly _colliderToEid = new Map<number, number>();
  /** Active sensor pairs, key `min(eid1,eid2):max(eid1,eid2)` — drives sensorStay. */
  private readonly _activeSensorPairs = new Map<string, [number, number]>();

  async init(options: PhysicsSystemOptions = {}): Promise<void> {
    // Imported via a non-literal specifier on purpose: the deterministic
    // build (ENGINE_DESIGN.md §15.2) is an *optional* peer dependency most
    // games never install, so this must not be a statically-resolvable
    // static `import` — that would make `@dimforge/rapier2d-deterministic-
    // compat` a hard build-time dependency for every project, not an opt-in
    // one. A literal-string dynamic `import("@dimforge/rapier2d-compat")`
    // elsewhere in this file *is* statically resolvable and stays a real
    // dependency, which is correct — only this swap is optional.
    const moduleName = options.deterministic
      ? "@dimforge/rapier2d-deterministic-compat"
      : "@dimforge/rapier2d-compat";
    const RAPIER = (await import(moduleName)) as unknown as RapierModule;
    await RAPIER.init();
    this._RAPIER = RAPIER;
    this._fixedTimestep = options.fixedTimestep ?? 1 / 60;
    const gravity = options.gravity ?? { x: 0, y: -9.81 };
    this._world = new RAPIER.World(gravity);
    this._eventQueue = new RAPIER.EventQueue(true);
  }

  get world(): World {
    if (this._world === null) throw new Error("PhysicsSystem not initialized");
    return this._world;
  }

  /** How far (0..1) the current render frame sits between the last two physics steps. */
  get interpolationAlpha(): number {
    return this._alpha;
  }

  /** Linearly interpolated transform for a registered body, for rendering. */
  getInterpolatedTransform(entity: Entity, alpha = this._alpha): Snapshot {
    const record = this._records.get(entity.eid);
    if (record === undefined) return { x: 0, y: 0, rotation: 0 };
    const { previous, current } = record;
    return {
      x: previous.x + (current.x - previous.x) * alpha,
      y: previous.y + (current.y - previous.y) * alpha,
      rotation:
        previous.rotation + (current.rotation - previous.rotation) * alpha,
    };
  }

  /**
   * Advance the simulation by `dt` real seconds: registers any new
   * `PhysicsBody`s found on `scene`, steps Rapier zero or more times at the
   * fixed timestep, and dispatches collision/sensor callbacks after each
   * step (ENGINE_DESIGN.md §4 steps 3–4). Called from `Game.update()`.
   */
  update(scene: Scene, dt: number): void {
    if (this._world === null || this._eventQueue === null) return;

    this._registerNewBodies(scene);
    this._unregisterDeadBodies();

    this._accumulator += dt;
    while (this._accumulator >= this._fixedTimestep) {
      this._step(this._fixedTimestep);
      this._accumulator -= this._fixedTimestep;
    }
    this._alpha = this._accumulator / this._fixedTimestep;
  }

  private _registerNewBodies(scene: Scene): void {
    scene.each(PhysicsBody, (body, entity) => {
      if (this._records.has(entity.eid)) return;
      this._registerEntity(entity, body);
    });
  }

  private _registerEntity(
    entity: Entity,
    body: ReturnType<typeof PhysicsBody.createDefaults>,
  ): void {
    const RAPIER = this._RAPIER;
    const world = this._world;
    if (RAPIER === null || world === null) return;

    let bodyDesc: ReturnType<typeof RAPIER.RigidBodyDesc.dynamic>;
    switch (body.type) {
      case "static":
        bodyDesc = RAPIER.RigidBodyDesc.fixed();
        break;
      case "kinematic":
        bodyDesc = RAPIER.RigidBodyDesc.kinematicVelocityBased();
        break;
      default:
        bodyDesc = RAPIER.RigidBodyDesc.dynamic();
    }
    bodyDesc.setTranslation(body.position.x, body.position.y);
    bodyDesc.setRotation(body.rotation);
    bodyDesc.setLinvel(body.velocity.x, body.velocity.y);

    const rigidBody = world.createRigidBody(bodyDesc);

    let colliderDesc: ReturnType<typeof RAPIER.ColliderDesc.ball>;
    if (body.shape === "circle") {
      colliderDesc = RAPIER.ColliderDesc.ball(body.radius);
    } else if (body.shape === "capsule") {
      colliderDesc = RAPIER.ColliderDesc.capsule(body.height / 2, body.radius);
    } else {
      colliderDesc = RAPIER.ColliderDesc.cuboid(
        body.width / 2,
        body.height / 2,
      );
    }
    colliderDesc
      .setDensity(body.density)
      .setFriction(body.friction)
      .setRestitution(body.restitution)
      .setSensor(body.isSensor)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);

    const collider = world.createCollider(colliderDesc, rigidBody);

    body.bodyHandle = rigidBody.handle;
    body.colliderHandle = collider.handle;

    const snapshot: Snapshot = {
      x: body.position.x,
      y: body.position.y,
      rotation: body.rotation,
    };
    this._records.set(entity.eid, {
      entity,
      bodyHandle: rigidBody.handle,
      colliderHandle: collider.handle,
      previous: { ...snapshot },
      current: { ...snapshot },
    });
    this._colliderToEid.set(collider.handle, entity.eid);
  }

  private _unregisterDeadBodies(): void {
    for (const [eid, record] of this._records) {
      if (entityExists(record.entity.world, record.entity.eid)) continue;
      this._world?.removeRigidBody(this._world.getRigidBody(record.bodyHandle));
      this._colliderToEid.delete(record.colliderHandle);
      this._records.delete(eid);
    }
  }

  private _step(fixedDt: number): void {
    const world = this._world;
    const queue = this._eventQueue;
    if (world === null || queue === null) return;

    world.timestep = fixedDt;
    world.step(queue);

    for (const record of this._records.values()) {
      const rigidBody = world.getRigidBody(record.bodyHandle);
      const translation = rigidBody.translation();
      const rotation = rigidBody.rotation();
      const linvel = rigidBody.linvel();
      record.previous = record.current;
      record.current = { x: translation.x, y: translation.y, rotation };

      const body = record.entity.get(PhysicsBody);
      if (body !== undefined) {
        body.position = { x: translation.x, y: translation.y };
        body.rotation = rotation;
        body.velocity = { x: linvel.x, y: linvel.y };
      }
    }

    this._drainCollisionEvents(queue);
  }

  private _drainCollisionEvents(queue: EventQueue): void {
    queue.drainCollisionEvents((h1: number, h2: number, started: boolean) => {
      const eid1 = this._colliderToEid.get(h1);
      const eid2 = this._colliderToEid.get(h2);
      if (eid1 === undefined || eid2 === undefined) return;
      const record1 = this._records.get(eid1);
      const record2 = this._records.get(eid2);
      if (record1 === undefined || record2 === undefined) return;

      const body1 = record1.entity.get(PhysicsBody);
      const body2 = record2.entity.get(PhysicsBody);
      const isSensor =
        (body1 !== undefined && body1.isSensor) ||
        (body2 !== undefined && body2.isSensor);
      const key = `${Math.min(eid1, eid2)}:${Math.max(eid1, eid2)}`;
      const cb1 = getPhysicsCallbacks(record1.entity.world, eid1);
      const cb2 = getPhysicsCallbacks(record2.entity.world, eid2);

      if (isSensor) {
        if (started) {
          this._activeSensorPairs.set(key, [eid1, eid2]);
          cb1.onSensorEnter?.(record2.entity);
          cb2.onSensorEnter?.(record1.entity);
        } else {
          this._activeSensorPairs.delete(key);
          cb1.onSensorExit?.(record2.entity);
          cb2.onSensorExit?.(record1.entity);
        }
      } else {
        const contact: ContactInfo = { impactForce: 0 };
        if (started) {
          cb1.onCollisionEnter?.(record2.entity, contact);
          cb2.onCollisionEnter?.(record1.entity, contact);
        } else {
          cb1.onCollisionExit?.(record2.entity, contact);
          cb2.onCollisionExit?.(record1.entity, contact);
        }
      }
    });

    for (const [eid1, eid2] of this._activeSensorPairs.values()) {
      const record1 = this._records.get(eid1);
      const record2 = this._records.get(eid2);
      if (record1 === undefined || record2 === undefined) continue;
      const cb1 = getPhysicsCallbacks(record1.entity.world, eid1);
      const cb2 = getPhysicsCallbacks(record2.entity.world, eid2);
      cb1.onSensorStay?.(record2.entity);
      cb2.onSensorStay?.(record1.entity);
    }
  }

  /**
   * ENGINE_DESIGN.md's PhysicsSystem3D-must-be-destroyed decision (CLAUDE.md)
   * applies here too: Rapier allocates its world/body buffers in WASM linear
   * memory outside the JS heap, invisible to the GC. Always call this when a
   * scene unloads.
   */
  destroy(): void {
    this._world?.free();
    this._world = null;
    this._RAPIER = null;
    this._eventQueue = null;
    this._records.clear();
    this._colliderToEid.clear();
    this._activeSensorPairs.clear();
    this._accumulator = 0;
    this._alpha = 0;
  }
}
