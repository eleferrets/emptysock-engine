import { type UISystem } from "./UISystem.js";
import { PanelWidget } from "../ui/widgets/panel.js";
import { LabelWidget } from "../ui/widgets/label.js";
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
export class VNTextbox {
  private readonly _ui: UISystem;
  private readonly _panel: PanelWidget;
  private readonly _namePlate: PanelWidget;
  private readonly _nameLabel: LabelWidget;
  private readonly _textLabel: LabelWidget;
  private _vnSystem: VNSystem | null = null;
  private _unsubscribe: (() => void) | null = null;

  constructor(opts: VNTextboxOptions) {
    this._ui = opts.ui;
    const cw = opts.canvasWidth;
    const ch = opts.canvasHeight;
    const h = opts.height ?? 160;
    const npH = opts.namePlateHeight ?? 36;
    const px = opts.paddingX ?? 24;
    const panelColor = opts.panelColor ?? "rgba(13,13,26,0.88)";
    const namePlateColor = opts.namePlateColor ?? "#3c2d6e";
    const textColor = opts.textColor ?? "#ffffff";
    const fs = opts.fontSize ?? 16;
    const totalH = h + npH;

    this._panel = new PanelWidget({
      x: 0,
      y: ch - totalH,
      width: cw,
      height: totalH,
      anchor: "top-left",
      background: panelColor,
    });

    this._namePlate = new PanelWidget({
      x: px,
      y: 0,
      width: 200,
      height: npH,
      anchor: "top-left",
      background: namePlateColor,
    });

    this._nameLabel = new LabelWidget({
      x: 8,
      y: 0,
      width: 184,
      height: npH,
      anchor: "top-left",
      color: textColor,
      fontSize: fs,
      text: "",
    });

    this._textLabel = new LabelWidget({
      x: px,
      y: npH + 12,
      width: cw - px * 2,
      height: h - 24,
      anchor: "top-left",
      color: textColor,
      fontSize: fs,
      text: "",
    });

    this._namePlate.children.push(this._nameLabel);
    this._panel.children.push(this._namePlate);
    this._panel.children.push(this._textLabel);

    this._panel.on("click", () => {
      this._advance();
    });

    this._ui.add(this._panel);
  }

  /** Wire this textbox to a VNSystem instance. The textbox immediately reflects the current node. */
  bind(vn: VNSystem): void {
    this._unsubscribe?.();
    this._vnSystem = vn;
    this._unsubscribe = vn.onNode((_node) => {
      this._sync();
    });
    this._sync();
  }

  /** Show or hide the textbox. */
  set visible(v: boolean) {
    this._panel.visible = v;
  }

  get visible(): boolean {
    return this._panel.visible;
  }

  private _sync(): void {
    if (this._vnSystem === null) return;
    const node = this._vnSystem.currentNode;
    if (node === null) {
      this._panel.visible = false;
      return;
    }
    this._panel.visible = true;
    if (node.type === "dialogue") {
      this._nameLabel.text = node.speaker;
      this._textLabel.text = node.text;
    } else if (node.type === "choice") {
      this._nameLabel.text = "";
      this._textLabel.text = node.options
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
    }
    // choice selection is handled externally via VNSystem.selectOption()
  }

  /** Remove the textbox widgets from UISystem. Call when the scene unloads. */
  destroy(): void {
    this._unsubscribe?.();
    this._unsubscribe = null;
    this._ui.remove(this._panel);
    this._vnSystem = null;
  }
}
