import {
  Component,
  componentType,
  type ComponentType,
} from "../core/Component.js";

/**
 * Sprite — a visible, textured entity. Attaching Sprite alongside Transform
 * is all a game needs to appear on screen: `RenderPipeline.renderFrame()`
 * finds every Transform+Sprite pair each frame, keeps a PixiJS sprite in
 * sync with it, and places it on `layer`/`depth` automatically. There is no
 * separate manual step to register the entity with the renderer.
 */
export class Sprite extends Component {
  static readonly TYPE: ComponentType<Sprite> = componentType<Sprite>("Sprite");

  public texturePath: string;
  public tint: number;
  public alpha: number;
  public anchorX: number;
  public anchorY: number;
  /** Named render layer (see LayerSystem). Defaults to `"default"`. */
  public layer: string;
  /** Draw order within `layer` — lower draws first (behind). Defaults to 0. */
  public depth: number;
  public visible: boolean;

  constructor(
    options: {
      texturePath?: string;
      tint?: number;
      alpha?: number;
      anchorX?: number;
      anchorY?: number;
      layer?: string;
      depth?: number;
      visible?: boolean;
    } = {},
  ) {
    super("Sprite");
    this.texturePath = options.texturePath ?? "";
    this.tint = options.tint ?? 0xffffff;
    this.alpha = options.alpha ?? 1;
    this.anchorX = options.anchorX ?? 0.5;
    this.anchorY = options.anchorY ?? 0.5;
    this.layer = options.layer ?? "default";
    this.depth = options.depth ?? 0;
    this.visible = options.visible ?? true;
  }

  override serialize(): Record<string, unknown> {
    return {
      ...super.serialize(),
      texturePath: this.texturePath,
      tint: this.tint,
      alpha: this.alpha,
      anchorX: this.anchorX,
      anchorY: this.anchorY,
      layer: this.layer,
      depth: this.depth,
      visible: this.visible,
    };
  }
}
