import { describe, it, expect } from "vitest";
import { VNTextbox } from "../systems/VNTextbox.js";
import { UISystem } from "../systems/UISystem.js";
import { PanelWidget } from "../ui/widgets/panel.js";

describe("VNTextbox", () => {
  it("applies namePlateColor to the name plate background panel", () => {
    const ui = new UISystem();
    const textbox = new VNTextbox({
      canvasWidth: 800,
      canvasHeight: 600,
      ui,
      namePlateColor: "#ff00ff",
    });

    // The name plate background is the first PanelWidget child pushed onto
    // the root panel (see VNTextbox constructor) — it must actually carry
    // the configured namePlateColor rather than the option going unused.
    const root = (textbox as unknown as { _panel: { children: unknown[] } })
      ._panel;
    const namePlateBg = root.children.find(
      (c): c is PanelWidget => c instanceof PanelWidget,
    );
    expect(namePlateBg).toBeDefined();
    expect(namePlateBg?.background).toBe("#ff00ff");
  });

  it("defaults namePlateColor when not provided", () => {
    const ui = new UISystem();
    const textbox = new VNTextbox({
      canvasWidth: 800,
      canvasHeight: 600,
      ui,
    });
    const root = (textbox as unknown as { _panel: { children: unknown[] } })
      ._panel;
    const namePlateBg = root.children.find(
      (c): c is PanelWidget => c instanceof PanelWidget,
    );
    expect(namePlateBg?.background).toBe("#3c2d6e");
  });
});
