import { Component } from '../core/Component.js';

export class Sprite extends Component {
  public texturePath: string;
  public tint: number;
  public alpha: number;
  public anchorX: number;
  public anchorY: number;

  constructor(options: {
    texturePath?: string;
    tint?: number;
    alpha?: number;
    anchorX?: number;
    anchorY?: number;
  } = {}) {
    super('Sprite');
    this.texturePath = options.texturePath ?? '';
    this.tint = options.tint ?? 0xffffff;
    this.alpha = options.alpha ?? 1;
    this.anchorX = options.anchorX ?? 0.5;
    this.anchorY = options.anchorY ?? 0.5;
  }

  override serialize(): Record<string, unknown> {
    return {
      ...super.serialize(),
      texturePath: this.texturePath,
      tint: this.tint,
      alpha: this.alpha,
      anchorX: this.anchorX,
      anchorY: this.anchorY,
    };
  }
}
