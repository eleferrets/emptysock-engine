// Core ECS
export { Component } from './core/Component.js';
export { Entity } from './core/Entity.js';
export { Scene } from './core/Scene.js';
export type { SystemFn } from './core/Scene.js';
export { detectGPUTier } from './core/GPUTier.js';
export type { GPUTier } from './core/GPUTier.js';

// Systems
export { RenderSystem } from './systems/RenderSystem.js';
export type { RenderSystemOptions } from './systems/RenderSystem.js';
export { PhysicsSystem } from './systems/PhysicsSystem.js';
export type { PhysicsWorldOptions } from './systems/PhysicsSystem.js';
export { InputSystem } from './systems/InputSystem.js';
export type { KeyState, MouseState } from './systems/InputSystem.js';
export { AudioSystem } from './systems/AudioSystem.js';
export type { SoundOptions } from './systems/AudioSystem.js';
export { CameraSystem } from './systems/CameraSystem.js';
export type { CameraState } from './systems/CameraSystem.js';

// Components
export { Transform } from './components/Transform.js';
export { Sprite } from './components/Sprite.js';
export { PhysicsBody } from './components/PhysicsBody.js';
export type { RigidBodyType, ColliderShape } from './components/PhysicsBody.js';
export { CharacterController } from './components/CharacterController.js';
export { Animator } from './components/Animator.js';
export type { AnimationClip } from './components/Animator.js';

// New Systems
export { VNSystem } from './systems/VNSystem.js';
export type { DialogueNode, DialogueTree } from './systems/VNSystem.js';
export { LightingSystem, LightingFilter } from './systems/LightingSystem.js';
export type { Light, LightType } from './systems/LightingSystem.js';
export { PathfindingSystem } from './systems/PathfindingSystem.js';
export type { GridCell, PathRequest, PathResult } from './systems/PathfindingSystem.js';
export { SaveSystem } from './systems/SaveSystem.js';
export type { SaveSlot } from './systems/SaveSystem.js';
export { LocalisationSystem } from './systems/LocalisationSystem.js';
export type { Locale, TranslationMap } from './systems/LocalisationSystem.js';
export { CoroutineSystem, waitFrames, waitSeconds, waitUntil } from './systems/CoroutineSystem.js';
export type { CoroutineGen, CoroutineYield } from './systems/CoroutineSystem.js';
export { GamepadSystem } from './systems/GamepadSystem.js';
export type { GamepadState, DualRumbleOptions } from './systems/GamepadSystem.js';

// Core Manager
export { SystemManager } from './core/SystemManager.js';
export type { UpdatableSystem } from './core/SystemManager.js';

// SceneManager
export { SceneManagerInstance as SceneManager } from './core/SceneManager.js';
export type { TransitionOptions as SceneTransitionOptions, SceneFactory } from './core/SceneManager.js';

// ObjectPool
export { ObjectPool } from './core/ObjectPool.js';
export type { Poolable, PoolFactory } from './core/ObjectPool.js';

// New Systems — Tilemap
export { TilemapSystem, Tilemap } from './systems/TilemapSystem.js';
export type { TilemapData, TilemapLayer, TileCell, TilesetConfig } from './systems/TilemapSystem.js';

// New Systems — Particles
export { ParticleSystem, ParticleEmitter } from './systems/ParticleSystem.js';
export type { ParticleEmitterOptions, EmitterShape } from './systems/ParticleSystem.js';

// New Systems — Tweens & Timers
export { Tween, Timer } from './systems/TweenSystem.js';
export type { TweenOptions, EasingName } from './systems/TweenSystem.js';

// New Systems — UI
export { UISystem, UIComponent } from './systems/UISystem.js';
export type { UIComponentType, UIComponentOptions, UIStyle, UIAnchor } from './systems/UISystem.js';

// New Systems — Post-processing
export { PostProcessSystem } from './systems/PostProcessSystem.js';
export type {
  PostEffectType,
  PostEffectOptions,
  ActiveEffect,
  FlashOptions,
  FadeOptions,
  TransitionEffect as PostTransitionEffect,
} from './systems/PostProcessSystem.js';

// Components — RigidJoint
export { RigidJoint } from './components/RigidJoint.js';
export type { JointType, RevoluteOptions, PrismaticOptions, SpringOptions } from './components/RigidJoint.js';

// PhysicsBody callbacks
export type { ContactInfo, CollisionCallback, SensorCallback } from './components/PhysicsBody.js';

// Compat
export { detectMali, getMaliFixes, applyMaliFixes } from './compat/mali.js';
export type { MaliInfo, MaliFixes } from './compat/mali.js';

// Public type aliases — use these instead of importing from pixi.js/rapier/howler directly
export type { GameStage } from './types/aliases.js';
