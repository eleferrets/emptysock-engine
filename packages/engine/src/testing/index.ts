/**
 * `@emptysock/engine/testing` — ENGINE_DESIGN.md §15.1's headless testing
 * harness. `spawn`/`each`/physics/actor messaging behave identically to a
 * real running game; only the render step is swapped for a no-op, so tests
 * never need a canvas, a WebGL context, or jsdom to exercise game logic.
 *
 * ```ts
 * import { createHeadlessGame } from "@emptysock/engine/testing";
 * import { defineScene, defineComponent } from "@emptysock/engine";
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
  type LoadOverlayOptions,
  type LoadSceneOptions,
  type SceneDefinition,
} from "../Game.js";
import { Scene } from "../Scene.js";

export { Scene } from "../Scene.js";
export { Entity } from "../Entity.js";
export { defineComponent } from "../Component.js";
export type { ComponentDef } from "../Component.js";
export { defineScene } from "../Game.js";
export type { SceneDefinition, SceneLifecycle, UpdateFn } from "../Game.js";
export { ServiceRegistry } from "../Services.js";
export type { ServiceConstructor } from "../Services.js";
export { SaveSystem } from "../systems/SaveSystem.js";
export type { MigrateFn, SaveSystemOptions } from "../systems/SaveSystem.js";
export { MemoryStorageAdapter } from "../systems/StorageAdapter.js";
export type { StorageAdapter } from "../systems/StorageAdapter.js";

/**
 * A `Game` whose `loadScene`/`loadOverlay` always run headless — the
 * physics/actor lifecycle the real engine creates and tears down
 * (ENGINE_DESIGN.md §4) still runs exactly as it would in a real game; only
 * the render step is forced to a no-op via `headless: true`, satisfying
 * §15.1's "render system swapped for a no-op" regardless of whether a real
 * renderer happens to be attached (`Game.attachRenderer` — see
 * `ecs/systems/RenderPipeline.ts`). Tests that exercise overlay scenes
 * (§12.3) get the same guarantee `loadScene` already gave: no Pixi
 * construction, no canvas, ever, from either call.
 */
export class HeadlessGame extends Game {
  override loadScene(
    definition: SceneDefinition,
    options: LoadSceneOptions = {},
  ): ReturnType<Game["loadScene"]> {
    return super.loadScene(definition, { ...options, headless: true });
  }

  override loadOverlay(
    definition: SceneDefinition,
    options: LoadOverlayOptions = {},
  ): ReturnType<Game["loadOverlay"]> {
    return super.loadOverlay(definition, { ...options, headless: true });
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
