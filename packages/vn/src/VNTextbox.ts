import {
  Layout,
  LayoutStyle,
  PanelStyle,
  Label,
  WidgetAppearance,
  resolveAnchoredPosition,
  type Entity,
  type Scene,
  type WidgetTree,
} from "@emptysock/engine";
import type { VNSystem } from "./VNSystem.js";

export interface VNTextboxOptions {
  /** Canvas width — used to size and position the textbox. */
  canvasWidth: number;
  /** Canvas height — used to position the textbox at the bottom. */
  canvasHeight: number;
  /** The scene to spawn the textbox's widget entities into. */
  scene: Scene;
  /** The scene's widget tree — the textbox's entities are spawned/destroyed through it. */
  tree: WidgetTree;
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
   * never split across lines mid-reveal. Call `handlePointerDown()` or
   * `skipTypewriter()` to jump to the end. Set to 0 or omit for instant display.
   */
  typewriterSpeed?: number;
}

/**
 * VNTextbox — a pre-built dialogue box. Spawns real widget entities
 * (`PanelStyle`/`Label`, positioned via `LayoutStyle`) through the caller's
 * `WidgetTree`, and the caller renders them the same way it renders every
 * other widget entity: `uiSystem.render(scene, ctx)`. There is no
 * per-widget click-callback mechanism in the UI layer (state lives on
 * components, game code polls it) — this class exposes its own
 * `handlePointerDown(x, y)` hit-test instead of relying on one, the same
 * "a panel isn't a button, so it gets its own hit-test" shape a bespoke
 * interactive panel would need.
 *
 * Call `bind(vnSystem)` to wire it to a `VNSystem` instance — it will
 * automatically update whenever the current node changes. Call `update(dt)`
 * every frame so the typewriter animation advances.
 *
 * @example
 * ```typescript
 * const textbox = new VNTextbox({
 *   canvasWidth: 800,
 *   canvasHeight: 600,
 *   scene,
 *   tree,
 *   typewriterSpeed: 40,
 * });
 * textbox.bind(myVnSystem);
 *
 * // In onUpdate:
 * textbox.update(dt);
 * tree.layout(scene, 800, 600);
 *
 * // In the render callback:
 * uiSystem.render(scene, ctx);
 * ```
 */
export class VNTextbox {
  private readonly _scene: Scene;
  private readonly _tree: WidgetTree;
  private readonly _panel: Entity;
  private readonly _namePlateBg: Entity;
  private readonly _namePlate: Entity;
  private readonly _text: Entity;
  private _vnSystem: VNSystem | null = null;

  private readonly _canvasWidth: number;
  private readonly _canvasHeight: number;
  private readonly _textWidth: number;
  private readonly _typeSpeed: number;
  /**
   * Canvas 2D context used for text measurement when typewriter is active.
   * Null when the DOM is unavailable (e.g. Node/Vitest) or typewriter is off.
   */
  private readonly _measureCtx: CanvasRenderingContext2D | null;

  private _typeAccum = 0;
  private _typeTarget = "";
  private _typeIndex = 0;
  private _typing = false;

