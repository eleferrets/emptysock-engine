import { describe, expect, it } from "vitest";
import { Game } from "../Game.js";
import { ViewportSystem } from "../systems/ViewportSystem.js";
import {
  keyboard_check,
  keyboard_check_pressed,
  keyboard_check_released,
  gamepad_axis_value,
  gamepad_is_connected,
  display_get_gui_width,
  display_get_gui_height,
  application_surface,
  surface_get_width,
  surface_get_height,
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
});
