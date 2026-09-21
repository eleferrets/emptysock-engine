import { describe, expect, it, vi } from "vitest";
import { defineComponent } from "../../v2/Component.js";
import { Game, defineScene } from "../../v2/Game.js";

const Position = defineComponent("Position", () => ({ x: 0, y: 0 }));

describe("v2 Game/Scene lifecycle (ENGINE_DESIGN.md §4)", () => {
  it("loadScene creates a Scene plus an ActorSystem and PhysicsSystem", async () => {
    const game = new Game();
    const { scene, actors, physics } = await game.loadScene(defineScene({}), {
      physics: { gravity: { x: 0, y: 0 } },
    });
    expect(scene).toBeDefined();
    expect(actors).toBeDefined();
    expect(physics).toBeDefined();
    // PhysicsSystem was actually initialized, not just constructed.
    expect(() => physics.world).not.toThrow();

    await game.unloadScene();
  });

  it("unloadScene destroys the scene's ActorSystem and PhysicsSystem", async () => {
    const game = new Game();
    const { actors, physics } = await game.loadScene(defineScene({}), {
      physics: { gravity: { x: 0, y: 0 } },
    });
    const destroySpy = vi.spyOn(actors, "destroy");
    const physicsDestroySpy = vi.spyOn(physics, "destroy");

    await game.unloadScene();

    expect(destroySpy).toHaveBeenCalledTimes(1);
    expect(physicsDestroySpy).toHaveBeenCalledTimes(1);
  });

  it("runs onLoad before returning, and onUnload before returning from unloadScene", async () => {
    const events: string[] = [];
    const game = new Game();
    await game.loadScene(
      defineScene({
        onLoad() {
          events.push("load");
        },
        onUnload() {
          events.push("unload");
        },
      }),
      { physics: { gravity: { x: 0, y: 0 } } },
    );
    expect(events).toEqual(["load"]);
    await game.unloadScene();
    expect(events).toEqual(["load", "unload"]);
  });

  it("loading a second scene tears down the first scene's systems first", async () => {
    const game = new Game();
    const first = await game.loadScene(defineScene({}), {
      physics: { gravity: { x: 0, y: 0 } },
    });
    const destroySpy = vi.spyOn(first.actors, "destroy");

    await game.loadScene(defineScene({}), {
      physics: { gravity: { x: 0, y: 0 } },
    });

    expect(destroySpy).toHaveBeenCalledTimes(1);
    await game.unloadScene();
  });

  it("manageLifecycle: false hands back raw systems the engine does not tear down", async () => {
    const game = new Game();
    const { actors } = await game.loadScene(defineScene({}), {
      manageLifecycle: false,
    });
    const destroySpy = vi.spyOn(actors, "destroy");

    await game.unloadScene();

    expect(destroySpy).not.toHaveBeenCalled();
  });

  it("update() drives onUpdate and actor mailbox flush every frame", async () => {
    const dts: number[] = [];
    const game = new Game();
    await game.loadScene(
      defineScene({
        onUpdate(dt) {
          dts.push(dt);
        },
      }),
      { physics: { gravity: { x: 0, y: 0 } } },
    );

    game.update(1 / 60);
    game.update(1 / 60);

    expect(dts).toEqual([1 / 60, 1 / 60]);
    await game.unloadScene();
  });

  it("update() warns loudly (but does not throw) when onUpdate returns a thenable", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const game = new Game();
    await game.loadScene(
      {
        // Cast to bypass the TS-side guard so we can exercise the JS
        // runtime fallback path directly (ENGINE_DESIGN.md §10.2).
        onUpdate: (async () => {}) as unknown as (dt: number) => void,
      },
      { physics: { gravity: { x: 0, y: 0 } } },
    );

    expect(() => game.update(1 / 60)).not.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("onUpdate returned a Promise"),
    );

    warnSpy.mockRestore();
    await game.unloadScene();
  });

  it("spawn/each/component access work identically through the Game-owned scene", async () => {
    const game = new Game();
    const { scene } = await game.loadScene(defineScene({}), {
      physics: { gravity: { x: 0, y: 0 } },
    });
    const entity = scene.spawn();
    entity.add(Position, { x: 3, y: 4 });

    let visited = 0;
    scene.each(Position, (pos) => {
      visited++;
      expect(pos.x).toBe(3);
    });
    expect(visited).toBe(1);

    await game.unloadScene();
  });
});
