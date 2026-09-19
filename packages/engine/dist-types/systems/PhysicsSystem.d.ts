import type RAPIER_TYPE from "@dimforge/rapier2d-compat";
import type { Entity } from "../core/Entity.js";
type RapierModule = typeof RAPIER_TYPE;
type World = InstanceType<RapierModule["World"]>;
export interface PhysicsWorldOptions {
  gravity?: {
    x: number;
    y: number;
  };
  timestep?: number;
}
export declare class PhysicsSystem {
  private _RAPIER;
  private _world;
  private _timestep;
  private _accumulator;
  init(options?: PhysicsWorldOptions): Promise<void>;
  get world(): World;
  get RAPIER(): RapierModule;
  /**
   * Register an entity's PhysicsBody component with the Rapier world.
   * Reads position from a Transform component on the same entity.
   * Stores body/collider handles back on the PhysicsBody for later sync.
   */
  registerEntity(entity: Entity): void;
  /**
   * Sync Rapier body positions back to Transform components.
   * Call after step() each frame.
   */
  syncToTransforms(entities: Iterable<Entity>): void;
  /** Fixed-timestep step with accumulator. */
  step(deltaTime: number): void;
  destroy(): void;
}
export {};
