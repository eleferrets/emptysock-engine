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
