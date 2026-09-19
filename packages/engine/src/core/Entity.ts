import type { Component } from "./Component.js";
import {
  CoroutineSystem,
  type CoroutineGen,
} from "../systems/CoroutineSystem.js";

/** Minimal shape Entity expects from attached behaviors. */
interface BehaviorLike {
  update(ctx: { entity: Entity; dt: number }): void;
  onAttach?(): void;
  onDetach?(): void;
}

let _nextId = 0;

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

export class Entity {
  public readonly id: number;
  public name: string;
  public active: boolean = true;

  /** World-space position. Mutate directly or via `setPosition()` / `translate()`. */
  public position: Vec2 = { x: 0, y: 0 };
  /** Rotation in radians. */
  public rotation: number = 0;
  /** Non-uniform scale. Default 1×1. */
  public scale: Vec2 = { x: 1, y: 1 };

  private readonly _tags: Set<string> = new Set();

  get tags(): ReadonlySet<string> {
    return this._tags;
  }

  private readonly _components: Map<string, Component> = new Map();
  private readonly _children: Entity[] = [];
  private _parent: Entity | null = null;
  private _destroyed: boolean = false;

  // ─── Event emitter ──────────────────────────────────────────────────────────
  private readonly _listeners: Map<string, Set<EventHandler>> = new Map();
  private readonly _onceListeners: Map<string, Set<EventHandler>> = new Map();

  // ─── Behaviors ──────────────────────────────────────────────────────────────
  private readonly _behaviors: BehaviorLike[] = [];

  // ─── Coroutines ─────────────────────────────────────────────────────────────
  private _coroutines: CoroutineSystem | null = null;
  private _coroutineNextId: number = 0;

  constructor(name: string = "Entity") {
    this.id = _nextId++;
    this.name = name;
  }

  // ─── Transform helpers ──────────────────────────────────────────────────────

  /** Set position by component, returning `this` for chaining. */
  setPosition(x: number, y: number): this {
    this.position.x = x;
    this.position.y = y;
    return this;
  }

  /** Translate by a delta, returning `this` for chaining. */
  translate(dx: number, dy: number): this {
    this.position.x += dx;
    this.position.y += dy;
    return this;
  }

  /** Set rotation to face `target`, returning `this` for chaining. */
  rotateTo(target: Vec2): this {
    this.rotation = Math.atan2(
      target.y - this.position.y,
      target.x - this.position.x,
    );
    return this;
  }