  constructor(opts: VNTextboxOptions) {
    const cw = opts.canvasWidth;
    const ch = opts.canvasHeight;
    const h = opts.height ?? 160;
    const npH = opts.namePlateHeight ?? 36;
    const px = opts.paddingX ?? 24;
    const panelColor = opts.panelColor ?? "#0d0d1a";
    const namePlateColor = opts.namePlateColor ?? "#3c2d6e";
    const textColor = opts.textColor ?? "#ffffff";
    const fs = opts.fontSize ?? 16;
    const ff = opts.fontFamily ?? "sans-serif";

    this._scene = opts.scene;
    this._tree = opts.tree;
    this._canvasWidth = cw;
    this._canvasHeight = ch;
    this._textWidth = cw - px * 2;
    this._typeSpeed = opts.typewriterSpeed ?? 0;

    if (this._typeSpeed > 0 && typeof document !== "undefined") {
      const mc = document.createElement("canvas");
      const ctx = mc.getContext("2d");
      if (ctx !== null) {
        ctx.font = `${fs}px ${ff}`;
        this._measureCtx = ctx;
      } else {
        this._measureCtx = null;
      }
    } else {
      this._measureCtx = null;
    }

    // Widget layout — all anchored bottom-left so positions are stable
    // regardless of canvas height (y is measured from the bottom edge),
    // resolved to absolute LayoutStyle.left/.top via resolveAnchoredPosition.
    //
    //  ch ─────────────────────────────────────
    //  ch - npH ──── name plate ────────────────
    //  ch - (h+npH) ─ panel top ────────────────
    this._panel = this._tree.createWidget(this._scene);
    this._placeBottomLeft(this._panel, 0, 0, cw, h + npH);
    this._panel.add(PanelStyle, {
      background: panelColor,
      borderRadius: 0,
    });
    this._panel.add(WidgetAppearance, { visible: true, alpha: 0.88 });

    this._namePlateBg = this._tree.createWidget(this._scene, this._panel);
    this._placeBottomLeft(this._namePlateBg, 0, h, cw, npH);
    this._namePlateBg.add(PanelStyle, {
      background: namePlateColor,
      borderRadius: 0,
    });

    this._namePlate = this._tree.createWidget(this._scene, this._panel);
    this._placeBottomLeft(this._namePlate, px, h, 200, npH);
    this._namePlate.add(Label, { color: textColor, fontSize: fs, font: ff });

    this._text = this._tree.createWidget(this._scene, this._panel);
    this._placeBottomLeft(
      this._text,
      px,
      npH + 12,
      this._textWidth,
      h - npH - 24,
    );
    this._text.add(Label, { color: textColor, fontSize: fs, font: ff });
  }

  /** Resolves `anchor: "bottom-left"` for `(x, y, width, height)` and writes the entity's `LayoutStyle`. */
  private _placeBottomLeft(
    entity: Entity,
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    const { left, top } = resolveAnchoredPosition(
      "bottom-left",
      x,
      y,
      width,
      height,
      this._canvasWidth,
      this._canvasHeight,
    );
    const style = entity.get(LayoutStyle);
    if (style !== undefined) {
      Object.assign(style, { positionType: 1, left, top, width, height });
    }
  }

  /** Wire this textbox to a VNSystem instance. The textbox immediately reflects the current node. */
  bind(vn: VNSystem): void {
    this._vnSystem = vn;
    this._sync();
  }

  /** Show or hide the textbox. */
  set visible(v: boolean) {
    const appearance = this._panel.get(WidgetAppearance);
    if (appearance !== undefined) appearance.visible = v;
  }

  get visible(): boolean {
    return this._panel.get(WidgetAppearance)?.visible ?? true;
  }

  /** True while a typewriter reveal is in progress. */
  get isTyping(): boolean {
    return this._typing;
  }

  /**
   * Advance the typewriter animation. Call once per frame from `onUpdate(dt)`.
   */
  update(dt: number): void {
    if (!this._typing) return;
    this._typeAccum += dt;
    const charsToReveal = Math.floor(this._typeAccum * this._typeSpeed);
    if (charsToReveal <= 0) return;
    this._typeAccum -= charsToReveal / this._typeSpeed;
    this._typeIndex = Math.min(
      this._typeIndex + charsToReveal,
      this._typeTarget.length,
    );
    const label = this._text.get(Label);
    if (label !== undefined) {
      label.text = this._typeTarget.slice(0, this._typeIndex);
    }
    if (this._typeIndex >= this._typeTarget.length) {
      this._typing = false;
      this._typeAccum = 0;
    }
  }

  /**
   * Jump the current typewriter reveal to its end immediately.
   * No-op if no reveal is in progress.
   */
  skipTypewriter(): void {
    if (!this._typing) return;
    this._typing = false;
    this._typeAccum = 0;
    const label = this._text.get(Label);
    if (label !== undefined) label.text = this._typeTarget;
  }

