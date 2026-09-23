import { describe, expect, it } from "vitest";
import { Game, defineScene } from "../../ecs/Game.js";
import { componentRegistry } from "../../ecs/ComponentRegistry.js";
import { Transform } from "../../ecs/components/Transform.js";
import { Meta } from "../../ecs/components/Meta.js";

/**
 * `componentRegistry.registeredComponents(world)` — the piece that lets
 * `QueryChannel` see a game's real component set without being told about
 * it in advance (ground rule 13, see QueryChannel.ts's doc comment).
 */
describe("ComponentRegistry.registeredComponents", () => {
  it("returns [] for a world nothing has touched yet", async () => {
    const game = new Game();
    const { scene } = await game.loadScene(defineScene({}));
    expect(componentRegistry.registeredComponents(scene.world)).toEqual([]);
    await game.unloadScene();
  });

  it("lists every component name at least one entity has used, in registration order", async () => {
    const game = new Game();
    const { scene } = await game.loadScene(defineScene({}));

    const entity = scene.spawn();
    entity.add(Transform, { x: 1, y: 2 });
    entity.add(Meta, { name: "Hero" });

    const names = componentRegistry
      .registeredComponents(scene.world)
      .map((def) => def.componentName);
    expect(names).toEqual(["Transform", "Meta"]);

    await game.unloadScene();
  });

  it("scopes registration per-world — an unrelated Scene's components are invisible", async () => {
    const gameA = new Game();
    const { scene: sceneA } = await gameA.loadScene(defineScene({}));
    sceneA.spawn().add(Transform, { x: 1, y: 1 });

    const gameB = new Game();
    const { scene: sceneB } = await gameB.loadScene(defineScene({}));

    expect(componentRegistry.registeredComponents(sceneB.world)).toEqual([]);

    await gameA.unloadScene();
    await gameB.unloadScene();
  });
});
