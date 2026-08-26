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

// Compat
export { detectMali, getMaliFixes, applyMaliFixes } from './compat/mali.js';
export type { MaliInfo, MaliFixes } from './compat/mali.js';
