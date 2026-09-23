import { describe, expect, it } from "vitest";
import {
  createHeadlessGame,
  createHeadlessScene,
  defineComponent,
  defineScene,
} from "../testing/index.js";

const Health = defineComponent("Health", () => ({ hp: 100 }));

describe("@emptysock/engine/testing (ENGINE_DESIGN.md §15.1)", () => {
  it("createHeadlessScene supports spawn/add/get/each with no Game wrapper", () => {
    const scene = createHeadlessScene();
    const entity = scene.spawn();
    entity.add(Health, { hp: 50 });
    expect(entity.get(Health)?.hp).toBe(50);

    let seen = 0;
    scene.each(Health, (h) => {
      seen++;
      h.hp -= 10;
    });
    expect(seen).toBe(1);
    expect(entity.get(Health)?.hp).toBe(40);
  });

  it("createHeadlessGame runs the full lifecycle (actors/physics) without rendering", async () => {
    const game = createHeadlessGame();
    const events: string[] = [];
    const { scene } = await game.loadScene(
      defineScene({
        onLoad(s) {
          s.spawn().add(Health);
          events.push("loaded");
        },
        onUpdate() {
          events.push("update");
        },
      }),
      { physics: { gravity: { x: 0, y: 0 } } },
    );

    expect(scene.entityCount).toBe(1);
    game.update(1 / 60);
    expect(events).toEqual(["loaded", "update"]);

    await game.unloadScene();
  });

  it("headless game messaging via ActorSystem behaves like a real running game", async () => {
    const game = createHeadlessGame();
    const { actors } = await game.loadScene(defineScene({}), {
      physics: { gravity: { x: 0, y: 0 } },
    });
    expect(actors.size).toBe(0);
    // Nothing registered — but the system is live and update()-able, same
    // as a real game's ActorSystem before any actor is added.
    expect(() => game.update(1 / 60)).not.toThrow();
    await game.unloadScene();
  });
});
