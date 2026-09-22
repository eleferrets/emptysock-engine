// Core ECS
export { Component, componentType } from "./core/Component.js";
export type { ComponentType } from "./core/Component.js";
export { Entity } from "./core/Entity.js";
export type { Vec2 } from "./core/Entity.js";
export type { CoroutineHandle, CoroutineFactory } from "./ecs/Coroutines.js";
export { Scene } from "./core/Scene.js";
export type { SystemFn } from "./core/Scene.js";

// Engine API
export { Engine } from "./core/EngineAPI.js";

// Actor Model
export { Actor } from "./core/Actor.js";
export type { Message, ActorId } from "./core/Actor.js";
export { ActorSystem } from "./core/ActorSystem.js";

// Plugin System
export { PluginSystem } from "./core/PluginSystem.js";
export type { Plugin, PluginContext } from "./core/PluginSystem.js";

// Systems
export { RenderSystem } from "./systems/RenderSystem.js";
export type { RenderSystemOptions } from "./systems/RenderSystem.js";
export { RenderPipeline } from "./systems/RenderPipeline.js";
export type {
  RenderPipelineOptions,
  TextureLoader,
  TileLayerSource,
} from "./systems/RenderPipeline.js";
export { PhysicsSystem } from "./systems/PhysicsSystem.js";
export type { PhysicsWorldOptions } from "./systems/PhysicsSystem.js";
export { PhysicsSystem3D } from "./systems/PhysicsSystem3D.js";
export type {
  PhysicsBody3DOptions,
  Physics3DHandle,
  Vec3,
  BodyType3D,
  Shape3D,
  Quat,
  RaycastHit,
  CollisionEvent,
} from "./systems/PhysicsSystem3D.js";
export { InputSystem } from "./systems/InputSystem.js";
export type {
  KeyState,
  MouseState,
  TouchPoint,
} from "./systems/InputSystem.js";
export { AudioSystem } from "./systems/AudioSystem.js";
export type { SoundOptions } from "./systems/AudioSystem.js";
export { AssetManifest } from "./systems/AssetManifest.js";
export type {
  AssetType,
  AssetDescriptor,
  AssetLoadFailure,
  AssetLoadResult,
  AssetProgressListener,
  AssetManifestOptions,
} from "./systems/AssetManifest.js";
export {
  InputBindings,
  createBindingsSaveSystem,
  BindingsSaveSlotSchema,
} from "./systems/InputBindings.js";
export type {
  Binding,
  BindingKind,
  ActionMap,
  KeyBinding,
  MouseButtonBinding,
  GamepadButtonBinding,
  GamepadAxisBinding,
  BindingsSaveSlot,
} from "./systems/InputBindings.js";
export { DebugOverlaySystem } from "./systems/DebugOverlaySystem.js";
export type {
  DebugLogEntry,
  DebugCommandHandler,
  LogLevel,
} from "./systems/DebugOverlaySystem.js";
export {
  accessibilitySettings,
  AccessibilitySettings,
} from "./ui/AccessibilitySettings.js";
export { CameraSystem } from "./systems/CameraSystem.js";
export type { CameraState, CameraBounds } from "./systems/CameraSystem.js";

// Components
export { Transform } from "./components/Transform.js";
export { Sprite } from "./components/Sprite.js";
export { PhysicsBody } from "./components/PhysicsBody.js";
export type { RigidBodyType, ColliderShape } from "./components/PhysicsBody.js";
export { CharacterController } from "./components/CharacterController.js";
export { Animator } from "./components/Animator.js";
export type { AnimationClip } from "./components/Animator.js";
export { AnimatorController } from "./components/AnimatorController.js";
export type {
  AnimParamValue,
  AnimTransitionContext,
  AnimTransitionOptions,
  ActiveClipFrame,
} from "./components/AnimatorController.js";
export {
  VisualScriptComponent,
  VisualScriptGraphBuilder,
} from "./components/VisualScriptComponent.js";
export type {
  VSNode,
  VSNodeKind,
  VSConnection,
  VisualScriptGraph,
  OnUpdateNode,
  OnEventNode,
  SequenceNode,
  BranchNode,
  GetVariableNode,
  SetVariableNode,
  GetSwitchNode,
  SetSwitchNode,
  SendMessageNode,
} from "./components/VisualScriptComponent.js";
export {
  compileVisualScriptGraph,
  CompiledVisualScriptComponent,
} from "./systems/VisualScriptCompiler.js";
export type { VSCompiledContext } from "./systems/VisualScriptCompiler.js";

