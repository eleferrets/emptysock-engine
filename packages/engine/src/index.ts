/**
 * `@emptysock/engine` — the bitECS-backed ECS core (see the engine design notes and
 * CLAUDE.md). This is the engine's one and only game-authoring surface:
 * `apps/ide` bundles it as `window.EmptySockEngine` for the preview iframe
 * and types Monaco's Code editor against it, and it's the surface every
 * project template and the live Inspector bridge (`bridge/QueryChannel.ts`)
 * target. There is exactly one export surface — no subpath split, and no
 * second, parallel object model anywhere in this package.
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
export { NO_REF, isEntityRef } from "./EntityRef.js";
export type { EntityRef, EntityId } from "./EntityRef.js";
export { defineRelation, ChildOf } from "./Relations.js";
export {
  remapRefs,
  remapValue,
  entityRefLeaf,
  entityRefFields,
} from "./RefRemap.js";
export type { EntityIdMap, RemapOptions, RemapLeaf } from "./RefRemap.js";
export { RoomStateCache } from "./RoomStateCache.js";
export {
  captureEntities,
  restoreEntities,
  findCrossReferences,
  persistentTransferPolicy,
} from "./SceneTransfer.js";
export type {
  EntityExtra,
  TransferContext,
  TransferPolicy,
  EntitySnapshot,
  SceneSnapshot,
} from "./SceneTransfer.js";
export type {
  RelationDef,
  DefineRelationOptions,
  TargetDestroyedPolicy,
} from "./Relations.js";
export { Scene } from "./Scene.js";
export type { SpawnOptions } from "./Scene.js";
export { definePrefab, flattenPrefab, prefabComponentDefs } from "./Prefab.js";
export type { PrefabDef, PrefabComponentEntry } from "./Prefab.js";
export {
  parsePrefabFile,
  parsePrefabFiles,
  migratePrefabFile,
  loadSceneFile,
  stampPrefabNameOntoMeta,
} from "./SceneFile.js";
export type {
  PrefabFile,
  PrefabFileComponentEntry,
  PrefabFileV1,
  PrefabFileV1ComponentEntry,
  ComponentLookup,
  LoadSceneFileOptions,
} from "./SceneFile.js";
export { SCENE_FORMAT_VERSION } from "./SceneDocument.js";
export type {
  SceneDocument,
  SceneEntity,
  SceneEntityId,
  SceneComponentEntry,
  ScenePrefabRef,
  SceneLayerDef,
  SceneViewDef,
  SceneRoom,
  SceneRect,
  ScenePoint,
  EntityRefJson,
} from "./SceneDocument.js";
export {
  migrateScene,
  migrateSceneV1ToV2,
  parseSceneDocument,
} from "./SceneMigrations.js";
export type {
  SceneFileV1,
  SceneFileV1Entity,
  SceneFileV1PrefabInstance,
  SceneFileV1View,
  SceneFileV1ComponentEntry,
} from "./SceneMigrations.js";
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
// ActorSystem (§ CLAUDE.md "ActorSystem mailbox ordering") — `Game.loadScene()`/
// `loadOverlay()` construct one per scene and hand it to game code as
// `SceneLifecycle.actors`. `Actor`/`Message`/`ActorId` are exported here so
// game code can define its own `Actor` subclasses.
export { Actor } from "./Actor.js";
export type { Message, ActorId } from "./Actor.js";
export { ActorSystem } from "./ActorSystem.js";
export { CameraSystem } from "./systems/CameraSystem.js";
export type { CameraState, CameraBounds } from "./systems/CameraSystem.js";
export { TweenManager } from "./systems/TweenSystem.js";
export type {
  TweenOptions,
  TweenHandle,
  EasingName,
} from "./systems/TweenSystem.js";
export { SequenceSystem, evaluateTrackAt } from "./systems/SequenceSystem.js";
export type {
  SequenceDefinition,
  SequenceTrackDef,
} from "./systems/SequenceSystem.js";
export { SpriteAnimationSystem } from "./systems/SpriteAnimationSystem.js";
export {
  SpriteFlashSystem,
  FlashFilterPool,
} from "./systems/SpriteFlashSystem.js";
export { SpriteFlash, startSpriteFlash } from "./components/SpriteFlash.js";
export type { SpriteFlashOptions } from "./components/SpriteFlash.js";
export {
  ParticleEmitter,
  ParticleSystem,
  rainParticlePreset,
} from "./systems/ParticleSystem.js";
export type { RainPresetOptions } from "./systems/ParticleSystem.js";
export type {
  ParticleEmitterOptions,
  EmitterShape,
  ParticleBlendMode,
} from "./systems/ParticleSystem.js";
export {
  registerShader,
  unregisterShader,
  hasShader,
  getShader,
  shaderIds,
  clearShaders,
  setShaderUniform,
  getShaderUniforms,
  parseShaderUniforms,
  toFilterVertexSource,
  toFilterWgslVertexSource,
} from "./systems/ShaderRegistry.js";
export type {
  ShaderSource,
  ShaderUniformValue,
  ParsedShaderUniform,
} from "./systems/ShaderRegistry.js";
export { createCustomShaderFilter } from "./systems/CustomShaderFilter.js";
export type { CustomShaderFilter } from "./systems/CustomShaderFilter.js";
export {
  createRainGlassFilter,
  RainGlassFilter,
} from "./systems/RainGlassFilter.js";
export type { RainGlassFilterOptions } from "./systems/RainGlassFilter.js";
export { RainGlassSim } from "./systems/RainGlassSim.js";
export type {
  RainGlassSimOptions,
  WiperOptions,
} from "./systems/RainGlassSim.js";
export {
  RAIN_TIERS,
  resolveRainTier,
  resolveRainQuality,
} from "./systems/RainGlassTiers.js";
export type {
  RainQuality,
  RainTier,
  RainTierName,
} from "./systems/RainGlassTiers.js";
export { rasterizeRainDropMap } from "./systems/RainGlassMap.js";
// `Game`'s five constructor-registered services (CLAUDE.md's "PluginSystem,
// VariableStore, LocalisationSystem, ViewportSystem, and WindowSystem are
// Game services" entry) — game code needs the class itself as a type-safe
// key for `game.services.get(VariableStore)`/`ctx.plugins` etc.
export { PluginSystem } from "./PluginSystem.js";
export type { Plugin, PluginContext } from "./PluginSystem.js";
export { VariableStore, evaluateCondition } from "./systems/VariableStore.js";
export { GlobalStore } from "./systems/GlobalStore.js";
export { SignalBus, SignalGroup } from "./systems/SignalBus.js";
export type {
  GameSignals,
  SignalListener,
  Unsubscribe,
} from "./systems/SignalBus.js";
export type { GameGlobals, GlobalDeclaration } from "./systems/GlobalStore.js";
export { AssetRegistry } from "./systems/AssetRegistry.js";
export { FontRegistry } from "./systems/FontRegistry.js";
export type { FontDescriptor } from "./systems/FontRegistry.js";
export {
  bitmapKerning,
  layoutBitmapText,
  toPixiBitmapFontData,
} from "./systems/BitmapFontDef.js";
export type {
  BitmapFontDef,
  BitmapGlyph,
  BitmapGlyphPlacement,
  BitmapTextLayout,
  PixiBitmapFontDataLike,
} from "./systems/BitmapFontDef.js";
export type {
  VariableStoreData,
  VariableCondition,
} from "./systems/VariableStore.js";
export { LocalisationSystem } from "./systems/LocalisationSystem.js";
export type { Locale, TranslationMap } from "./systems/LocalisationSystem.js";
export {
  ViewportSystem,
  computeViewportSize,
  gpuTierRenderDefaults,
} from "./systems/ViewportSystem.js";
export type {
  ScaleMode,
  ResizableRenderTarget,
  ViewportConfig,
  ViewportSize,
  SafeAreaInsets,
} from "./systems/ViewportSystem.js";
export { WindowSystem } from "./systems/WindowSystem.js";
export type { WindowMode, WindowConfig } from "./systems/WindowSystem.js";
// Pure, dependency-free utilities — `AStarSearch` has no imports at all, and
// `Vec2` is a plain `{x, y}` shape re-exported from `Entity.ts`.
export { AStarSearch } from "./AStarSearch.js";
export type { AStarSearchOptions, AStarSearchResult } from "./AStarSearch.js";
export type { Vec2 } from "./Entity.js";
export type {
  UpdateFn,
  SceneDefinition,
  SceneLifecycle,
  LoadSceneOptions,
  LoadOverlayOptions,
  SceneRenderer,
} from "./Game.js";
export { Diagnostics } from "./Diagnostics.js";
export {
  KeyboardLayout,
  defaultKeyLabel,
  isLetterChar,
} from "./systems/KeyboardLayout.js";
export type { KeyboardLayoutProvider } from "./systems/KeyboardLayout.js";
export { InputManager, INPUT_BINDINGS_STORAGE_KEY } from "./Input.js";
export type {
  Binding,
  ActionMap,
  KeyboardSnapshot,
  GamepadSnapshot,
  CaptureKind,
  CaptureOptions,
  CaptureResult,
} from "./Input.js";
export {
  PointerSystem,
  MIN_TOUCH_TARGET_SIZE,
} from "./systems/PointerSystem.js";
export type {
  GestureType,
  SwipeDirection,
  PointerDownHandler,
  PointerMoveHandler,
  PointerUpHandler,
  GestureHandler,
  WheelHandler,
  PointerState,
  Gesture,
  TapGesture,
  LongPressGesture,
  SwipeGesture,
  PinchGesture,
  WheelEventInfo,
} from "./systems/PointerSystem.js";
export type { Serializable, SerializableRecord } from "./Serializable.js";
export { Transform } from "./components/Transform.js";
export { LightSource } from "./components/LightSource.js";
export { LightOccluder } from "./components/LightOccluder.js";
export {
  LightingSystem,
  type AmbientLight,
  type LightSample,
  type LightingSystemOptions,
} from "./systems/LightingSystem.js";
export {
  computeVisibilityPolygon,
  pointInPolygon,
  boxOccluderSegments,
  boxWithinReach,
  type Point,
  type Segment,
} from "./systems/LightOcclusion.js";
export { Meta } from "./components/Meta.js";
export { LayerElement } from "./components/LayerElement.js";
export type { MetaShape } from "./components/Meta.js";
export { Sprite, resolveSpriteFramePath } from "./components/Sprite.js";
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
export { withImageRegion } from "./ui/canvasHelpers.js";
export { resolveAnchoredPosition } from "./ui/Anchor.js";
export type { WidgetAnchor, AnchoredPosition } from "./ui/Anchor.js";
export { RenderPipeline } from "./systems/RenderPipeline.js";
export { TextureStore } from "./systems/TextureStore.js";
export { LayerSystem, LAYER } from "./systems/LayerSystem.js";
export type { LayerConfig, LayerSortKey } from "./systems/LayerSystem.js";
export type {
  RenderPipelineOptions,
  TextureLoader,
  TileLayerSource,
  AutoTileResolver,
} from "./systems/RenderPipeline.js";
export { RenderSystem } from "./systems/RenderSystem.js";
export type {
  CameraViewport,
  RenderSystemOptions,
} from "./systems/RenderSystem.js";
export { InputSystem } from "./systems/InputSystem.js";
export type { KeyState } from "./systems/InputSystem.js";
export { GamepadSystem } from "./systems/GamepadSystem.js";
export type {
  GamepadState,
  DualRumbleOptions,
} from "./systems/GamepadSystem.js";
export { AudioSystem } from "./systems/AudioSystem.js";
export type { SoundOptions } from "./systems/AudioSystem.js";
export {
  PostProcessSystem,
  COLOURBLIND_MATRICES,
  colourblindFilterId,
  colourblindFilterDefsSVG,
} from "./systems/PostProcessSystem.js";
export type {
  LayerFilterType,
  LayerFilterOptions,
  LayerFilter,
  ColourblindMode,
  PostEffectType,
  PostEffectOptions,
  ActiveEffect,
  BloomOptions,
  VignetteOptions,
  BlurOptions,
  PixelateOptions,
  ColourGradeOptions,
  ChromaticAberrationOptions,
  ShockwaveOptions,
  OutlineOptions,
  ScanlinesOptions,
  NoiseOptions,
  FlashOptions,
  FadeOptions,
} from "./systems/PostProcessSystem.js";
export { CoroutineSystem } from "./systems/CoroutineSystem.js";
export {
  accessibilitySettings,
  AccessibilitySettings,
} from "./ui/AccessibilitySettings.js";
export { ServiceRegistry } from "./Services.js";
export type { ServiceConstructor } from "./Services.js";
export {
  SaveSystem,
  SaveFormatError,
  SAVE_FORMAT_VERSION,
} from "./systems/SaveSystem.js";
export type {
  MigrateFn,
  SaveSystemOptions,
  CarriedSlot,
  LoadOptions,
  SaveMeta,
  SaveHeader,
} from "./systems/SaveSystem.js";
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
  VisualScriptGraphBuilder,
} from "./components/VisualScript.js";
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
} from "./components/VisualScript.js";
export {
  VisualScriptSystem,
  compileVisualScriptGraph,
} from "./systems/VisualScriptSystem.js";
export type { VSCompiledContext } from "./systems/VisualScriptSystem.js";
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
  CreateEntityQuery,
  ActorSendMessageQuery,
  ActorBroadcastQuery,
  ActorInboxSizeQuery,
  ActorListQuery,
  NavMeshFindPathQuery,
  NavMeshNearestNodeQuery,
  CreateEntityData,
  ActorSendResultData,
  ActorBroadcastResultData,
  NavMeshQuerySource,
  QueryChannelAttachOptions,
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
 * in that editing-time context, so some static list is unavoidable. It
 * deliberately does not try to be exhaustive (widget/UI components,
 * `Meta`, and anything a game defines itself via `defineComponent` are real
 * components that just aren't offered from this generic picker) — extend it
 * as new built-in components earn a place in that dropdown.
 */
export const COMPONENT_REGISTRY: readonly string[] = [
  "Transform",
  "Sprite",
  "PhysicsBody",
  "Meta",
] as const;

export { Projection3D } from "./components/Projection3D.js";
