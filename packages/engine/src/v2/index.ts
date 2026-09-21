/**
 * `@emptysock/engine/v2` — ENGINE_DESIGN.md's redesigned core (Track 0 of
 * `RELEASE_PASS.md`'s implementation plan). Lives at a separate subpath
 * export, not re-exported from the package root, so the v1 engine
 * (`Scene`/`Entity`/`Component`/`ActorSystem`/`PhysicsSystem` from
 * `../index.js`) keeps working unmodified for every system that hasn't
 * migrated yet (Track 1/2 in `RELEASE_PASS.md`) while this becomes real.
 * Track 1 imports from here as it migrates physics/rendering/input/etc.
 * onto the new object model; once that migration finishes, this becomes
 * the package root and the v1 exports retire.
 */
export { defineComponent } from "./Component.js";
export type { ComponentDef } from "./Component.js";
export { componentRegistry } from "./ComponentRegistry.js";
export { Entity } from "./Entity.js";
export { Scene } from "./Scene.js";
export { Game, defineScene } from "./Game.js";
export type {
  UpdateFn,
  SceneDefinition,
  SceneLifecycle,
  LoadSceneOptions,
} from "./Game.js";
export type { Serializable, SerializableRecord } from "./Serializable.js";
