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
export type { SpawnOptions } from "./Scene.js";
export { definePrefab, flattenPrefab, prefabComponentDefs } from "./Prefab.js";
export type { PrefabDef, PrefabComponentEntry } from "./Prefab.js";
export {
  parsePrefabFile,
  parsePrefabFiles,
  loadSceneFile,
} from "./SceneFile.js";
export type {
  PrefabFile,
  PrefabFileComponentEntry,
  SceneFile,
  SceneFileEntity,
  SceneFilePrefabInstance,
  ComponentLookup,
} from "./SceneFile.js";
export { Game, defineScene } from "./Game.js";
export type {
  UpdateFn,
  SceneDefinition,
  SceneLifecycle,
  LoadSceneOptions,
  LoadOverlayOptions,
  SceneRenderer,
} from "./Game.js";
export { InputManager } from "./Input.js";
export type {
  Binding,
  ActionMap,
  KeyboardSnapshot,
  GamepadSnapshot,
} from "./Input.js";
export type { Serializable, SerializableRecord } from "./Serializable.js";
export { Transform } from "./components/Transform.js";
export { Sprite } from "./components/Sprite.js";
export { RenderPipeline } from "./systems/RenderPipeline.js";
export type {
  RenderPipelineOptions,
  TextureLoader,
} from "./systems/RenderPipeline.js";
export { ServiceRegistry } from "./Services.js";
export type { ServiceConstructor } from "./Services.js";
export { SaveSystem } from "./systems/SaveSystem.js";
export type { MigrateFn, SaveSystemOptions } from "./systems/SaveSystem.js";
export { MemoryStorageAdapter } from "./systems/StorageAdapter.js";
export type { StorageAdapter } from "./systems/StorageAdapter.js";
export {
  PhysicsSystem,
  PhysicsNotInitializedError,
} from "./systems/PhysicsSystem.js";
export type {
  PhysicsSystemOptions,
  RaycastHit2D,
  BodyState2D,
} from "./systems/PhysicsSystem.js";
export { PhysicsSystem3D } from "./systems/PhysicsSystem3D.js";
export type {
  PhysicsSystem3DOptions,
  PhysicsBody3DOptions,
  Physics3DHandle,
  BodyType3D,
  Shape3D,
  Vec3,
  Quat,
  RaycastHit,
  CollisionEvent,
} from "./systems/PhysicsSystem3D.js";
export { PhysicsBody, getPhysicsBody } from "./components/PhysicsBody.js";
export { QueryChannel } from "./bridge/QueryChannel.js";
export type {
  EngineQuery,
  EngineQueryRequest,
  EngineQueryResponse,
  EngineQueryResult,
  EngineQueryError,
  EngineQueryErrorCode,
  EntitySummary,
  RaycastResultData,
  BodyStateData,
  ListEntitiesQuery,
  EntityInfoQuery,
  GetComponentQuery,
  Raycast2DQuery,
  OverlapCircle2DQuery,
  BodyState2DQuery,
} from "./bridge/QueryChannel.js";
export type {
  PhysicsBodyHandle,
  PhysicsBodyType,
  PhysicsBodyShape,
  ContactInfo,
  CollisionCallback,
  SensorCallback,
} from "./components/PhysicsBody.js";
