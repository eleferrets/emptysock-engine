import { Component, type ComponentType } from "../core/Component.js";
/**
 * Sprite — a visible, textured entity. Attaching Sprite alongside Transform
 * is all a game needs to appear on screen: `RenderPipeline.renderFrame()`
 * finds every Transform+Sprite pair each frame, keeps a PixiJS sprite in
 * sync with it, and places it on `layer`/`depth` automatically. There is no
 * separate manual step to register the entity with the renderer.
 */
export declare class Sprite extends Component {
  static readonly TYPE: ComponentType<Sprite>;
  texturePath: string;
  tint: number;
  alpha: number;
  anchorX: number;
  anchorY: number;
  /** Named render layer (see LayerSystem). Defaults to `"default"`. */
  layer: string;
  /** Draw order within `layer` — lower draws first (behind). Defaults to 0. */
  depth: number;
  visible: boolean;
  constructor(options?: {
    texturePath?: string;
    tint?: number;
    alpha?: number;
    anchorX?: number;
    anchorY?: number;
    layer?: string;
    depth?: number;
    visible?: boolean;
  });
  serialize(): Record<string, unknown>;
}
