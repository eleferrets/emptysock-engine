import { type UISystem } from "./UISystem.js";
import type { VNSystem } from "./VNSystem.js";
export interface VNTextboxOptions {
  /** The scene's UISystem instance. Pass `scene.ui`. */
  ui: UISystem;
  /** Canvas width — used to size and position the textbox. */
  canvasWidth: number;
  /** Canvas height — used to position the textbox at the bottom. */
  canvasHeight: number;
  /** Height of the dialogue panel in pixels. Default 160. */
  height?: number;
  /** Height of the speaker name plate in pixels. Default 36. */
  namePlateHeight?: number;
  /** Horizontal padding inside the panel. Default 24. */
  paddingX?: number;
  /** Fill colour of the dialogue panel (CSS colour). Default "rgba(13,13,26,0.88)". */
  panelColor?: string;
  /** Fill colour of the name plate (CSS colour). Default "#3c2d6e". */
  namePlateColor?: string;
  /** Text colour (CSS colour). Default "#ffffff". */
  textColor?: string;
  /** Font size for dialogue text. Default 16. */
  fontSize?: number;
}
/**
 * VNTextbox — a pre-built dialogue box rendered by a scene's UISystem.
 *
 * Creates a panel anchored to the bottom of the canvas with a speaker name
 * plate and a text area. Call `bind(vnSystem)` to wire it to a VNSystem
 * instance — it will automatically update whenever the current node changes.
 *
 * @example
 * ```typescript
 * const textbox = new VNTextbox({ ui: scene.ui, canvasWidth: 800, canvasHeight: 600 });
 * textbox.bind(myVnSystem);
 *
 * // In the scene's onUpdate:
 * scene.ui.render(ctx, 800, 600);
 * ```
 */
export declare class VNTextbox {
  private readonly _ui;
  private readonly _panel;
  private readonly _namePlate;
  private readonly _nameLabel;
  private readonly _textLabel;
  private _vnSystem;
  private _unsubscribe;
  constructor(opts: VNTextboxOptions);
  /** Wire this textbox to a VNSystem instance. The textbox immediately reflects the current node. */
  bind(vn: VNSystem): void;
  /** Show or hide the textbox. */
  set visible(v: boolean);
  get visible(): boolean;
  private _sync;
  private _advance;
  /** Remove the textbox widgets from UISystem. Call when the scene unloads. */
  destroy(): void;
}
