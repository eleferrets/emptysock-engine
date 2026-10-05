import { describe, expect, it, vi } from "vitest";
import { defineComponent } from "../Component.js";
import { Game, defineScene, type SceneRenderer } from "../Game.js";
import type { Scene } from "../Scene.js";

const NOOP_PHYSICS = { physics: { gravity: { x: 0, y: 0 } } } as const;

describe("ECS Game overlay scenes", () => {
  it("loadOverlay stacks on top of the main scene without unloading it", async () => {
    const game = new Game();
    const main = await game.loadScene(defineScene({}), NOOP_PHYSICS);
    const overlay = await game.loadOverlay(defineScene({}));

    expect(game.currentScene).toBe(main.scene);
    expect(game.overlays).toEqual([overlay]);

    await game.unloadScene();
    await game.unloadOverlay();
  });

  it("gives an overlay its own ActorSystem, distinct from the main scene's", async () => {
    const game = new Game();
    const main = await game.loadScene(defineScene({}), NOOP_PHYSICS);
    const overlay = await game.loadOverlay(defineScene({}));

    expect(overlay.actors).not.toBe(main.actors);

    await game.unloadScene();
    await game.unloadOverlay();
  });

  it("does not initialize an overlay's PhysicsSystem by default (no PhysicsSystem for a HUD)", async () => {
    const game = new Game();
    await game.loadScene(defineScene({}), NOOP_PHYSICS);
    const overlay = await game.loadOverlay(defineScene({}));

    // An uninitialized PhysicsSystem's `.world` getter throws — this is the
    // "inert" state §12.3 asks for, distinct from a real, stepped world.
    expect(() => overlay.physics.world).toThrow();

    await game.unloadScene();
    await game.unloadOverlay();
  });

  it("an overlay survives the main scene being reloaded underneath it", async () => {
    const game = new Game();
    await game.loadScene(defineScene({}), NOOP_PHYSICS);
    const overlay = await game.loadOverlay(defineScene({}));
    const overlayDestroySpy = vi.spyOn(overlay.actors, "destroy");

    // Reload the main scene — loadScene's internal unloadScene() must never
    // touch this._overlays.
    await game.loadScene(defineScene({}), NOOP_PHYSICS);

    expect(game.overlays).toEqual([overlay]);
    expect(overlayDestroySpy).not.toHaveBeenCalled();

    await game.unloadScene();
    await game.unloadOverlay();
  });

  it("unloadOverlay tears down that overlay's ActorSystem and removes it from the stack", async () => {
    const game = new Game();
    await game.loadScene(defineScene({}), NOOP_PHYSICS);
    const overlay = await game.loadOverlay(defineScene({}));
    const destroySpy = vi.spyOn(overlay.actors, "destroy");

    await game.unloadOverlay();

    expect(destroySpy).toHaveBeenCalledTimes(1);
    expect(game.overlays).toEqual([]);

    await game.unloadScene();
  });

  it("multiple overlays stack in call order and unload LIFO by default", async () => {
    const game = new Game();
    await game.loadScene(defineScene({}), NOOP_PHYSICS);
    const first = await game.loadOverlay(defineScene({}));
    const second = await game.loadOverlay(defineScene({}));

    expect(game.overlays).toEqual([first, second]);

    await game.unloadOverlay(); // no arg -> most recently loaded

    expect(game.overlays).toEqual([first]);

    await game.unloadOverlay(first.scene);
    expect(game.overlays).toEqual([]);

    await game.unloadScene();
  });

  it("update() flushes each overlay's actor mailbox and runs its onUpdate every frame", async () => {
    const game = new Game();
    await game.loadScene(defineScene({}), NOOP_PHYSICS);
    const events: string[] = [];
    await game.loadOverlay(
      defineScene({
        onUpdate() {
          events.push("overlay-update");
        },
      }),
    );

    game.update(1 / 60);
    game.update(1 / 60);

    expect(events).toEqual(["overlay-update", "overlay-update"]);

    await game.unloadScene();
    await game.unloadOverlay();
  });

  it("attachRenderer wires update()'s render step to render the main scene then overlays, in call order", async () => {
    const game = new Game();
    const main = await game.loadScene(defineScene({}), NOOP_PHYSICS);
    const first = await game.loadOverlay(defineScene({}));
    const second = await game.loadOverlay(defineScene({}));

    const renderFrame = vi.fn();
    const renderer: SceneRenderer = { renderFrame };
    game.attachRenderer(renderer);

    game.update(1 / 60);

    expect(renderFrame).toHaveBeenCalledTimes(1);
    expect(renderFrame).toHaveBeenCalledWith(main.scene, [
      first.scene,
      second.scene,
    ]);

    await game.unloadScene();
    await game.unloadOverlay();
    await game.unloadOverlay();
  });

  it("update() never calls the renderer for a scene loaded with headless: true", async () => {
    const game = new Game();
    await game.loadScene(defineScene({}), { ...NOOP_PHYSICS, headless: true });

    const renderFrame = vi.fn();
    game.attachRenderer({ renderFrame });

    game.update(1 / 60);

    expect(renderFrame).not.toHaveBeenCalled();

    await game.unloadScene();
  });

  it("detachRenderer stops update() from calling the renderer", async () => {
    const game = new Game();
    await game.loadScene(defineScene({}), NOOP_PHYSICS);
    const renderFrame = vi.fn();
    game.attachRenderer({ renderFrame } as SceneRenderer);
    game.detachRenderer();

    game.update(1 / 60);

    expect(renderFrame).not.toHaveBeenCalled();
    await game.unloadScene();
  });

  it("Finding 7: an overlay loaded with options.physics has its physics actually stepped by update()", async () => {
    const { PhysicsBody } = await import("../components/PhysicsBody.js");
    const game = new Game();
    await game.loadScene(defineScene({}), NOOP_PHYSICS);
    const overlay = await game.loadOverlay(defineScene({}), {
      physics: { gravity: { x: 0, y: -50 } },
    });

    // The overlay's PhysicsSystem is now genuinely initialized...
    expect(() => overlay.physics.world).not.toThrow();

    const entity = overlay.scene.spawn();
    entity.add(PhysicsBody, {
      type: "dynamic",
      shape: "circle",
      radius: 0.5,
      position: { x: 0, y: 10 },
    });

    // ...and update() steps it every frame without the caller manually
    // driving `overlay.physics.update(...)` themselves.
    for (let i = 0; i < 30; i++) game.update(1 / 60);

    expect(entity.get(PhysicsBody)?.position.y).toBeLessThan(10);

    await game.unloadScene();
    await game.unloadOverlay();
  });

  it("spawn/each/component access work identically on an overlay's own scene", async () => {
    const Position = defineComponent("Position", () => ({ x: 0, y: 0 }));
    const game = new Game();
    await game.loadScene(defineScene({}), NOOP_PHYSICS);
    const overlay = await game.loadOverlay(defineScene({}));

    const entity: ReturnType<Scene["spawn"]> = overlay.scene.spawn();
    entity.add(Position, { x: 9 });

    let visited = 0;
    overlay.scene.each(Position, (pos) => {
      visited++;
      expect(pos.x).toBe(9);
    });
    expect(visited).toBe(1);

    await game.unloadScene();
    await game.unloadOverlay();
  });
});
