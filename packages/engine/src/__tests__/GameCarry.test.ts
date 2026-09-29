import { describe, expect, it } from "vitest";
import { createHeadlessGame } from "../testing/index.js";
import { defineScene } from "../Game.js";
import { defineComponent } from "../Component.js";
import { Meta } from "../components/Meta.js";
import { persistentTransferPolicy } from "../SceneTransfer.js";
import { SceneTransitionManager } from "../systems/SceneTransition.js";

const Score = defineComponent("CarryScore", () => ({ n: 0 }));

const first = defineScene({
  onLoad(scene) {
    const keep = scene.spawn();
    keep.add(Meta, { persistent: true });
    keep.add(Score, { n: 7 });
    const drop = scene.spawn();
    drop.add(Meta, { persistent: false });
    drop.add(Score, { n: 1 });
  },
});

function second(order: string[]) {
  return defineScene({
    onLoad(scene, ctx) {
      order.push("onLoad");
      const map = ctx.restoreCarried();
      order.push(`restored:${map === undefined ? "none" : "map"}`);
      scene.spawn().add(Score, { n: 100 });
    },
  });
}

function scores(game: ReturnType<typeof createHeadlessGame>): number[] {
  const out: number[] = [];
  game.currentScene?.each(Score, (s) => {
    out.push(s.n);
  });
  return out.sort((a, b) => a - b);
}

describe("Game.loadScene({ carry })", () => {
  it("carries selected entities and restoreCarried respawns them before the scene's own", async () => {
    const game = createHeadlessGame();
    await game.loadScene(first);
    const order: string[] = [];
    await game.loadScene(second(order), { carry: persistentTransferPolicy });
    expect(order).toEqual(["onLoad", "restored:map"]);
    expect(scores(game)).toEqual([7, 100]);
  });

  it("carries nothing without the option, and restoreCarried is then a no-op", async () => {
    const game = createHeadlessGame();
    await game.loadScene(first);
    const order: string[] = [];
    await game.loadScene(second(order));
    expect(order).toEqual(["onLoad", "restored:none"]);
    expect(scores(game)).toEqual([100]);
    await game.loadScene(second([]), { carry: false });
    expect(scores(game)).toEqual([100]);
  });

  it("restoreCarried is single-shot and a stale carry does not leak to a later load", async () => {
    const game = createHeadlessGame();
    await game.loadScene(first);
    // Carried, but the middle scene never restores it.
    await game.loadScene(defineScene({}), { carry: persistentTransferPolicy });
    const order: string[] = [];
    await game.loadScene(second(order));
    expect(order).toEqual(["onLoad", "restored:none"]);
    expect(scores(game)).toEqual([100]);
  });

  it("runs after the outgoing onUnload, which can still change what is carried", async () => {
    const game = createHeadlessGame();
    await game.loadScene(
      defineScene({
        onLoad(scene) {
          scene.spawn().add(Score, { n: 3 });
        },
        onUnload(scene) {
          scene.each(Score, (s, e) => {
            e.add(Meta, { persistent: true });
            s.n = 4;
          });
        },
      }),
    );
    await game.loadScene(second([]), { carry: persistentTransferPolicy });
    expect(scores(game)).toEqual([4, 100]);
  });

  it("carries across a timed transition whose load callback calls loadScene", async () => {
    const game = createHeadlessGame();
    await game.loadScene(first);
    const manager = new SceneTransitionManager();
    let pending: Promise<unknown> = Promise.resolve();
    manager.transition(
      () => {
        pending = game.loadScene(second([]), {
          carry: persistentTransferPolicy,
        });
      },
      { duration: 0.1 },
    );
    manager.update(0.05);
    expect(scores(game)).toEqual([1, 7]);
    manager.update(0.1);
    await pending;
    expect(scores(game)).toEqual([7, 100]);
  });
});
