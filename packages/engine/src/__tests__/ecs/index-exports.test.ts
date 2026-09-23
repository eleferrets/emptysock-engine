import { describe, expect, it } from "vitest";
import * as ECS from "../../ecs/index.js";

/**
 * `@emptysock/engine/ecs`'s export surface is what `apps/ide` bundles as
 * `window.EmptySockEngine` and types Monaco against — a name missing here is
 * a name real game code (and the CodeEditor.tsx insert-snippet feature)
 * simply cannot use. `Actor`/`ActorSystem`/`CameraSystem`/`TweenManager` were
 * real, shared, environment-agnostic implementations that happened to never
 * be re-exported from this subpath before.
 */
describe("@emptysock/engine/ecs export surface", () => {
  it("exports the shared Actor/ActorSystem implementation", () => {
    expect(typeof ECS.Actor).toBe("function");
    expect(typeof ECS.ActorSystem).toBe("function");
    expect(new ECS.ActorSystem()).toBeInstanceOf(ECS.ActorSystem);
  });

  it("exports the shared CameraSystem implementation", () => {
    expect(typeof ECS.CameraSystem).toBe("function");
    expect(new ECS.CameraSystem()).toBeInstanceOf(ECS.CameraSystem);
  });

  it("exports the shared TweenManager implementation", () => {
    expect(typeof ECS.TweenManager).toBe("function");
    const tweens = new ECS.TweenManager();
    expect(tweens).toBeInstanceOf(ECS.TweenManager);
    tweens.destroy();
  });
});
