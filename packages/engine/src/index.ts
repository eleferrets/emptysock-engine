// Core ECS
export { Component } from "./core/Component.js";
export { Entity } from "./core/Entity.js";
export { Scene } from "./core/Scene.js";
export type { SystemFn } from "./core/Scene.js";
/** @internal */
export { detectGPUTier } from "./core/GPUTier.js";
/** @internal */
export type { GPUTier } from "./core/GPUTier.js";

// Engine API
export { Engine } from "./core/EngineAPI.js";

// Actor Model
export { Actor } from "./core/Actor.js";
export type { Message, ActorId } from "./core/Actor.js";
export { NetworkActor } from "./core/NetworkActor.js";
export type { Transport, TransportMessage } from "./core/Transport.js";
export { ActorSystem } from "./core/ActorSystem.js";

// Plugin System
export { PluginSystem, pluginSystem } from "./core/PluginSystem.js";
export type { Plugin, PluginContext } from "./core/PluginSystem.js";

// Systems
export { RenderSystem } from "./systems/RenderSystem.js";
export type { RenderSystemOptions } from "./systems/RenderSystem.js";
export { PhysicsSystem } from "./systems/PhysicsSystem.js";
export type { PhysicsWorldOptions } from "./systems/PhysicsSystem.js";
export { PhysicsSystem3D } from "./systems/PhysicsSystem3D.js";
export type {
  PhysicsBody3DOptions,
  Physics3DHandle,
  Vec3,
  Vec3 as NavVec3,
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
export { CameraSystem } from "./systems/CameraSystem.js";
export type { CameraState } from "./systems/CameraSystem.js";

// Components
export { Transform } from "./components/Transform.js";
export { Sprite } from "./components/Sprite.js";
export { PhysicsBody } from "./components/PhysicsBody.js";
export type { RigidBodyType, ColliderShape } from "./components/PhysicsBody.js";
export { CharacterController } from "./components/CharacterController.js";
export { Animator } from "./components/Animator.js";
export type { AnimationClip } from "./components/Animator.js";

// New Systems
export { VNSystem } from "./systems/VNSystem.js";
export type { DialogueNode, DialogueTree } from "./systems/VNSystem.js";

export {
  storyGraphToDialogueTree,
  dialogueTreeToStoryGraph,
} from "./systems/VNScriptConvert.js";
export type {
  StoryGraphNode,
  StoryGraphEdge,
  StoryGraph,
} from "./systems/VNScriptConvert.js";

export { VNTextbox } from "./systems/VNTextbox.js";
export type { VNTextboxOptions } from "./systems/VNTextbox.js";
export { LightingSystem, LightingFilter } from "./systems/LightingSystem.js";
export type { Light, LightType } from "./systems/LightingSystem.js";
export { PathfindingSystem } from "./systems/PathfindingSystem.js";
export type {
  GridCell,
  PathRequest,
  PathResult,
} from "./systems/PathfindingSystem.js";
export { NavMeshSystem } from "./systems/NavMeshSystem.js";
export type { NavMeshData, NavPolygon, Vec2 } from "./systems/NavMeshSystem.js";
export { SaveSystem } from "./systems/SaveSystem.js";
export type { SaveSlot } from "./systems/SaveSystem.js";
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

export { VariableStore, variableStore } from "./systems/VariableStore.js";
export type { VariableStoreData } from "./systems/VariableStore.js";

// Core Manager
export { SystemManager } from "./core/SystemManager.js";
export type { UpdatableSystem } from "./core/SystemManager.js";

// SceneManager
export { SceneManagerInstance as SceneManager } from "./core/SceneManager.js";
export type {
  TransitionEffect,
  TransitionOptions as SceneTransitionOptions,
  SceneFactory,
} from "./core/SceneManager.js";

// ObjectPool
export { ObjectPool } from "./core/ObjectPool.js";
export type { Poolable, PoolFactory } from "./core/ObjectPool.js";

// Tilemap
export { TilemapSystem, Tilemap } from "./systems/TilemapSystem.js";
export type {
  TilemapData,
  TilemapLayer,
  TileCell,
  TilesetConfig,
} from "./systems/TilemapSystem.js";

// Particles
export { ParticleSystem, ParticleEmitter } from "./systems/ParticleSystem.js";
export type {
  ParticleEmitterOptions,
  EmitterShape,
} from "./systems/ParticleSystem.js";

// Tweens & Timers
export { TweenManager } from "./systems/TweenSystem.js";
export type { TweenOptions, EasingName } from "./systems/TweenSystem.js";

// UI
export { UISystem, UIComponent } from "./systems/UISystem.js";
export type {
  UIComponentType,
  UIComponentOptions,
  UIStyle,
  UIAnchor,
  UIAnimationType,
} from "./systems/UISystem.js";

// Post-processing
export { PostProcessSystem } from "./systems/PostProcessSystem.js";
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

// Compat
/** @internal */
export { detectMali, getMaliFixes, applyMaliFixes } from "./compat/mali.js";
/** @internal */
export type { MaliInfo, MaliFixes } from "./compat/mali.js";
/** @internal */
export * as GMLCompat from "./compat/index.js";

// Hot reload
/** @internal */
export { HotReloadSystem } from "./systems/HotReloadSystem.js";

// Window management
export { windowSystem, WindowSystem } from "./systems/WindowSystem.js";
export type { WindowConfig, WindowMode } from "./systems/WindowSystem.js";

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
export { VNBackgroundLayer } from "./systems/VNBackgroundLayer.js";
export type { VNBackgroundLayerOptions } from "./systems/VNBackgroundLayer.js";

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
