import { Component } from "../core/Component.js";
export declare class Sprite extends Component {
  texturePath: string;
  tint: number;
  alpha: number;
  anchorX: number;
  anchorY: number;
  constructor(options?: {
    texturePath?: string;
    tint?: number;
    alpha?: number;
    anchorX?: number;
    anchorY?: number;
  });
  serialize(): Record<string, unknown>;
}
