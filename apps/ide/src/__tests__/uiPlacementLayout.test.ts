import { describe, it, expect } from "vitest";
import {
  layoutToWidgets,
  defaultOpts,
  widgetBounds,
  widgetAnchor,
  widgetToSnippet,
  type PlacedWidget,
} from "../components/panels/ui-placement/layout";
import {
  ButtonWidget,
  LabelWidget,
  PanelWidget,
  ProgressBarWidget,
  SliderWidget,
  CheckboxWidget,
  ImageWidget,
} from "@emptysock/engine";

describe("ui-placement layout <-> Widget parity", () => {
  it("layoutToWidgets constructs the real engine Widget subclasses", () => {
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

    const widgets = layoutToWidgets(layout);
    expect(widgets[0]).toBeInstanceOf(PanelWidget);
    expect(widgets[1]).toBeInstanceOf(ButtonWidget);
    expect(widgets[2]).toBeInstanceOf(LabelWidget);
    expect(widgets[3]).toBeInstanceOf(ProgressBarWidget);
    expect(widgets[4]).toBeInstanceOf(SliderWidget);
    expect(widgets[5]).toBeInstanceOf(CheckboxWidget);
    expect(widgets[6]).toBeInstanceOf(ImageWidget);
  });

  it("is a lossless 1:1 mapping: constructing directly from the same opts produces an equivalent widget", () => {
    const placed: PlacedWidget<"button"> = {
      id: "w1",
      type: "button",
      opts: {
        x: 30,
        y: 40,
        width: 120,
        height: 36,
        anchor: "center",
        label: "Play",
      },
    };

    const [fromLayout] = layoutToWidgets([placed]);
    const handWritten = new ButtonWidget(placed.opts);

    expect(fromLayout).toBeInstanceOf(ButtonWidget);
    const a = fromLayout as ButtonWidget;
    expect(a.x).toBe(handWritten.x);
    expect(a.y).toBe(handWritten.y);
    expect(a.width).toBe(handWritten.width);
    expect(a.height).toBe(handWritten.height);
    expect(a.anchor).toBe(handWritten.anchor);
    expect(a.label).toBe(handWritten.label);
  });

  it("widgetBounds/widgetAnchor read straight off the constructor-options object", () => {
    const placed: PlacedWidget<"panel"> = {
      id: "w1",
      type: "panel",
      opts: {
        x: 5,
        y: 6,
        width: 200,
        height: 120,
        anchor: "bottom-left",
        background: "#111111",
        cornerRadius: 6,
      },
    };
    expect(widgetBounds(placed)).toEqual({ x: 5, y: 6, w: 200, h: 120 });
    expect(widgetAnchor(placed)).toBe("bottom-left");
  });

  it("defaultOpts fills the same fields the engine constructor defaults to", () => {
    const opts = defaultOpts("checkbox", "top-left", 0, 0);
    const widget = new CheckboxWidget(opts);
    expect(widget.label).toBe("Option");
    expect(widget.checked).toBe(false);
  });

  it("widgetToSnippet emits a constructor call using the exact opts object", () => {
    const placed: PlacedWidget<"slider"> = {
      id: "w1",
      type: "slider",
      opts: { x: 1, y: 2, width: 160, value: 0.5, min: 0, max: 1 },
    };
    const snippet = widgetToSnippet(placed);
    expect(snippet).toContain("new SliderWidget({");
    expect(snippet).toContain("value: 0.5");
    expect(snippet).toContain("this.uiSystem.add(slider);");
  });
});
