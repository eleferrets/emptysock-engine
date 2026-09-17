import { UISystem } from "./UISystem.js";
import type { UIComponent } from "./UISystem.js";
import type { VNSystem } from "./VNSystem.js";

export interface VNTextboxOptions {
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
  /** Fill colour of the dialogue panel (0xRRGGBB). Default 0x0d0d1a at 80% opacity. */
  panelColor?: number;
  /** Fill colour of the name plate (0xRRGGBB). Default 0x3c2d6e. */
  namePlateColor?: number;
  /** Text colour (0xRRGGBB). Default 0xffffff. */
  textColor?: number;
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
 * Creates a panel anchored to the bottom of the canvas with a speaker name
 * plate and a text area. Call `bind(vnSystem)` to wire it to a VNSystem
 * instance — it will automatically update whenever the current node changes.
 *
 * @example
 * ```typescript
 * const textbox = new VNTextbox({
 *   canvasWidth: 800,
 *   canvasHeight: 600,
 *   typewriterSpeed: 40,  // 40 chars/sec, smart line-break pre-calculation
 * });
 * textbox.bind(myVnSystem);
 *
 * // In the game loop render callback:
 * UISystem.render(ctx, 800, 600);
 * ```
 */
export class VNTextbox {
  private readonly _panel: UIComponent;
  private readonly _namePlate: UIComponent;
  private readonly _text: UIComponent;
  private _vnSystem: VNSystem | null = null;

  private readonly _textWidth: number;
  private readonly _typeSpeed: number;
  private readonly _measureCtx: CanvasRenderingContext2D | null;

  private _typeTimer: ReturnType<typeof setInterval> | null = null;
  private _typeTarget = "";
  private _typeIndex = 0;
  private _typing = false;

  constructor(opts: VNTextboxOptions) {
    const cw = opts.canvasWidth;
    const h = opts.height ?? 160;
    const npH = opts.namePlateHeight ?? 36;
    const px = opts.paddingX ?? 24;
    const panelColor = opts.panelColor ?? 0x0d0d1a;
    const namePlateColor = opts.namePlateColor ?? 0x3c2d6e;
    const textColor = opts.textColor ?? 0xffffff;
    const fs = opts.fontSize ?? 16;
    const ff = opts.fontFamily ?? "sans-serif";

    this._textWidth = cw - px * 2;
    this._typeSpeed = opts.typewriterSpeed ?? 0;

    // Offscreen canvas for text measurement — only needed when typewriter is on.
    if (this._typeSpeed > 0) {
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

    this._panel = UISystem.create("panel", {
      x: 0,
      y: -(h + npH),
      width: cw,
      height: h + npH,
      anchor: "bottom-left",
      style: { backgroundColor: panelColor, opacity: 0.88 },
      interactive: true,
    });

    this._namePlate = this._panel.createChild("panel", {
      x: px,
      y: 0,
      width: 200,
      height: npH,
      style: { backgroundColor: namePlateColor },
      interactive: false,
    });

    this._text = this._panel.createChild("text", {
      x: px,
      y: npH + 12,
      width: this._textWidth,
      height: h - npH - 24,
      style: { color: textColor, fontSize: fs },
      interactive: false,
    });

    this._panel.onClick(() => this._advance());
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
   * Jump the current typewriter reveal to its end immediately.
   * No-op if no reveal is in progress.
   */
  skipTypewriter(): void {
    if (!this._typing) return;
    this._stopTypewriter();
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
    this._typing = true;
    this._text.text = "";

    const intervalMs = 1000 / this._typeSpeed;
    this._typeTimer = setInterval(() => {
      if (this._typeIndex < this._typeTarget.length) {
        this._typeIndex++;
        this._text.text = this._typeTarget.slice(0, this._typeIndex);
      } else {
        this._stopTypewriter();
      }
    }, intervalMs);
  }

  private _stopTypewriter(): void {
    if (this._typeTimer !== null) {
      clearInterval(this._typeTimer);
      this._typeTimer = null;
    }
    this._typing = false;
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

  /** Remove the textbox components from UISystem. Call when the scene unloads. */
  destroy(): void {
    this._stopTypewriter();
    UISystem.remove(this._panel);
    this._vnSystem = null;
  }
}
