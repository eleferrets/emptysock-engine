export abstract class Component {
  public readonly type: string;
  public enabled: boolean = true;

  protected constructor(type: string) {
    this.type = type;
  }

  /** Called once when component is first attached to an entity */
  onAttach?(): void;

  /** Called once when component is detached from an entity */
  onDetach?(): void;

  /** Called each frame during the update pass */
  update?(_deltaTime: number): void;

  /** Serialize component data for saving */
  serialize(): Record<string, unknown> {
    return { type: this.type, enabled: this.enabled };
  }
}
