import { Component, type ComponentType } from "../core/Component.js";
export type RigidBodyType =
  | "dynamic"
  | "fixed"
  | "kinematicPositionBased"
  | "kinematicVelocityBased";
export type ColliderShape = "box" | "circle" | "capsule";
export interface ContactInfo {
  /** Impact force in Newtons (approximate). */
  impactForce: number;
}
/** Called with the other body's PhysicsBody when a real collision starts/ends. */
export type CollisionCallback = (
  other: PhysicsBody,
  contact: ContactInfo,
) => void;
/** Called with the other body's PhysicsBody on sensor enter/exit/stay. */
export type SensorCallback = (other: PhysicsBody) => void;
/**
 * PhysicsBody — value component describing the shape and material of a rigid
 * body. Game code reads and writes these properties, and registers collision
 * callbacks here. The runtime handles (Rapier body/collider ids) live inside
 * PhysicsSystem, which calls back into this component via the `dispatch*`
 * methods when Rapier reports a real event — they are not meant to be called
 * directly by game code.
 */
export declare class PhysicsBody extends Component {
  static readonly TYPE: ComponentType<PhysicsBody>;
  bodyType: RigidBodyType;
  shape: ColliderShape;
  width: number;
  height: number;
  radius: number;
  density: number;
  friction: number;
  restitution: number;
  isSensor: boolean;
  /** Rapier rigid body handle. Set by PhysicsSystem.registerEntity(); null until registered. */
  bodyHandle: number | null;
  /** Rapier collider handle. Set by PhysicsSystem.registerEntity(); null until registered. */
  colliderHandle: number | null;
  private readonly _onCollisionEnter;
  private readonly _onCollisionExit;
  private readonly _onSensorEnter;
  private readonly _onSensorExit;
  private readonly _onSensorStay;
  constructor(options?: {
    bodyType?: RigidBodyType;
    shape?: ColliderShape;
    width?: number;
    height?: number;
    radius?: number;
    density?: number;
    friction?: number;
    restitution?: number;
    isSensor?: boolean;
  });
  /** Register a callback invoked when this body starts touching another (non-sensor) body. */
  onCollisionEnter(cb: CollisionCallback): void;
  /** Register a callback invoked when this body stops touching another (non-sensor) body. */
  onCollisionExit(cb: CollisionCallback): void;
  /** Register a callback invoked when another body enters this sensor. */
  onSensorEnter(cb: SensorCallback): void;
  /** Register a callback invoked when another body exits this sensor. */
  onSensorExit(cb: SensorCallback): void;
  /** Register a callback invoked every step another body remains inside this sensor. */
  onSensorStay(cb: SensorCallback): void;
  /** Called by PhysicsSystem when Rapier reports a collision start with `other`. */
  dispatchCollisionEnter(other: PhysicsBody, contact: ContactInfo): void;
  /** Called by PhysicsSystem when Rapier reports a collision end with `other`. */
  dispatchCollisionExit(other: PhysicsBody, contact: ContactInfo): void;
  /** Called by PhysicsSystem when Rapier reports a sensor intersection start with `other`. */
  dispatchSensorEnter(other: PhysicsBody): void;
  /** Called by PhysicsSystem when Rapier reports a sensor intersection end with `other`. */
  dispatchSensorExit(other: PhysicsBody): void;
  /** Called by PhysicsSystem once per step while `other` remains inside this sensor. */
  dispatchSensorStay(other: PhysicsBody): void;
  serialize(): Record<string, unknown>;
}
