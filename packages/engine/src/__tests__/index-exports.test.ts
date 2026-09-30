import { describe, expect, it } from "vitest";
import * as ECS from "../index.js";

/**
 * `@emptysock/engine`'s export surface is what `apps/ide` bundles as
 * `window.EmptySockEngine` and types Monaco against — a name missing here is
 * a name real game code (and the CodeEditor.tsx insert-snippet feature)
 * simply cannot use. `Actor`/`ActorSystem`/`CameraSystem`/`TweenManager` were
 * real, shared, environment-agnostic implementations that happened to never
 * be re-exported from this subpath before.
 */
describe("@emptysock/engine export surface", () => {
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

  it("exports SequenceSystem/evaluateTrackAt and ParticleEmitter", () => {
    expect(typeof ECS.SequenceSystem).toBe("function");
    expect(new ECS.SequenceSystem()).toBeInstanceOf(ECS.SequenceSystem);
    expect(typeof ECS.evaluateTrackAt).toBe("function");
    expect(typeof ECS.ParticleEmitter).toBe("function");
    expect(new ECS.ParticleEmitter({})).toBeInstanceOf(ECS.ParticleEmitter);
  });

  it("exports createCustomShaderFilter", () => {
    expect(typeof ECS.createCustomShaderFilter).toBe("function");
  });

  it("exports all five Game-service classes as real, constructible classes", () => {
    expect(typeof ECS.PluginSystem).toBe("function");
    expect(new ECS.PluginSystem()).toBeInstanceOf(ECS.PluginSystem);
    expect(typeof ECS.VariableStore).toBe("function");
    expect(new ECS.VariableStore()).toBeInstanceOf(ECS.VariableStore);
    expect(typeof ECS.evaluateCondition).toBe("function");
    expect(typeof ECS.LocalisationSystem).toBe("function");
    expect(new ECS.LocalisationSystem()).toBeInstanceOf(ECS.LocalisationSystem);
    expect(typeof ECS.ViewportSystem).toBe("function");
    expect(new ECS.ViewportSystem()).toBeInstanceOf(ECS.ViewportSystem);
    expect(typeof ECS.WindowSystem).toBe("function");
    expect(new ECS.WindowSystem()).toBeInstanceOf(ECS.WindowSystem);
  });

  it("the exported service classes are the exact same classes Game registers, not parallel copies", () => {
    const game = new ECS.Game();
    expect(game.services.get(ECS.PluginSystem)).toBeInstanceOf(
      ECS.PluginSystem,
    );
    expect(game.services.get(ECS.VariableStore)).toBeInstanceOf(
      ECS.VariableStore,
    );
    expect(game.services.get(ECS.LocalisationSystem)).toBeInstanceOf(
      ECS.LocalisationSystem,
    );
    expect(game.services.get(ECS.ViewportSystem)).toBeInstanceOf(
      ECS.ViewportSystem,
    );
    expect(game.services.get(ECS.WindowSystem)).toBeInstanceOf(
      ECS.WindowSystem,
    );
  });

  it("exports compat/gml.ts's pure GML scripting functions, not just the DnD action library", () => {
    // Previously only compat/gmlActions.ts's entity-affecting DnD actions
    // were re-exported here; compat/gml.ts's ~50 pure/global functions
    // (ds_map_*, string_*, draw_*, show_message, ...) had no way to be
    // imported from this package's one export surface at all, and
    // gms2-codegen.ts's scriptStub() template even pointed developers at a
    // nonexistent `@emptysock/engine/compat` subpath.
    expect(typeof ECS.ds_map_create).toBe("function");
    expect(typeof ECS.string_upper).toBe("function");
    expect(typeof ECS.draw_rectangle).toBe("function");
    expect(typeof ECS.show_message).toBe("function");
    expect(typeof ECS.lerp).toBe("function");
    expect(ECS.lerp(0, 10, 0.5)).toBe(5);
  });

  it("exports the scene-transfer cross-reference check", () => {
    expect(typeof ECS.findCrossReferences).toBe("function");
  });
});
