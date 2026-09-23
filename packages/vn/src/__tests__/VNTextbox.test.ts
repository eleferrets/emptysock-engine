import { describe, it, expect } from "vitest";
import { VNTextbox } from "../VNTextbox.js";
import { Scene, WidgetTree, PanelStyle, type Entity } from "@emptysock/engine";

async function makeSceneAndTree(): Promise<{ scene: Scene; tree: WidgetTree }> {
  const scene = new Scene();
  const tree = new WidgetTree();
  await tree.init();
  return { scene, tree };
}

describe("VNTextbox", () => {
  it("applies namePlateColor to the name plate background panel", async () => {
    const { scene, tree } = await makeSceneAndTree();
    const textbox = new VNTextbox({
      canvasWidth: 800,
      canvasHeight: 600,
      scene,
      tree,
      namePlateColor: "#ff00ff",
    });

    // The name plate background is a real spawned widget entity — it must
    // actually carry the configured namePlateColor rather than the option
    // going unused.
    const namePlateBg = (textbox as unknown as { _namePlateBg: Entity })
      ._namePlateBg;
    expect(namePlateBg.get(PanelStyle)?.background).toBe("#ff00ff");
    tree.destroy();
  });

  it("defaults namePlateColor when not provided", async () => {
    const { scene, tree } = await makeSceneAndTree();
    const textbox = new VNTextbox({
      canvasWidth: 800,
      canvasHeight: 600,
      scene,
      tree,
    });
    const namePlateBg = (textbox as unknown as { _namePlateBg: Entity })
      ._namePlateBg;
    expect(namePlateBg.get(PanelStyle)?.background).toBe("#3c2d6e");
    tree.destroy();
  });
});
