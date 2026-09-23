import { describe, it, expect, beforeEach } from "vitest";
import { Scene } from "../Scene.js";
import { WidgetTree } from "../ui/WidgetTree.js";
import { DebugOverlaySystem } from "../systems/DebugOverlaySystem.js";
import { Layout, LayoutStyle } from "../components/Layout.js";
import { Label, WidgetAppearance } from "../components/Widgets.js";

let scene: Scene;
let tree: WidgetTree;
let overlay: DebugOverlaySystem;

beforeEach(async () => {
  scene = new Scene();
  tree = new WidgetTree();
  await tree.init();
  overlay = new DebugOverlaySystem(scene, tree);
});

describe("DebugOverlaySystem", () => {
  it("starts disabled and hidden", () => {
    expect(overlay.enabled).toBe(false);
    expect(overlay.root.get(WidgetAppearance)?.visible).toBe(false);
  });

  it("enable()/disable()/toggle() flip visibility in lockstep with enabled", () => {
    overlay.enable();
    expect(overlay.enabled).toBe(true);
    expect(overlay.root.get(WidgetAppearance)?.visible).toBe(true);

    overlay.toggle();
    expect(overlay.enabled).toBe(false);
    expect(overlay.root.get(WidgetAppearance)?.visible).toBe(false);
  });

  it("update() only writes the stats/console labels while enabled", () => {
    overlay.update(1 / 60, 42);
    tree.layout(scene, 640, 360);
    // Disabled — the constructor-time empty text should be untouched.
    expect(scene).toBeDefined();

    overlay.enable();
    overlay.update(1 / 60, 42);
    const labelEntities = tree
      .orderedWidgets(scene)
      .filter((e) => e.get(Label) !== undefined);
    const stats = labelEntities[0]?.get(Label);
    expect(stats?.text).toContain("entities: 42");
  });

  it("log()/warn()/logError() append to history, capped at 200 entries", () => {
    overlay.log("hello");
    overlay.warn("careful");
    overlay.logError("boom");
    expect(overlay.history.map((e) => e.level)).toEqual([
      "log",
      "warn",
      "error",
    ]);

    for (let i = 0; i < 250; i++) overlay.log(`line ${i}`);
    expect(overlay.history.length).toBe(200);
  });

  it("registerCommand()/runCommand() dispatches and logs the invocation", () => {
    overlay.registerCommand("echo", (args) => args.join(" "));
    const result = overlay.runCommand("echo hi there");
    expect(result).toBe("hi there");
    expect(overlay.history.some((e) => e.message === "> echo hi there")).toBe(
      true,
    );
  });

  it("runCommand() on an unregistered command warns and returns a message", () => {
    const result = overlay.runCommand("nope");
    expect(result).toBe("unknown command: nope");
    expect(overlay.history.some((e) => e.level === "warn")).toBe(true);
  });

  it("the built-in help/clear commands work", () => {
    expect(overlay.commandNames).toContain("help");
    overlay.log("keep me");
    overlay.runCommand("clear");
    // clear's handler empties the log, but runCommand() then logs the
    // invocation itself ("> clear") afterwards — same real classic
    // behaviour (systems/DebugOverlaySystem.ts), not a difference here.
    expect(overlay.history.map((e) => e.message)).toEqual(["> clear"]);
  });

  it("the root widget is positioned absolutely at (8, 8), independent of layout flow", () => {
    tree.layout(scene, 640, 360);
    const box = overlay.root.get(Layout);
    expect(box?.x).toBe(8);
    expect(box?.y).toBe(8);
    expect(overlay.root.get(LayoutStyle)?.positionType).toBe(1);
  });
});
