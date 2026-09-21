import { describe, expect, it } from "vitest";
import { InputManager } from "../../v2/Input.js";
import { Game, defineScene } from "../../v2/Game.js";

describe("v2 InputManager (ENGINE_DESIGN.md §4 step 1 / §15.3)", () => {
  it("isDown reflects an action bound to a key that is simulated down", () => {
    const input = new InputManager({ jump: [{ kind: "key", code: "Space" }] });
    input.snapshot();
    expect(input.isDown("jump")).toBe(false);

    input.simulateKeyDown("Space");
    input.snapshot();
    expect(input.isDown("jump")).toBe(true);

    input.simulateKeyUp("Space");
    input.snapshot();
    expect(input.isDown("jump")).toBe(false);
  });

  it("an action with no bindings is never down", () => {
    const input = new InputManager();
    input.snapshot();
    expect(input.isDown("nonexistent")).toBe(false);
  });

  it("bindAction adds an action without clearing existing ones", () => {
    const input = new InputManager({ jump: [{ kind: "key", code: "Space" }] });
    input.bindAction("left", [{ kind: "key", code: "ArrowLeft" }]);
    input.simulateKeyDown("Space");
    input.simulateKeyDown("ArrowLeft");
    input.snapshot();
    expect(input.isDown("jump")).toBe(true);
    expect(input.isDown("left")).toBe(true);
  });

  it("input is polled once and frozen for the frame: a mid-frame simulated key change is not observed until the next snapshot", () => {
    const input = new InputManager({ jump: [{ kind: "key", code: "Space" }] });
    input.snapshot();
    expect(input.isDown("jump")).toBe(false);
    expect(input.keyboard.isDown("Space")).toBe(false);

    // Simulate a "device event arriving mid-frame" — must not affect any
    // read until the next explicit snapshot() call.
    input.simulateKeyDown("Space");
    expect(input.isDown("jump")).toBe(false);
    expect(input.keyboard.isDown("Space")).toBe(false);

    input.snapshot();
    expect(input.isDown("jump")).toBe(true);
    expect(input.keyboard.isDown("Space")).toBe(true);
  });

  it("raw keyboard escape hatch (input.keyboard) reads the frozen snapshot", () => {
    const input = new InputManager();
    input.simulateKeyDown("KeyW");
    input.snapshot();
    expect(input.keyboard.isDown("KeyW")).toBe(true);
    expect(input.keyboard.isDown("KeyS")).toBe(false);
  });

  it("raw gamepad escape hatch returns a disconnected snapshot when no pad is present", () => {
    const input = new InputManager();
    input.snapshot();
    const pad = input.gamepad(0);
    expect(pad.connected).toBe(false);
    expect(pad.isButtonDown(0)).toBe(false);
    expect(pad.axis(0)).toBe(0);
  });

  it("raw touch escape hatch defaults to an empty list headless", () => {
    const input = new InputManager();
    input.snapshot();
    expect(input.touches).toEqual([]);
  });

  it("Game.update()'s step 1 snapshots input before onUpdate runs, and onUpdate sees a frozen value", async () => {
    const seenDuringUpdate: boolean[] = [];
    const game = new Game();
    await game.loadScene(
      defineScene({
        onUpdate() {
          seenDuringUpdate.push(game.input.isDown("jump"));
        },
      }),
      { physics: { gravity: { x: 0, y: 0 } } },
    );
    game.input.bindAction("jump", [{ kind: "key", code: "Space" }]);

    game.input.simulateKeyDown("Space");
    game.update(1 / 60); // snapshot happens as step 1, so onUpdate sees it as down
    expect(seenDuringUpdate).toEqual([true]);

    // Simulating mid-frame (after this frame's update already ran) must not
    // retroactively change what already happened, and must not be visible
    // until the *next* update()'s own step-1 snapshot.
    game.input.simulateKeyUp("Space");
    expect(game.input.isDown("jump")).toBe(true); // still last frame's frozen value
    game.update(1 / 60);
    expect(seenDuringUpdate).toEqual([true, false]);

    await game.unloadScene();
  });

  it("input persists across scene loads (game-owned, not scene-owned)", async () => {
    const game = new Game();
    game.input.bindAction("jump", [{ kind: "key", code: "Space" }]);
    game.input.simulateKeyDown("Space");

    await game.loadScene(defineScene({}), {
      physics: { gravity: { x: 0, y: 0 } },
    });
    await game.loadScene(defineScene({}), {
      physics: { gravity: { x: 0, y: 0 } },
    });

    game.update(1 / 60);
    expect(game.input.isDown("jump")).toBe(true);
    await game.unloadScene();
  });
});
