import type { Entity } from "../core/Entity.js";
import type { Scene } from "../core/Scene.js";
export interface BehaviorContext {
  entity: Entity;
  dt: number;
  /** The scene that owns this entity. Null when called outside a scene (e.g. unit tests). */
  scene?: Scene;
}
export declare abstract class Behavior {
  abstract update(ctx: BehaviorContext): void;
  onAttach?(): void;
  onDetach?(): void;
}