// New Systems
export { LightingSystem, LightingFilter } from "./systems/LightingSystem.js";
export type { Light, LightType } from "./systems/LightingSystem.js";
export {
  CustomShaderFilter,
  createCustomShaderFilter,
  DEFAULT_CUSTOM_SHADER_VERTEX,
  DEFAULT_CUSTOM_SHADER_FRAGMENT,
} from "./systems/CustomShaderFilter.js";
export type { CustomShaderOptions } from "./systems/CustomShaderFilter.js";
export { SequenceSystem, evaluateTrackAt } from "./systems/SequenceSystem.js";
export type {
  SequenceDefinition,
  SequenceTrackDef,
  SequenceKeyframe,
} from "./systems/SequenceSystem.js";
export { AStarSearch } from "./core/AStarSearch.js";
export type {
  AStarEdge,
  AStarSearchOptions,
  AStarSearchResult,
} from "./core/AStarSearch.js";
export { PathfindingSystem } from "./systems/PathfindingSystem.js";
export type {
  GridCell,
  PathRequest,
  PathResult,
} from "./systems/PathfindingSystem.js";
export { SaveSystem } from "./systems/SaveSystem.js";
export type { SaveSlot, GameSaveSlot } from "./systems/SaveSystem.js";
export { LocalisationSystem } from "./systems/LocalisationSystem.js";
export type { Locale, TranslationMap } from "./systems/LocalisationSystem.js";
export {
  CoroutineSystem,
  waitFrames,
  waitSeconds,
  waitUntil,
} from "./systems/CoroutineSystem.js";
export type {
  CoroutineGen,
  CoroutineYield,
} from "./systems/CoroutineSystem.js";
export { GamepadSystem } from "./systems/GamepadSystem.js";
export type {
  GamepadState,
  DualRumbleOptions,
} from "./systems/GamepadSystem.js";

export { VariableStore, evaluateCondition } from "./systems/VariableStore.js";
export type {
  VariableStoreData,
  VariableCondition,
} from "./systems/VariableStore.js";

export {
  PointerSystem,
  MIN_TOUCH_TARGET_SIZE,
} from "./systems/PointerSystem.js";
export type {
  PointerState,
  GestureType,
  Gesture,
  TapGesture,
  LongPressGesture,
  SwipeGesture,
  SwipeDirection,
  PinchGesture,
  WheelEventInfo,
  PointerDownHandler,
  PointerMoveHandler,
  PointerUpHandler,
  GestureHandler,
  WheelHandler,
} from "./systems/PointerSystem.js";

// Core Manager
export { SystemManager } from "./core/SystemManager.js";
export type { UpdatableSystem } from "./core/SystemManager.js";

// SceneManager
export { SceneManagerInstance as SceneManager } from "./core/SceneManager.js";
export type {
  TransitionOptions as SceneTransitionOptions,
  SceneFactory,
} from "./core/SceneManager.js";

// Particles
export { ParticleSystem, ParticleEmitter } from "./systems/ParticleSystem.js";
export type {
  ParticleEmitterOptions,
  EmitterShape,
} from "./systems/ParticleSystem.js";

// Tweens & Timers
export { TweenManager } from "./systems/TweenSystem.js";
export type { TweenOptions, TweenHandle } from "./systems/TweenSystem.js";

// UI
export { UISystem } from "./systems/UISystem.js";
export type {
  IUIRenderer,
  HostAdapter,
  HostMessage,
  HostMessageHandler,
} from "@emptysock/types";
export { NullHostAdapter } from "@emptysock/types";

// Easing
export { ease } from "./core/easing.js";
export type { EasingName } from "./core/easing.js";

