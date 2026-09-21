import type RAPIER_TYPE from "@dimforge/rapier2d-compat";
import type { Entity } from "../core/Entity.js";
type RapierModule = typeof RAPIER_TYPE;
type World = InstanceType<RapierModule["World"]>;
export interface PhysicsWorldOptions {
  gravity?: {
    x: number;
    y: number;
  };
}
export declare class PhysicsSystem {
  private _RAPIER;
  private _world;
  private _eventQueue;
  /** Maps entity id → Rapier handles. Keeps Rapier internals off PhysicsBody. */
  private readonly _entityHandles;
  /** Maps collider handle → entity for O(1) lookup during collision drain. */
  private readonly _colliderToEntity;
  /**
   * Active sensor pairs — key is `min(h1,h2):max(h1,h2)` — used to fire
   * sensorStay events on each step.
   */
  private readonly _activeSensorPairs;
  init(options?: PhysicsWorldOptions): Promise<void>;
  get world(): World;
  get RAPIER(): RapierModule;
  /**
   * Register an entity's PhysicsBody component with the Rapier world.
   * Reads position from a Transform component on the same entity.
   * Body and collider handles are stored internally; they are not written back
   * to PhysicsBody.
   */
  registerEntity(entity: Entity): void;
  /**
   * Sync Rapier body positions back to Transform components.
   * Call after step() each frame.
   */
  syncToTransforms(entities: Iterable<Entity>): void;
  /**
   * Advance the physics world by exactly one step of `fixedDt` seconds and
   * fire collision/sensor callbacks. Accumulation is handled externally by
   * `SceneManager` — call this from `onFixedUpdate(dt)` (which is already
   * driven by the scene manager's accumulator loop) rather than from
   * `onUpdate(dt)`.
   */
  step(fixedDt: number): void;
  private _drainCollisionEvents;
  destroy(): void;
}
export {};