  /** Euclidean distance to `other`. */
  distanceTo(other: Entity | Vec2): number {
    const tx = "position" in other ? other.position.x : other.x;
    const ty = "position" in other ? other.position.y : other.y;
    const dx = tx - this.position.x;
    const dy = ty - this.position.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /** Angle in radians from this entity toward `other`. */
  angleTo(other: Entity | Vec2): number {
    const tx = "position" in other ? other.position.x : other.x;
    const ty = "position" in other ? other.position.y : other.y;
    return Math.atan2(ty - this.position.y, tx - this.position.x);
  }

  // ─── Components ─────────────────────────────────────────────────────────────

  addComponent<T extends Component>(component: T): T {
    if (this._components.has(component.type)) {
      throw new Error(
        `Entity "${this.name}" already has component "${component.type}"`,
      );
    }
    this._components.set(component.type, component);
    component.onAttach?.();
    return component;
  }

  getComponent<T extends Component>(type: string): T | undefined {
    return this._components.get(type) as T | undefined;
  }

  requireComponent<T extends Component>(type: string): T {
    const c = this._components.get(type) as T | undefined;
    if (c === undefined) {
      throw new Error(
        `Entity "${this.name}" is missing required component "${type}"`,
      );
    }
    return c;
  }

  hasComponent(type: string): boolean {
    return this._components.has(type);
  }

  removeComponent(type: string): boolean {
    const c = this._components.get(type);
    if (c === undefined) return false;
    c.onDetach?.();
    return this._components.delete(type);
  }

  getComponents(): ReadonlyMap<string, Component> {
    return this._components;
  }

  // ─── Behaviors ──────────────────────────────────────────────────────────────

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
  addBehavior(behavior: BehaviorLike): this {
    this._behaviors.push(behavior);
    behavior.onAttach?.();
    return this;
  }

  /** Remove a previously attached behavior. Calls `onDetach()`. */
  removeBehavior(behavior: BehaviorLike): boolean {
    const idx = this._behaviors.indexOf(behavior);
    if (idx === -1) return false;
    this._behaviors.splice(idx, 1);
    behavior.onDetach?.();
    return true;
  }

  // ─── Hierarchy ──────────────────────────────────────────────────────────────

  get parent(): Entity | null {
    return this._parent;
  }

  get children(): ReadonlyArray<Entity> {
    return this._children;
  }

  addChild(child: Entity): void {
    child._parent?._removeChild(child);
    child._parent = this;
    this._children.push(child);
  }

  private _removeChild(child: Entity): void {
    const idx = this._children.indexOf(child);
    if (idx !== -1) {
      this._children.splice(idx, 1);
      child._parent = null;
    }
  }

  removeFromParent(): void {
    this._parent?._removeChild(this);
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  /**
   * Mark this entity as destroyed. Detaches from parent, calls `onDetach` on
   * all components, stops all coroutines, and sets `active = false`. The Scene
   * removes destroyed entities on the next `removeEntity()` call — entities
   * call this themselves; the scene listens for the `destroy` event to clean up.
   */
  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    this.active = false;

    // Destroy all children first (depth-first)
    for (const child of [...this._children]) {
      child.destroy();
    }

    // Detach all components
    for (const [type] of this._components) {
      const c = this._components.get(type);
      c?.onDetach?.();
    }
    this._components.clear();

    // Detach all behaviors
    for (const behavior of this._behaviors) {
      behavior.onDetach?.();
    }
    this._behaviors.length = 0;

    // Stop all coroutines
    if (this._coroutines !== null) {
      this._coroutines = null;
    }

    // Detach from parent
    this.removeFromParent();

    // Notify the scene so it can remove this entity from its registry
    this.emit("destroy");
  }

  get isDestroyed(): boolean {
    return this._destroyed;
  }

  // ─── Event emitter ──────────────────────────────────────────────────────────

  on(event: string, handler: EventHandler): this {
    let set = this._listeners.get(event);
    if (set === undefined) {
      set = new Set();
      this._listeners.set(event, set);
    }
    set.add(handler);
    return this;
  }

  once(event: string, handler: EventHandler): this {
    let set = this._onceListeners.get(event);
    if (set === undefined) {
      set = new Set();
      this._onceListeners.set(event, set);
    }
    set.add(handler);
    return this;
  }

  off(event: string, handler: EventHandler): this {
    this._listeners.get(event)?.delete(handler);
    this._onceListeners.get(event)?.delete(handler);
    return this;
  }

  emit(event: string, ...args: unknown[]): void {
    const persistent = this._listeners.get(event);
    if (persistent !== undefined) {
      for (const handler of persistent) {
        handler(...args);
      }
    }
    const once = this._onceListeners.get(event);
    if (once !== undefined) {
      for (const handler of once) {
        handler(...args);
      }
      this._onceListeners.delete(event);
    }
  }

  // ─── Physics event helpers ───────────────────────────────────────────────────

  /** Register a callback for when this entity begins a physics collision. */
  onCollisionEnter(
    handler: (other: Entity, contact: unknown) => void,
  ): () => void {
    const wrapped: EventHandler = (...args: unknown[]) =>
      handler(args[0] as Entity, args[1]);
    this.on("collisionEnter", wrapped);
    return () => this.off("collisionEnter", wrapped);
  }

  /** Register a callback for when this entity ends a physics collision. */
  onCollisionExit(
    handler: (other: Entity, contact: unknown) => void,
  ): () => void {
    const wrapped: EventHandler = (...args: unknown[]) =>
      handler(args[0] as Entity, args[1]);
    this.on("collisionExit", wrapped);
    return () => this.off("collisionExit", wrapped);
  }

  /** Register a callback for when another entity enters this sensor. */
  onSensorEnter(handler: (other: Entity) => void): () => void {
    const wrapped: EventHandler = (...args: unknown[]) =>
      handler(args[0] as Entity);
    this.on("sensorEnter", wrapped);
    return () => this.off("sensorEnter", wrapped);
  }

  /** Register a callback for when another entity exits this sensor. */
  onSensorExit(handler: (other: Entity) => void): () => void {
    const wrapped: EventHandler = (...args: unknown[]) =>
      handler(args[0] as Entity);
    this.on("sensorExit", wrapped);
    return () => this.off("sensorExit", wrapped);
  }

  // ─── Coroutines ─────────────────────────────────────────────────────────────

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
  ): CoroutineHandle {
    if (this._coroutines === null) {
      this._coroutines = new CoroutineSystem();
    }
    const resolvedId = id ?? `co_${this.id}_${this._coroutineNextId++}`;
    const resolved = typeof gen === "function" ? gen() : gen;
    this._coroutines.start(resolvedId, resolved);
    const sys = this._coroutines;
    return {
      id: resolvedId,
      cancel: () => sys.stop(resolvedId),
    };
  }

  /** Stop a coroutine by its ID (the one returned from `startCoroutine`). */
  stopCoroutine(id: string): void {
    this._coroutines?.stop(id);
  }

  // ─── Update ─────────────────────────────────────────────────────────────────

  update(deltaTime: number): void {
    if (!this.active) return;
    for (const component of this._components.values()) {
      if (component.enabled) {
        component.update?.(deltaTime);
      }
    }
    for (const behavior of this._behaviors) {
      behavior.update({ entity: this, dt: deltaTime });
    }
    this._coroutines?.update(deltaTime);
    for (const child of this._children) {
      child.update(deltaTime);
    }
  }

  // ─── Tags ────────────────────────────────────────────────────────────────────

  hasTag(tag: string): boolean {
    return this._tags.has(tag);
  }

  addTag(tag: string): this {
    this._tags.add(tag);
    return this;
  }

  removeTag(tag: string): this {
    this._tags.delete(tag);
    return this;
  }
}
