import type { Component, ComponentType } from "./Component.js";
import { type CoroutineGen } from "../systems/CoroutineSystem.js";
/** Minimal shape Entity expects from attached behaviors. */
interface BehaviorLike {
  update(ctx: { entity: Entity; dt: number }): void;
  onAttach?(): void;
  onDetach?(): void;
}
/** Simple 2-component vector used for position and scale. */
export interface Vec2 {
  x: number;
  y: number;
}
/** A cancelable handle returned by `entity.startCoroutine()`. */
export interface CoroutineHandle {
  readonly id: string;
  cancel(): void;
}
type EventHandler = (...args: unknown[]) => void;
export declare class Entity {
  readonly id: number;
  name: string;
  active: boolean;
  /** World-space position. Mutate directly or via `setPosition()` / `translate()`. */
  position: Vec2;
  /** Rotation in radians. */
  rotation: number;
  /** Non-uniform scale. Default 1×1. */
  scale: Vec2;
  private readonly _tags;
  get tags(): ReadonlySet<string>;
  private readonly _components;
  private readonly _children;
  private _parent;
  private _destroyed;
  private readonly _listeners;
  private readonly _onceListeners;
  private readonly _behaviors;
  private _coroutines;
  private _coroutineNextId;
  constructor(name?: string);
  /** Set position by component, returning `this` for chaining. */
  setPosition(x: number, y: number): this;
  /** Translate by a delta, returning `this` for chaining. */
  translate(dx: number, dy: number): this;
  /** Set rotation to face `target`, returning `this` for chaining. */
  rotateTo(target: Vec2): this;
  /** Euclidean distance to `other`. */
  distanceTo(other: Entity | Vec2): number;
  /** Angle in radians from this entity toward `other`. */
  angleTo(other: Entity | Vec2): number;
  addComponent<T extends Component>(component: T): T;
  getComponent<T extends Component>(
    type: ComponentType<T> | string,
  ): T | undefined;
  requireComponent<T extends Component>(type: ComponentType<T> | string): T;
  hasComponent(type: ComponentType | string): boolean;
  removeComponent(type: ComponentType | string): boolean;
  getComponents(): ReadonlyMap<string, Component>;
  /**
   * Attach a behavior to this entity. `onAttach()` is called immediately.
   * The behavior's `update()` is called every frame via `entity.update()`.
   *
   * @example
   * ```typescript
   * const move = new EightDirBehavior(input, 200)
   * player.addBehavior(move)
   * ```
   */
  addBehavior(behavior: BehaviorLike): this;
  /** Remove a previously attached behavior. Calls `onDetach()`. */
  removeBehavior(behavior: BehaviorLike): boolean;
  get parent(): Entity | null;
  get children(): ReadonlyArray<Entity>;
  addChild(child: Entity): void;
  private _removeChild;
  removeFromParent(): void;
  /**
   * Mark this entity as destroyed. Detaches from parent, calls `onDetach` on
   * all components, stops all coroutines, and sets `active = false`. The Scene
   * removes destroyed entities on the next `removeEntity()` call — entities
   * call this themselves; the scene listens for the `destroy` event to clean up.
   */
  destroy(): void;
  get isDestroyed(): boolean;
  on(event: string, handler: EventHandler): this;
  once(event: string, handler: EventHandler): this;
  off(event: string, handler: EventHandler): this;
  emit(event: string, ...args: unknown[]): void;
  /** Register a callback for when this entity begins a physics collision. */
  onCollisionEnter(
    handler: (other: Entity, contact: unknown) => void,
  ): () => void;
  /** Register a callback for when this entity ends a physics collision. */
  onCollisionExit(
    handler: (other: Entity, contact: unknown) => void,
  ): () => void;
  /** Register a callback for when another entity enters this sensor. */
  onSensorEnter(handler: (other: Entity) => void): () => void;
  /** Register a callback for when another entity exits this sensor. */
  onSensorExit(handler: (other: Entity) => void): () => void;
  /**
   * Start a coroutine on this entity. Returns a handle with a `cancel()` method.
   * The coroutine is stopped automatically when the entity is destroyed.
   *
   * @example
   * ```typescript
   * entity.startCoroutine(function* () {
   *   yield waitSeconds(1.0)
   *   doSomething()
   * })
   * ```
   */
  startCoroutine(
    gen: CoroutineGen | (() => CoroutineGen),
    id?: string,
  ): CoroutineHandle;
  /** Stop a coroutine by its ID (the one returned from `startCoroutine`). */
  stopCoroutine(id: string): void;
  update(deltaTime: number): void;
  hasTag(tag: string): boolean;
  addTag(tag: string): this;
  removeTag(tag: string): this;
}
export {};