  /**
   * Hit-tests `(x, y)` against the panel's current on-screen box (post-
   * `tree.layout()`) and advances/skips as if the panel were clicked.
   * Returns whether the point hit the panel at all, so the caller can
   * decide whether to also dispatch the point elsewhere.
   */
  handlePointerDown(x: number, y: number): boolean {
    const box = this._panel.get(Layout);
    if (box === undefined) return false;
    const hit =
      x >= box.x &&
      x <= box.x + box.width &&
      y >= box.y &&
      y <= box.y + box.height;
    if (hit) this._advance();
    return hit;
  }

  /** Update speaker name and dialogue text from the current VNSystem node. */
  private _sync(): void {
    if (this._vnSystem === null) return;
    const node = this._vnSystem.currentNode;
    const appearance = this._panel.get(WidgetAppearance);
    if (node === null) {
      if (appearance !== undefined) appearance.visible = false;
      return;
    }
    if (appearance !== undefined) appearance.visible = true;
    const namePlate = this._namePlate.get(Label);
    const text = this._text.get(Label);
    if (node.type === "dialogue") {
      if (namePlate !== undefined) namePlate.text = node.speaker;
      if (this._typeSpeed > 0) {
        this._startTypewriter(node.text);
      } else if (text !== undefined) {
        text.text = node.text;
      }
    } else if (node.type === "choice") {
      this._stopTypewriter();
      if (namePlate !== undefined) namePlate.text = "";
      if (text !== undefined) {
        text.text = node.options
          .map((o, i) => `${i + 1}. ${o.label}`)
          .join("\n");
      }
    } else {
      this._stopTypewriter();
      if (appearance !== undefined) appearance.visible = false;
    }
  }

  /**
   * Pre-calculate word-wrap line breaks so the typewriter reveal never causes
   * the layout engine to reflow mid-word. Returns the original text with
   * explicit newlines inserted at wrap boundaries.
   */
  private _prewrap(text: string): string {
    const ctx = this._measureCtx;
    if (ctx === null) return text;

    const maxWidth = this._textWidth;
    const lines: string[] = [];

    for (const paragraph of text.split("\n")) {
      const words = paragraph.split(" ");
      let line = "";
      for (const word of words) {
        const candidate = line.length > 0 ? `${line} ${word}` : word;
        if (ctx.measureText(candidate).width > maxWidth && line.length > 0) {
          lines.push(line);
          line = word;
        } else {
          line = candidate;
        }
      }
      lines.push(line);
    }

    return lines.join("\n");
  }

  private _startTypewriter(text: string): void {
    this._stopTypewriter();
    this._typeTarget = this._prewrap(text);
    this._typeIndex = 0;
    this._typeAccum = 0;
    this._typing = true;
    const label = this._text.get(Label);
    if (label !== undefined) label.text = "";
  }

  private _stopTypewriter(): void {
    this._typing = false;
    this._typeAccum = 0;
  }

  private _advance(): void {
    if (this._vnSystem === null) return;
    // First click skips typewriter if in progress; second click advances.
    if (this._typing) {
      this.skipTypewriter();
      return;
    }
    const node = this._vnSystem.currentNode;
    if (node === null) return;
    if (node.type === "dialogue") {
      this._vnSystem.advance();
      this._sync();
    }
    // choice selection is handled externally via VNSystem.selectOption()
  }

  /** Destroy the textbox's widget entities. Call when the scene unloads. */
  destroy(): void {
    this._stopTypewriter();
    this._tree.destroyWidget(this._scene, this._namePlateBg);
    this._tree.destroyWidget(this._scene, this._namePlate);
    this._tree.destroyWidget(this._scene, this._text);
    this._tree.destroyWidget(this._scene, this._panel);
    this._vnSystem = null;
  }
}
