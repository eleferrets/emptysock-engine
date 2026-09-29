import { describe, expect, it, vi } from "vitest";
import { Game } from "../Game.js";
import { ViewportSystem } from "../systems/ViewportSystem.js";
import { WindowSystem } from "../systems/WindowSystem.js";
import {
  keyboard_check,
  keyboard_check_pressed,
  keyboard_check_released,
  gamepad_axis_value,
  gamepad_is_connected,
  display_get_gui_width,
  display_get_gui_height,
  display_get_width,
  display_get_height,
  application_surface,
  surface_get_width,
  surface_get_height,
  window_set_size,
  window_get_width,
  window_get_height,
  surface_resize,
  vk_right,
  vk_up,
  type GmlInputContext,
} from "../compat/gmlInput.js";

function ctxFor(game: Game): GmlInputContext {
  return { game };
}

describe("compat/gmlInput.ts — keyboard_check family", () => {
  it("keyboard_check reflects a held key via vk_* translation", () => {
    const game = new Game();
    const ctx = ctxFor(game);
    game.input.snapshot();
    expect(keyboard_check(ctx, vk_right)).toBe(false);

    game.input.simulateKeyDown("ArrowRight");
    game.input.snapshot();
    expect(keyboard_check(ctx, vk_right)).toBe(true);
  });

  it("keyboard_check_pressed fires only on the down-transition frame", () => {
    const game = new Game();
    const ctx = ctxFor(game);
    game.input.snapshot();
    expect(keyboard_check_pressed(ctx, vk_up)).toBe(false);

    game.input.simulateKeyDown("ArrowUp");
    game.input.snapshot();
    expect(keyboard_check_pressed(ctx, vk_up)).toBe(true);

    // Still held next frame — no longer a fresh press.
    game.input.snapshot();
    expect(keyboard_check_pressed(ctx, vk_up)).toBe(false);
  });

  it("keyboard_check_released fires only on the up-transition frame", () => {
    const game = new Game();
    const ctx = ctxFor(game);
    game.input.simulateKeyDown("ArrowUp");
    game.input.snapshot();
    expect(keyboard_check_released(ctx, vk_up)).toBe(false);

    game.input.simulateKeyUp("ArrowUp");
    game.input.snapshot();
    expect(keyboard_check_released(ctx, vk_up)).toBe(true);
  });

  it("returns false honestly with no ctx.game wired", () => {
    expect(keyboard_check({}, vk_right)).toBe(false);
    expect(keyboard_check_pressed({}, vk_right)).toBe(false);
  });
});

describe("compat/gmlInput.ts — gamepad", () => {
  it("gamepad_is_connected/gamepad_axis_value read the frozen snapshot, defaulting honestly", () => {
    const game = new Game();
    const ctx = ctxFor(game);
    game.input.snapshot();
    expect(gamepad_is_connected(ctx, 0)).toBe(false);
    expect(gamepad_axis_value(ctx, 0, 0)).toBe(0);
  });
});

describe("compat/gmlInput.ts — display_get_gui_width/height and application_surface", () => {
  it("reads ViewportSystem's design resolution", () => {
    const game = new Game();
    game.services.get(ViewportSystem).setDesignResolution(320, 180);
    const ctx = ctxFor(game);
    expect(display_get_gui_width(ctx)).toBe(320);
    expect(display_get_gui_height(ctx)).toBe(180);
  });

  it("surface_get_width/height resolve application_surface to the same GUI resolution, and honestly return 0 for any other surface id", () => {
    const game = new Game();
    game.services.get(ViewportSystem).setDesignResolution(320, 180);
    const ctx = ctxFor(game);
    expect(surface_get_width(ctx, application_surface)).toBe(320);
    expect(surface_get_height(ctx, application_surface)).toBe(180);
    expect(surface_get_width(ctx, 42)).toBe(0);
  });

  it("display_get_width/display_get_height honestly alias the GUI design resolution", () => {
    const game = new Game();
    game.services.get(ViewportSystem).setDesignResolution(320, 180);
    const ctx = ctxFor(game);
    expect(display_get_width(ctx)).toBe(320);
    expect(display_get_height(ctx)).toBe(180);
  });
});

describe("compat/gmlInput.ts — window_set_size/surface_resize", () => {
  it("window_set_size calls WindowSystem.setSize without awaiting it", () => {
    const game = new Game();
    const setSize = vi
      .spyOn(game.services.get(WindowSystem), "setSize")
      .mockResolvedValue();
    const ctx = ctxFor(game);
    window_set_size(ctx, 800, 600);
    expect(setSize).toHaveBeenCalledWith(800, 600);
  });

  it("window_get_width/window_get_height read back WindowSystem's real tracked size", () => {
    const game = new Game();
    const ctx = ctxFor(game);
    expect(window_get_width(ctx)).toBe(
      game.services.get(WindowSystem).getSize().width,
    );
    void game.services.get(WindowSystem).setSize(1024, 576);
    expect(window_get_width(ctx)).toBe(1024);
    expect(window_get_height(ctx)).toBe(576);
  });

  it("window_get_width/window_get_height default to 0 with no game wired", () => {
    expect(window_get_width({})).toBe(0);
    expect(window_get_height({})).toBe(0);
  });

  it("surface_resize(application_surface, w, h) resizes ViewportSystem's design resolution", () => {
    const game = new Game();
    const ctx = ctxFor(game);
    surface_resize(ctx, application_surface, 640, 360);
    expect(game.services.get(ViewportSystem).config.designWidth).toBe(640);
    expect(game.services.get(ViewportSystem).config.designHeight).toBe(360);
  });

  it("surface_resize for any other surface id is an honest no-op", () => {
    const game = new Game();
    game.services.get(ViewportSystem).setDesignResolution(320, 180);
    const ctx = ctxFor(game);
    surface_resize(ctx, 42, 999, 999);
    expect(game.services.get(ViewportSystem).config.designWidth).toBe(320);
  });
});

