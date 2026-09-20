import { describe, it, expect, afterEach } from "vitest";
import { PostProcessSystem } from "../systems/PostProcessSystem.js";
import {
  colourblindFilterDefsSVG,
  colourblindFilterId,
} from "../systems/PostProcessSystem.js";
import { LabelWidget } from "../ui/widgets/label.js";
import { accessibilitySettings } from "../ui/AccessibilitySettings.js";

describe("colourblind post-process filter", () => {
  it("cssFilterForLayer returns an SVG filter url referencing the mode", () => {
    const pp = new PostProcessSystem();
    pp.setLayerFilter("ui", { type: "colourblind", mode: "protanopia" });
    expect(pp.cssFilterForLayer("ui")).toBe(
      `url(#${colourblindFilterId("protanopia")})`,
    );
  });

  it("defaults to deuteranopia when no mode is given", () => {
    const pp = new PostProcessSystem();
    pp.setLayerFilter("ui", { type: "colourblind" });
    expect(pp.cssFilterForLayer("ui")).toBe(
      `url(#${colourblindFilterId("deuteranopia")})`,
    );
  });

  it("colourblindFilterDefsSVG emits one filter per mode", () => {
    const svg = colourblindFilterDefsSVG();
    expect(svg).toContain(colourblindFilterId("protanopia"));
    expect(svg).toContain(colourblindFilterId("deuteranopia"));
    expect(svg).toContain(colourblindFilterId("tritanopia"));
    expect(svg).toContain("feColorMatrix");
  });

  it("disabled filter returns empty string", () => {
    const pp = new PostProcessSystem();
    pp.setLayerFilter("ui", { type: "colourblind", mode: "tritanopia" });
    pp.toggleLayerFilter("ui", false);
    expect(pp.cssFilterForLayer("ui")).toBe("");
  });
});

describe("accessibilitySettings text scale", () => {
  afterEach(() => {
    accessibilitySettings.reset();
  });

  it("defaults to 1", () => {
    expect(accessibilitySettings.textScale).toBe(1);
  });

  it("clamps to [0.5, 3]", () => {
    accessibilitySettings.textScale = 10;
    expect(accessibilitySettings.textScale).toBe(3);
    accessibilitySettings.textScale = 0;
    expect(accessibilitySettings.textScale).toBe(0.5);
  });

  it("LabelWidget renders with fontSize scaled by the global multiplier", () => {
    const label = new LabelWidget({ fontSize: 20, text: "hi" });
    let fontUsed = "";
    const ctx = {
      save: () => {},
      restore: () => {},
      fillText: () => {},
      set fillStyle(_v: string) {},
      set globalAlpha(_v: number) {},
      set textAlign(_v: string) {},
      set textBaseline(_v: string) {},
      set font(v: string) {
        fontUsed = v;
      },
    };
    accessibilitySettings.textScale = 2;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    label.render(ctx as any, 800, 600);
    expect(fontUsed).toBe("40px sans-serif");
  });
});
