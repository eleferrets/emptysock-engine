import type { Entity } from "../core/Entity.js";
import type { Scene } from "../core/Scene.js";

export interface BehaviorContext {
  entity: Entity;
  dt: number;
  scene: Scene;
}

export abstract class Behavior {
  abstract update(ctx: BehaviorContext): void;
  onAttach?(): void;
  onDetach?(): void;
}
