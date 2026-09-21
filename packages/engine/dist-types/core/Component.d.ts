/**
 * A branded component-type key. `ComponentType<T>` is a plain string at
 * runtime — the brand exists only so `entity.getComponent(Sprite.TYPE)`
 * infers `Sprite | undefined` without an explicit `<Sprite>` type argument,
 * and so a typo'd string literal doesn't silently type-check against the
 * wrong component. Component identity is still the underlying string (see
 * CLAUDE.md "Component types as identity keys") — this only adds a checked
 * seam on top of it, it does not change the lookup semantics.
 */
export type ComponentType<T extends Component = Component> = string & {
  readonly __componentType?: T;
};
/** Declare a typed component-type token, e.g. `static readonly TYPE = componentType<Sprite>("Sprite")`. */
export declare function componentType<T extends Component>(
  name: string,
): ComponentType<T>;
export declare abstract class Component {
  readonly type: string;
  enabled: boolean;
  protected constructor(type: string);
  /** Called once when component is first attached to an entity */
  onAttach?(): void;
  /** Called once when component is detached from an entity */
  onDetach?(): void;
  /** Called each frame during the update pass */
  update?(_deltaTime: number): void;
  /** Serialize component data for saving */
  serialize(): Record<string, unknown>;
}