// Widget API
export {
  Widget,
  LabelWidget,
  ImageWidget,
  ButtonWidget,
  PanelWidget,
  ProgressBarWidget,
  SliderWidget,
  CheckboxWidget,
} from "./ui/Widget.js";
export type {
  WidgetAnchor,
  AnimationName,
  SlideDirection,
  WidgetEvent,
  AnimationOpts,
  LabelWidgetOpts,
  ImageWidgetOpts,
  ButtonWidgetOpts,
  ButtonState,
  PanelWidgetOpts,
  ProgressBarWidgetOpts,
  SliderWidgetOpts,
  CheckboxWidgetOpts,
} from "./ui/Widget.js";

// Post-processing
export { PostProcessSystem } from "./systems/PostProcessSystem.js";
export {
  COLOURBLIND_MATRICES,
  colourblindFilterId,
  colourblindFilterDefsSVG,
} from "./systems/PostProcessSystem.js";
export type { ColourblindMode } from "./systems/PostProcessSystem.js";
export type {
  PostEffectType,
  PostEffectOptions,
  ActiveEffect,
  FlashOptions,
  FadeOptions,
  LayerFilterType,
  LayerFilterOptions,
  LayerFilter,
} from "./systems/PostProcessSystem.js";

// RigidJoint
export { RigidJoint } from "./components/RigidJoint.js";
export type {
  JointType,
  RevoluteOptions,
  PrismaticOptions,
  SpringOptions,
} from "./components/RigidJoint.js";

// PhysicsBody callbacks
export type {
  ContactInfo,
  CollisionCallback,
  SensorCallback,
} from "./components/PhysicsBody.js";

// Layer System
export { LayerSystem, LAYER } from "./systems/LayerSystem.js";
export type { LayerConfig, LayerSortKey } from "./systems/LayerSystem.js";

// Hot reload
export { HotReloadSystem } from "./systems/HotReloadSystem.js";

// IDE Bridge
export { ideBridge } from "./core/IDEBridge.js";
export type {
  EntitySnapshot,
  ComponentPatchHandler,
  SelectHandler,
} from "./core/IDEBridge.js";

// GPU tier detection
export { detectGPUTier, classifyRenderer } from "./core/GPUTier.js";
export type { GPUTier } from "./core/GPUTier.js";

// Window management
export { windowSystem } from "./systems/WindowSystem.js";
export type { WindowConfig, WindowMode } from "./systems/WindowSystem.js";

// Viewport management (design-resolution scaling, resize, safe-area insets)
export {
  ViewportSystem,
  viewportSystem,
  computeViewportSize,
  gpuTierRenderDefaults,
} from "./systems/ViewportSystem.js";
export type {
  ScaleMode,
  ViewportConfig,
  ViewportSize,
  SafeAreaInsets,
  ResizableRenderTarget,
} from "./systems/ViewportSystem.js";

// Behaviors
export * from "./behaviors/index.js";

// CG gallery
export { CGGallery } from "./systems/CGGallery.js";
export type { CGEntry, CGGalleryOptions } from "./systems/CGGallery.js";

// Auto-tile rule system
export { AutoTileSystem } from "./systems/AutoTileSystem.js";
export type {
  AutoTileRule,
  AutoTileRuleSet,
} from "./systems/AutoTileSystem.js";

// VN stage & background layers
export { CharacterStage } from "./systems/CharacterStage.js";
export type {
  StageSlot,
  CharacterStageOptions,
  CharacterShowOptions,
} from "./systems/CharacterStage.js";
// Map event system
export { MapEventSystem } from "./systems/MapEventSystem.js";
export type {
  MapEvent,
  EventTriggerType,
  EventCommand,
  EventCommandHandler,
} from "./systems/MapEventSystem.js";

// Public type aliases
export type { GameStage } from "./types/aliases.js";

// IDE Bridge — internal; not part of the public game API

// Component registry — canonical list of built-in component type strings
export const COMPONENT_REGISTRY: readonly string[] = [
  "Transform",
  "Sprite",
  "PhysicsBody",
  "CharacterController",
  "Animator",
  "RigidJoint",
] as const;
