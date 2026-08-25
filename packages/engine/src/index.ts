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

// Compat
export { detectMali, getMaliFixes, applyMaliFixes } from './compat/mali.js';
export type { MaliInfo, MaliFixes } from './compat/mali.js';