describe("compat/gmlInput.ts — layout-aware letters", () => {
  const ord = (c: string): number => c.charCodeAt(0);
  const provider = (t: Record<string, string>) => ({
    charForCode: (c: string) => t[c],
  });

  it("AZERTY: physical KeyQ answers ord('A'), not ord('Q')", () => {
    const game = new Game();
    const ctx = ctxFor(game);
    game.input.layout.setProvider(
      provider({ KeyQ: "a", KeyA: "q", Semicolon: "m" }),
    );
    game.input.simulateKeyDown("KeyQ");
    game.input.snapshot();
    expect(keyboard_check(ctx, ord("A"))).toBe(true);
    expect(keyboard_check(ctx, ord("Q"))).toBe(false);
    game.input.simulateKeyUp("KeyQ");
    game.input.simulateKeyDown("Semicolon");
    game.input.snapshot();
    expect(keyboard_check(ctx, ord("M"))).toBe(true);
  });

  it("QWERTZ swaps Y and Z", () => {
    const game = new Game();
    const ctx = ctxFor(game);
    game.input.layout.setProvider(provider({ KeyY: "z", KeyZ: "y" }));
    game.input.simulateKeyDown("KeyY");
    game.input.snapshot();
    expect(keyboard_check(ctx, ord("Z"))).toBe(true);
    expect(keyboard_check(ctx, ord("Y"))).toBe(false);
  });

  it("Dvorak: letters follow the produced char", () => {
    const game = new Game();
    const ctx = ctxFor(game);
    game.input.layout.setProvider(provider({ KeyS: "o", Quote: "q" }));
    game.input.simulateKeyDown("Quote");
    game.input.snapshot();
    expect(keyboard_check(ctx, ord("Q"))).toBe(true);
  });

  it("Cyrillic with no Latin: ord('A') falls back to physical KeyA", () => {
    const game = new Game();
    const ctx = ctxFor(game);
    game.input.layout.setProvider(provider({ KeyA: "ф", KeyQ: "й" }));
    game.input.simulateKeyDown("KeyA");
    game.input.snapshot();
    expect(keyboard_check(ctx, ord("A"))).toBe(true);
  });

  it("learned layout works with no provider", () => {
    const game = new Game();
    const ctx = ctxFor(game);
    game.input.simulateKeyDown("KeyQ", "a");
    game.input.snapshot();
    expect(keyboard_check(ctx, ord("A"))).toBe(true);
  });

  it("digits and named keys stay physical even on AZERTY", () => {
    const game = new Game();
    const ctx = ctxFor(game);
    game.input.layout.setProvider(provider({ Digit1: "&", KeyQ: "a" }));
    game.input.simulateKeyDown("Digit1");
    game.input.simulateKeyDown("ArrowUp");
    game.input.snapshot();
    expect(keyboard_check(ctx, ord("1"))).toBe(true);
    expect(keyboard_check(ctx, vk_up)).toBe(true);
  });

  it("no provider: current physical behaviour (regression guard)", () => {
    const game = new Game();
    const ctx = ctxFor(game);
    game.input.simulateKeyDown("KeyA");
    game.input.snapshot();
    expect(keyboard_check(ctx, ord("A"))).toBe(true);
    expect(keyboard_check(ctx, ord("Q"))).toBe(false);
  });

  it("pressed edge is correct across a layout change", () => {
    const game = new Game();
    const ctx = ctxFor(game);
    let table: Record<string, string> = {};
    const cbs: Array<() => void> = [];
    game.input.layout.setProvider({
      charForCode: (c) => table[c],
      onChange: (cb) => (cbs.push(cb), () => {}),
    });
    game.input.simulateKeyDown("KeyA");
    game.input.snapshot();
    expect(keyboard_check_pressed(ctx, ord("A"))).toBe(true);
    game.input.snapshot();
    expect(keyboard_check_pressed(ctx, ord("A"))).toBe(false);
    // Switch to AZERTY while KeyA stays held: ord("A") now maps to KeyQ (up).
    table = { KeyQ: "a", KeyA: "q" };
    cbs.forEach((f) => f());
    game.input.snapshot();
    expect(keyboard_check_pressed(ctx, ord("A"))).toBe(false);
    expect(keyboard_check(ctx, ord("A"))).toBe(false);
    expect(keyboard_check(ctx, ord("Q"))).toBe(true);
    expect(keyboard_check_released(ctx, ord("A"))).toBe(false);
  });
});
