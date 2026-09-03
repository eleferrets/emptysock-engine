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
 * const textbox = new VNTextbox({ canvasWidth: 800, canvasHeight: 600 });
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

  constructor(opts: VNTextboxOptions) {
    const cw = opts.canvasWidth;
    const h = opts.height ?? 160;
    const npH = opts.namePlateHeight ?? 36;
    const px = opts.paddingX ?? 24;
    const panelColor = opts.panelColor ?? 0x0d0d1a;
    const namePlateColor = opts.namePlateColor ?? 0x3c2d6e;
    const textColor = opts.textColor ?? 0xffffff;
    const fs = opts.fontSize ?? 16;

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
      width: cw - px * 2,
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
      this._text.text = node.text;
    } else if (node.type === "choice") {
      this._namePlate.text = "";
      this._text.text = node.options
        .map((o, i) => `${i + 1}. ${o.label}`)
        .join("\n");
    } else {
      this._panel.visible = false;
    }
  }

  private _advance(): void {
    if (this._vnSystem === null) return;
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
    UISystem.remove(this._panel);
    this._vnSystem = null;
  }
}
