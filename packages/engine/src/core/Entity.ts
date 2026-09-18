import type { Component } from "./Component.js";

let _nextId = 0;

export class Entity {
  public readonly id: number;
  public name: string;
  public active: boolean = true;
  private readonly _tags: Set<string> = new Set();

  get tags(): ReadonlySet<string> {
    return this._tags;
  }
  private readonly _components: Map<string, Component> = new Map();
  private readonly _children: Entity[] = [];
  private _parent: Entity | null = null;

  constructor(name: string = "Entity") {
    this.id = _nextId++;
    this.name = name;
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

  // ─── Update ─────────────────────────────────────────────────────────────────

  update(deltaTime: number): void {
    if (!this.active) return;
    for (const component of this._components.values()) {
      if (component.enabled) {
        component.update?.(deltaTime);
      }
    }
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
