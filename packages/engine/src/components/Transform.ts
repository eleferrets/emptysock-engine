import { Component } from '../core/Component.js';

export class Transform extends Component {
  public x: number;
  public y: number;
  public rotation: number; // radians
  public scaleX: number;
  public scaleY: number;

  constructor(options: {
    x?: number;
    y?: number;
    rotation?: number;
    scaleX?: number;
    scaleY?: number;
  } = {}) {
    super('Transform');
    this.x = options.x ?? 0;
    this.y = options.y ?? 0;
    this.rotation = options.rotation ?? 0;
    this.scaleX = options.scaleX ?? 1;
    this.scaleY = options.scaleY ?? 1;
  }

  setPosition(x: number, y: number): this {
    this.x = x;
    this.y = y;
    return this;
  }

  translate(dx: number, dy: number): this {
    this.x += dx;
    this.y += dy;
    return this;
  }

  override serialize(): Record<string, unknown> {
    return {
      ...super.serialize(),
      x: this.x,
      y: this.y,
      rotation: this.rotation,
      scaleX: this.scaleX,
      scaleY: this.scaleY,
    };
  }
}
