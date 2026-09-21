import type { UISystem } from "./UISystem.js";
import type { VNSystem } from "./VNSystem.js";
export interface VNTextboxOptions {
  /** Canvas width — used to size and position the textbox. */
  canvasWidth: number;
  /** Canvas height — used to position the textbox at the bottom. */
  canvasHeight: number;
  /**
   * Scene UI system. The textbox registers itself as a root widget here and
   * removes itself when destroy() is called.
   */
  ui: UISystem;
  /** Height of the dialogue panel in pixels. Default 160. */
  height?: number;
  /** Height of the speaker name plate in pixels. Default 36. */
  namePlateHeight?: number;
  /** Horizontal padding inside the panel. Default 24. */
  paddingX?: number;
  /** Fill colour of the dialogue panel as a CSS colour string. Default '#0d0d1a'. */
  panelColor?: string;
  /** Fill colour of the name plate as a CSS colour string. Default '#3c2d6e'. */
  namePlateColor?: string;
  /** Text colour as a CSS colour string. Default '#ffffff'. */
  textColor?: string;
  /** Font size for dialogue text. Default 16. */
  fontSize?: number;
  /**
   * Font family used for text measurement. Must match the font your renderer
   * applies to dialogue text so that line breaks are calculated correctly.
   * Default 'sans-serif'.
   */
  fontFamily?: string;
  /**
   * Typewriter reveal speed in characters per second. When set, text is
   * revealed character by character with line breaks pre-calculated so words
   * never split across lines mid-reveal. Click or call skipTypewriter() to
   * jump to the end. Set to 0 or omit for instant display.
   */
  typewriterSpeed?: number;
}
/**
 * VNTextbox — a pre-built dialogue box rendered by UISystem.
 *
 * Creates a PanelWidget anchored to the bottom of the canvas with a speaker
 * name plate and a text area. Call `bind(vnSystem)` to wire it to a VNSystem
 * instance — it will automatically update whenever the current node changes.
 *
 * Call `update(dt)` every frame (or let Scene.update() handle it via the
 * UISystem it drives automatically) so the typewriter animation advances.
 *
 * @example
 * ```typescript
 * const textbox = new VNTextbox({
 *   canvasWidth: 800,
 *   canvasHeight: 600,
 *   ui: scene.ui,
 *   typewriterSpeed: 40,  // 40 chars/sec, smart line-break pre-calculation
 * });
 * textbox.bind(myVnSystem);
 *
 * // In onUpdate — advance the typewriter:
 * textbox.update(dt);
 *
 * // In the game loop render callback:
 * scene.ui.render(ctx, 800, 600);
 * ```
 */
export declare class VNTextbox {
  private readonly _panel;
  private readonly _namePlateBg;
  private readonly _namePlate;
  private readonly _text;
  private readonly _ui;
  private _vnSystem;
  private readonly _textWidth;
  private readonly _typeSpeed;
  /**
   * Canvas 2D context used for text measurement when typewriter is active.
   * Null when the DOM is unavailable (e.g. Node/Vitest) or typewriter is off.
   */
  private readonly _measureCtx;
  private _typeAccum;
  private _typeTarget;
  private _typeIndex;
  private _typing;
  constructor(opts: VNTextboxOptions);
  /** Wire this textbox to a VNSystem instance. The textbox immediately reflects the current node. */
  bind(vn: VNSystem): void;
  /** Show or hide the textbox. */
  set visible(v: boolean);
  get visible(): boolean;
  /** True while a typewriter reveal is in progress. */
  get isTyping(): boolean;
  /**
   * Advance the typewriter animation. Call once per frame from `onUpdate(dt)`.
   * If the scene's UISystem.update() is called automatically (it is, via
   * Scene.update()), widget animations already run — this method drives only
   * the character-reveal logic, which is separate.
   */
  update(dt: number): void;
  /**
   * Jump the current typewriter reveal to its end immediately.
   * No-op if no reveal is in progress.
   */
  skipTypewriter(): void;
  /** Update speaker name and dialogue text from the current VNSystem node. */
  private _sync;
  /**
   * Pre-calculate word-wrap line breaks so the typewriter reveal never causes
   * the layout engine to reflow mid-word. Returns the original text with
   * explicit newlines inserted at wrap boundaries.
   */
  private _prewrap;
  private _startTypewriter;
  private _stopTypewriter;
  private _advance;
  /** Remove the textbox widgets from UISystem. Call when the scene unloads. */
  destroy(): void;
}
