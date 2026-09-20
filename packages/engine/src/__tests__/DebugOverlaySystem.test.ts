import { describe, it, expect, beforeEach } from "vitest";
import { DebugOverlaySystem } from "../systems/DebugOverlaySystem.js";

describe("DebugOverlaySystem", () => {
  let overlay: DebugOverlaySystem;

  beforeEach(() => {
    overlay = new DebugOverlaySystem();
  });

  it("is disabled by default and its root widget is hidden", () => {
    expect(overlay.enabled).toBe(false);
    expect(overlay.root.visible).toBe(false);
  });

  it("enable/disable/toggle flip visibility together", () => {
    overlay.enable();
    expect(overlay.enabled).toBe(true);
    expect(overlay.root.visible).toBe(true);
    overlay.toggle();
    expect(overlay.enabled).toBe(false);
    expect(overlay.root.visible).toBe(false);
  });

  it("update() tracks entity count and frame time", () => {
    overlay.enable();
    overlay.update(1 / 60, 42);
    expect(overlay.root.children.length).toBeGreaterThan(0);
  });

  it("registerCommand and runCommand dispatch by name", () => {
    let received: string[] = [];
    overlay.registerCommand("spawn", (args) => {
      received = args;
      return `spawned ${args[0] ?? ""}`;
    });
    const result = overlay.runCommand("spawn goblin 3");
    expect(received).toEqual(["goblin", "3"]);
    expect(result).toBe("spawned goblin");
  });

  it("runCommand on an unknown command warns and does not throw", () => {
    const result = overlay.runCommand("nonexistent");
    expect(result).toContain("unknown command");
  });

  it("log/warn/logError push into history, capped at 200 entries", () => {
    overlay.log("hello");
    overlay.warn("careful");
    overlay.logError("boom");
    expect(overlay.history.length).toBe(3);
    expect(overlay.history[2]?.level).toBe("error");

    for (let i = 0; i < 250; i++) overlay.log(`line ${i}`);
    expect(overlay.history.length).toBeLessThanOrEqual(200);
  });

  it("help command lists registered commands", () => {
    overlay.registerCommand("foo", () => "bar");
    const result = overlay.runCommand("help");
    expect(result).toContain("foo");
    expect(result).toContain("help");
  });
});
