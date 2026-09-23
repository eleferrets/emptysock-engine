import { describe, it, expect } from "vitest";
import {
  layoutToEntities,
  defaultOpts,
  widgetBounds,
  widgetAnchor,
  widgetToSnippet,
  type PlacedWidget,
} from "../components/panels/ui-placement/layout";
import {
  Scene,
  WidgetTree,
  Layout,
  PanelStyle,
  ButtonState,
  Label,
  Progress,
  Slider,
  Checkbox,
  ImageWidget,
} from "@emptysock/engine";

async function makeTree(): Promise<{ scene: Scene; tree: WidgetTree }> {
  const scene = new Scene();
  const tree = new WidgetTree();
  await tree.init();
  return { scene, tree };
}

describe("ui-placement layout <-> ECS entity parity", () => {
  it("layoutToEntities spawns real widget entities carrying the matching kind component", async () => {
    const { scene, tree } = await makeTree();
    const layout: PlacedWidget[] = [
      {
        id: "w1",
        type: "panel",
        opts: defaultOpts("panel", "top-left", 10, 20),
      },
      { id: "w2", type: "button", opts: defaultOpts("button", "center", 0, 0) },
      { id: "w3", type: "label", opts: defaultOpts("label", "top", 5, 5) },
      {
        id: "w4",
        type: "progress-bar",
        opts: defaultOpts("progress-bar", "bottom", 0, 0),
      },
      { id: "w5", type: "slider", opts: defaultOpts("slider", "left", 0, 0) },
      {
        id: "w6",
        type: "checkbox",
        opts: defaultOpts("checkbox", "right", 0, 0),
      },
      {
        id: "w7",
        type: "image",
        opts: defaultOpts("image", "bottom-right", 0, 0),
      },
    ];

    const entities = layoutToEntities(scene, tree, layout, 480, 270);
    expect(entities[0]?.has(PanelStyle)).toBe(true);
    expect(entities[1]?.has(ButtonState)).toBe(true);
    expect(entities[2]?.has(Label)).toBe(true);
    expect(entities[3]?.has(Progress)).toBe(true);
    expect(entities[4]?.has(Slider)).toBe(true);
    expect(entities[5]?.has(Checkbox)).toBe(true);
    expect(entities[6]?.has(ImageWidget)).toBe(true);
    tree.destroy();
  });

  it("is a lossless 1:1 mapping: the spawned entity's Layout matches resolveAnchoredPosition against the same opts", async () => {
    const { scene, tree } = await makeTree();
    const placed: PlacedWidget<"button"> = {
      id: "w1",
      type: "button",
      opts: {
        ...ButtonState.createDefaults(),
        x: 30,
        y: 40,
        width: 120,
        height: 36,
        anchor: "center",
        label: "Play",
      },
    };

    const [entity] = layoutToEntities(scene, tree, [placed], 480, 270);
    tree.layout(scene, 480, 270);

    expect(entity?.get(ButtonState)?.label).toBe("Play");
    const box = entity?.get(Layout);
    // "center" anchor: left = cw/2 + x - w/2, top = ch/2 + y - h/2
    expect(box?.x).toBe(480 / 2 + 30 - 120 / 2);
    expect(box?.y).toBe(270 / 2 + 40 - 36 / 2);
    tree.destroy();
  });

  it("widgetBounds/widgetAnchor read straight off the opts object", () => {
    const placed: PlacedWidget<"panel"> = {
      id: "w1",
      type: "panel",
      opts: {
        ...PanelStyle.createDefaults(),
        x: 5,
        y: 6,
        width: 200,
        height: 120,
        anchor: "bottom-left",
        background: "#111111",
        borderRadius: 6,
      },
    };
    expect(widgetBounds(placed)).toEqual({ x: 5, y: 6, w: 200, h: 120 });
    expect(widgetAnchor(placed)).toBe("bottom-left");
  });

  it("defaultOpts fills the same fields the matching ECS component defaults to", () => {
    const opts = defaultOpts("checkbox", "top-left", 0, 0);
    expect(opts.label).toBe("Option");
    expect(opts.checked).toBe(false);
  });

  it("widgetToSnippet emits real ECS spawn/add code using the exact opts object", () => {
    const placed: PlacedWidget<"slider"> = {
      id: "w1",
      type: "slider",
      opts: {
        ...Slider.createDefaults(),
        x: 1,
        y: 2,
        width: 160,
        height: 20,
        anchor: "top-left",
        value: 0.5,
      },
    };
    const snippet = widgetToSnippet(placed);
    expect(snippet).toContain("tree.createWidget(scene)");
    expect(snippet).toContain("value: 0.5");
    expect(snippet).toContain("slider.add(Slider,");
  });
});
