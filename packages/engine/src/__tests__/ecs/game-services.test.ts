import { describe, expect, it } from "vitest";
import { Game, defineScene } from "../../ecs/Game.js";
import { PluginSystem } from "../../core/PluginSystem.js";
import { VariableStore } from "../../systems/VariableStore.js";
import { LocalisationSystem } from "../../systems/LocalisationSystem.js";
import { ViewportSystem } from "../../systems/ViewportSystem.js";
import { WindowSystem } from "../../systems/WindowSystem.js";

/**
 * Real wiring coverage for CLAUDE.md's "PluginSystem, VariableStore,
 * LocalisationSystem, ViewportSystem, and WindowSystem are Game services"
 * decision — typecheck alone wouldn't catch a missed `services.register()`
 * call or a `SceneLifecycle` construction site left stale.
 */
describe("Game registers PluginSystem/VariableStore/LocalisationSystem/ViewportSystem/WindowSystem as services", () => {
  it("game.services.get(...) returns a real instance for all five, immediately after construction", () => {
    const game = new Game();
    expect(game.services.get(PluginSystem)).toBeInstanceOf(PluginSystem);
    expect(game.services.get(VariableStore)).toBeInstanceOf(VariableStore);
    expect(game.services.get(LocalisationSystem)).toBeInstanceOf(
      LocalisationSystem,
    );
    expect(game.services.get(ViewportSystem)).toBeInstanceOf(ViewportSystem);
    expect(game.services.get(WindowSystem)).toBeInstanceOf(WindowSystem);
  });

  it("SceneLifecycle hands scene code the exact same instances game.services.get() returns", async () => {
    const game = new Game();
    let seen: {
      plugins?: PluginSystem;
      variables?: VariableStore;
      localisation?: LocalisationSystem;
      viewport?: ViewportSystem;
      window?: WindowSystem;
    } = {};

    await game.loadScene(
      defineScene({
        onLoad(_scene, ctx) {
          seen = {
            plugins: ctx.plugins,
            variables: ctx.variables,
            localisation: ctx.localisation,
            viewport: ctx.viewport,
            window: ctx.window,
          };
        },
      }),
      { physics: { gravity: { x: 0, y: 0 } } },
    );

    expect(seen.plugins).toBe(game.services.get(PluginSystem));
    expect(seen.variables).toBe(game.services.get(VariableStore));
    expect(seen.localisation).toBe(game.services.get(LocalisationSystem));
    expect(seen.viewport).toBe(game.services.get(ViewportSystem));
    expect(seen.window).toBe(game.services.get(WindowSystem));

    await game.unloadScene();
  });

  it("the same VariableStore instance persists across a scene reload (Game-owned, not scene-owned)", async () => {
    const game = new Game();
    game.services.get(VariableStore).setSwitch(1, true);

    await game.loadScene(defineScene({}), {
      physics: { gravity: { x: 0, y: 0 } },
    });
    await game.loadScene(defineScene({}), {
      physics: { gravity: { x: 0, y: 0 } },
    });

    expect(game.services.get(VariableStore).getSwitch(1)).toBe(true);
    await game.unloadScene();
  });

  it("two separate Game instances never share VariableStore state (no module-level singleton leak)", () => {
    const gameA = new Game();
    const gameB = new Game();
    gameA.services.get(VariableStore).setSwitch(1, true);

    expect(gameB.services.get(VariableStore).getSwitch(1)).toBe(false);
  });
});
