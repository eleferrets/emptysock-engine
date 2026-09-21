/**
 * `@emptysock/engine/testing` — ENGINE_DESIGN.md §15.1's headless testing
 * harness. `spawn`/`each`/physics/actor messaging behave identically to a
 * real running game; only the render step is swapped for a no-op, so tests
 * never need a canvas, a WebGL context, or jsdom to exercise game logic.
 *
 * ```ts
 * import { createHeadlessGame } from "@emptysock/engine/testing";
 * import { defineScene, defineComponent } from "@emptysock/engine/v2";
 *
 * const Position = defineComponent("Position", () => ({ x: 0, y: 0 }));
 * const game = createHeadlessGame();
 * const { scene } = await game.loadScene(defineScene({
 *   onLoad(scene) {
 *     scene.spawn().add(Position, { x: 5 });
 *   },
 * }));
 * game.update(1 / 60);
 * ```
 */
import {
  Game,
  type LoadSceneOptions,
  type SceneDefinition,
} from "../v2/Game.js";
import { Scene } from "../v2/Scene.js";

export { Scene } from "../v2/Scene.js";
export { Entity } from "../v2/Entity.js";
export { defineComponent } from "../v2/Component.js";
export type { ComponentDef } from "../v2/Component.js";
export { defineScene } from "../v2/Game.js";
export type { SceneDefinition, SceneLifecycle, UpdateFn } from "../v2/Game.js";

/**
 * A `Game` whose `loadScene` always runs headless — the physics/actor
 * lifecycle the real engine creates and tears down (ENGINE_DESIGN.md §4)
 * still runs exactly as it would in a real game; only the render step
 * (which Track 1 wires up) is forced to a no-op via `headless: true`,
 * satisfying §15.1's "render system swapped for a no-op" even before a
 * real render system is plumbed into `Game` at all.
 */
export class HeadlessGame extends Game {
  override loadScene(
    definition: SceneDefinition,
    options: LoadSceneOptions = {},
  ): ReturnType<Game["loadScene"]> {
    return super.loadScene(definition, { ...options, headless: true });
  }
}

/** Convenience factory — `new HeadlessGame()` works too. */
export function createHeadlessGame(): HeadlessGame {
  return new HeadlessGame();
}

/**
 * A bare headless `Scene` with no `Game`/lifecycle wrapper at all, for tests
 * that only care about ECS behavior (`spawn`/`get`/`add`/`each`) and don't
 * need `ActorSystem`/`PhysicsSystem` in the loop.
 */
export function createHeadlessScene(): Scene {
  return new Scene();
}
