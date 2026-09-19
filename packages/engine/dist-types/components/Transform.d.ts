import { Component } from "../core/Component.js";
export declare class Transform extends Component {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  constructor(options?: {
    x?: number;
    y?: number;
    rotation?: number;
    scaleX?: number;
    scaleY?: number;
  });
  setPosition(x: number, y: number): this;
  translate(dx: number, dy: number): this;
  serialize(): Record<string, unknown>;
}
