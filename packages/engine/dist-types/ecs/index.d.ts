/**
 * `@emptysock/engine/ecs` — the bitECS-backed ECS core (see ENGINE_DESIGN.md
 * and `CLAUDE.md`). This is the engine's one live game-authoring surface:
 * `apps/ide` bundles it as `window.EmptySockEngine` for the preview iframe
 * and types Monaco's Code editor against it, and it's the surface every
 * project template and the live Inspector bridge (`ecs/bridge/QueryChannel.ts`)
 * target. It lives at a separate subpath export, not re-exported from the
 * package root, because the classic engine (`Scene`/`Entity`/`Component`/
 * `PhysicsSystem` from `../index.js`) still exists on disk and exports
 * colliding names for different things — merging both into one export
 * surface isn't a safe mechanical change. (`ActorSystem`/`CameraSystem`/
 * `TweenManager` are genuinely shared, environment-agnostic implementations
 * re-exported here without collision — see their own imports below.) The
 * root export surface is
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
export { Actor } from "../core/Actor.js";
export type { Message, ActorId } from "../core/Actor.js";
export { ActorSystem } from "../core/ActorSystem.js";
export { CameraSystem } from "../systems/CameraSystem.js";
export type { CameraState, CameraBounds } from "../systems/CameraSystem.js";
export { TweenManager } from "../systems/TweenSystem.js";
export type {
  TweenOptions,
  TweenHandle,
  EasingName,
} from "../systems/TweenSystem.js";
export { SequenceSystem, evaluateTrackAt } from "../systems/SequenceSystem.js";
export type {
  SequenceDefinition,
  SequenceTrackDef,
} from "../systems/SequenceSystem.js";
export { ParticleEmitter } from "../systems/ParticleSystem.js";
export type {
  ParticleEmitterOptions,
  EmitterShape,
} from "../systems/ParticleSystem.js";
export { createCustomShaderFilter } from "../systems/CustomShaderFilter.js";
export type { CustomShaderFilter } from "../systems/CustomShaderFilter.js";
export { PluginSystem } from "../core/PluginSystem.js";
export type { Plugin, PluginContext } from "../core/PluginSystem.js";
export { VariableStore, evaluateCondition } from "../systems/VariableStore.js";
export type {
  VariableStoreData,
  VariableCondition,
} from "../systems/VariableStore.js";
export { LocalisationSystem } from "../systems/LocalisationSystem.js";
export type { Locale, TranslationMap } from "../systems/LocalisationSystem.js";
export {
  ViewportSystem,
  computeViewportSize,
  gpuTierRenderDefaults,
} from "../systems/ViewportSystem.js";
export type {
  ScaleMode,
  ResizableRenderTarget,
  ViewportConfig,
  ViewportSize,
  SafeAreaInsets,
} from "../systems/ViewportSystem.js";
export { WindowSystem } from "../systems/WindowSystem.js";
export type { WindowMode, WindowConfig } from "../systems/WindowSystem.js";
export { AStarSearch } from "../core/AStarSearch.js";
export type {
  AStarSearchOptions,
  AStarSearchResult,
} from "../core/AStarSearch.js";
export type { Vec2 } from "../core/Entity.js";
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
export { resolveAnchoredPosition } from "./ui/Anchor.js";
export type { WidgetAnchor, AnchoredPosition } from "./ui/Anchor.js";
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
export {
  VisualScriptState,
  registerVisualScriptGraph,
  getVisualScriptGraph,
  unregisterVisualScriptGraph,
} from "./components/VisualScript.js";
export { VisualScriptSystem } from "./systems/VisualScriptSystem.js";
export { VisualScriptGraphBuilder } from "../components/VisualScriptComponent.js";
export type {
  VisualScriptGraph,
  VSNode,
  VSNodeKind,
  VSConnection,
  OnUpdateNode,
  OnEventNode,
  SequenceNode,
  BranchNode,
  GetVariableNode,
  SetVariableNode,
  GetSwitchNode,
  SetSwitchNode,
  SendMessageNode,
} from "../components/VisualScriptComponent.js";
export { compileVisualScriptGraph } from "../systems/VisualScriptCompiler.js";
export type { VSCompiledContext } from "../systems/VisualScriptCompiler.js";
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
  SetComponentQuery,
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
/**
 * Curated list of built-in `componentName`s an editor's "Add Component"
 * picker can offer for an entity that isn't live yet — there is no running
 * `Scene`/`World` to ask `componentRegistry.registeredComponents()` about
 * in that editing-time context, so some static list is unavoidable. This is
 * the ECS counterpart to the classic root surface's `COMPONENT_REGISTRY`;
 * it deliberately does not try to be exhaustive (widget/UI components,
 * `Meta`, and anything a game defines itself via `defineComponent` are real
 * components that just aren't offered from this generic picker) — extend it
 * as new built-in components earn a place in that dropdown.
 */
export declare const COMPONENT_REGISTRY: readonly string[];
