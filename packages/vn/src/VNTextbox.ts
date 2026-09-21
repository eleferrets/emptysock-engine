import { PanelWidget, LabelWidget } from "@emptysock/engine";
import type { UISystem } from "@emptysock/engine";
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
export class VNTextbox {
  private readonly _panel: PanelWidget;
  private readonly _namePlateBg: PanelWidget;
  private readonly _namePlate: LabelWidget;
  private readonly _text: LabelWidget;
  private readonly _ui: UISystem;
  private _vnSystem: VNSystem | null = null;

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

    this._textWidth = cw - px * 2;
    this._typeSpeed = opts.typewriterSpeed ?? 0;
    this._ui = opts.ui;

    // Offscreen canvas for text measurement — only needed when typewriter is on
    // and only available in browser contexts (not Node/Vitest).
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
    // regardless of canvas height (y is measured from the bottom edge).
    //
    //  ch ─────────────────────────────────────
    //  ch - npH ──── name plate ────────────────
    //  ch - (h+npH) ─ panel top ────────────────
    //
    // Panel: fills the full width, h+npH tall, flush to the bottom.
    this._panel = new PanelWidget({
      x: 0,
      y: 0,
      width: cw,
      height: h + npH,
      anchor: "bottom-left",
      background: panelColor,
      cornerRadius: 0,
    });
    this._panel.alpha = 0.88;

    // Name plate background: a coloured strip sitting behind the speaker
    // name label, using namePlateColor to visually separate the speaker's
    // name from the dialogue body below it.
    this._namePlateBg = new PanelWidget({
      x: 0,
      y: h,
      width: cw,
      height: npH,
      anchor: "bottom-left",
      background: namePlateColor,
      cornerRadius: 0,
    });

    // Name plate: top strip of the panel.
    // From bottom: y = h so that oy = ch - npH - h = ch - (h+npH).
    this._namePlate = new LabelWidget({
      x: px,
      y: h,
      width: 200,
      height: npH,
      anchor: "bottom-left",
      color: textColor,
      fontSize: fs,
      font: ff,
    });

    // Text area: below the name plate, with internal padding.
    // From bottom: y = npH + 12 so that oy = ch - (h-npH-24) - (npH+12)
    //   = ch - h + npH + 24 - npH - 12 = ch - h + 12.
    // That places the top of the text area 12 px below the name plate.
    this._text = new LabelWidget({
      x: px,
      y: npH + 12,
      width: this._textWidth,
      height: h - npH - 24,
      anchor: "bottom-left",
      color: textColor,
      fontSize: fs,
      font: ff,
    });

    // Children are positioned absolutely (same cw/ch reference), but grouping
    // them under the panel keeps tick/hit-test in the right order. The
    // background strip must render before (i.e. be pushed before) the label
    // that sits on top of it.
    this._panel.children.push(this._namePlateBg);
    this._panel.children.push(this._namePlate);
    this._panel.children.push(this._text);

    this._panel.on("click", () => this._advance());

    this._ui.add(this._panel);

    // Suppress unused-variable warning — ch is used in the layout comment only,
    // but we accept it as a parameter for future-proofing symmetric APIs.
    void ch;
  }

  /** Wire this textbox to a VNSystem instance. The textbox immediately reflects the current node. */
  bind(vn: VNSystem): void {
    this._vnSystem = vn;
    this._sync();
  }

  /** Show or hide the textbox. */
  set visible(v: boolean) {
    this._panel.visible = v;
  }

  get visible(): boolean {
    return this._panel.visible;
  }

  /** True while a typewriter reveal is in progress. */
  get isTyping(): boolean {
    return this._typing;
  }

  /**
   * Advance the typewriter animation. Call once per frame from `onUpdate(dt)`.
   * If the scene's UISystem.update() is called automatically (it is, via
   * Scene.update()), widget animations already run — this method drives only
   * the character-reveal logic, which is separate.
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
    this._text.text = this._typeTarget.slice(0, this._typeIndex);
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
    this._text.text = this._typeTarget;
  }

  /** Update speaker name and dialogue text from the current VNSystem node. */
  private _sync(): void {
    if (this._vnSystem === null) return;
    const node = this._vnSystem.currentNode;
    if (node === null) {
      this._panel.visible = false;
      return;
    }
    this._panel.visible = true;
    if (node.type === "dialogue") {
      this._namePlate.text = node.speaker;
      if (this._typeSpeed > 0) {
        this._startTypewriter(node.text);
      } else {
        this._text.text = node.text;
      }
    } else if (node.type === "choice") {
      this._stopTypewriter();
      this._namePlate.text = "";
      this._text.text = node.options
        .map((o, i) => `${i + 1}. ${o.label}`)
        .join("\n");
    } else {
      this._stopTypewriter();
      this._panel.visible = false;
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
    this._text.text = "";
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

  /** Remove the textbox widgets from UISystem. Call when the scene unloads. */
  destroy(): void {
    this._stopTypewriter();
    this._ui.remove(this._panel);
    this._vnSystem = null;
  }
}
