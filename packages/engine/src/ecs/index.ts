/**
 * `@emptysock/engine/ecs` — the bitECS-backed ECS core (see ENGINE_DESIGN.md
 * and `CLAUDE.md`). This is the engine's one live game-authoring surface:
 * `apps/ide` bundles it as `window.EmptySockEngine` for the preview iframe
 * and types Monaco's Code editor against it, and it's the surface every
 * project template and the live Inspector bridge (`ecs/bridge/QueryChannel.ts`)
 * target. It lives at a separate subpath export, not re-exported from the
 * package root, because the classic engine (`Scene`/`Entity`/`Component`/
 * `ActorSystem`/`PhysicsSystem` from `../index.js`) still exists on disk and
 * exports colliding names for different things — merging both into one
 * export surface isn't a safe mechanical change. The root export surface is
 * not bundled or typed anywhere in `apps/ide` any more; it remains only
 * until the classic `core/`/`systems/` source trees themselves are deleted.
 */
export { defineComponent } from "./Component.js";
export type {
  ComponentDef,
  ComponentSchema,
  ComponentFieldSchema,
  DefineComponentOptions,
} from "./Component.js";
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
export {
  startCoroutine,
  stopCoroutine,
  updateCoroutines,
  clearCoroutines,
  waitFrames,
  waitSeconds,
  waitUntil,
} from "./Coroutines.js";
export type {
  CoroutineHandle,
  CoroutineFactory,
  CoroutineGen,
  CoroutineYield,
} from "./Coroutines.js";
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
export type {
  PointerState,
  Gesture,
  TapGesture,
  LongPressGesture,
  SwipeGesture,
  PinchGesture,
  WheelEventInfo,
} from "../systems/PointerSystem.js";
export type { Serializable, SerializableRecord } from "./Serializable.js";
export { Transform } from "./components/Transform.js";
export { Meta } from "./components/Meta.js";
export type { MetaShape } from "./components/Meta.js";
export { Sprite } from "./components/Sprite.js";
export { Layout, LayoutStyle } from "./components/Layout.js";
export {
  WidgetAppearance,
  Label,
  PanelStyle,
  ButtonState,
  Checkbox,
  Slider,
  Progress,
  ImageWidget,
} from "./components/Widgets.js";
export {
  WidgetParent,
  WidgetTree,
  detachWidgetParent,
} from "./ui/WidgetTree.js";
export { UISystem } from "./ui/UISystem.js";
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
export { CGGallery } from "./systems/CGGallery.js";
export type { CGEntry, CGGalleryOptions } from "./systems/CGGallery.js";
export { SceneTransitionManager } from "./systems/SceneTransition.js";
export type {
  TransitionEffect,
  TransitionOptions,
  TransitionEffectSink,
} from "./systems/SceneTransition.js";
export { DebugOverlaySystem } from "./systems/DebugOverlaySystem.js";
export type {
  LogLevel,
  DebugLogEntry,
  DebugCommandHandler,
} from "./systems/DebugOverlaySystem.js";
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
