import { Component } from "../core/Component.js";
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
export type CollisionCallback = (
  other: PhysicsBody,
  contact: ContactInfo,
) => void;
export type SensorCallback = (other: PhysicsBody) => void;
export declare class PhysicsBody extends Component {
  bodyType: RigidBodyType;
  shape: ColliderShape;
  width: number;
  height: number;
  radius: number;
  density: number;
  friction: number;
  restitution: number;
  isSensor: boolean;
  /** Runtime Rapier body handle — set by PhysicsSystem */
  bodyHandle: number | null;
  /** Runtime Rapier collider handle — set by PhysicsSystem */
  colliderHandle: number | null;
  private readonly _onCollisionEnterHandlers;
  private readonly _onCollisionExitHandlers;
  private readonly _onSensorEnterHandlers;
  private readonly _onSensorStayHandlers;
  private readonly _onSensorExitHandlers;
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
  onCollisionEnter(cb: CollisionCallback): () => void;
  onCollisionExit(cb: CollisionCallback): () => void;
  onSensorEnter(cb: SensorCallback): () => void;
  onSensorStay(cb: SensorCallback): () => void;
  onSensorExit(cb: SensorCallback): () => void;
  dispatchCollisionEnter(other: PhysicsBody, contact: ContactInfo): void;
  dispatchCollisionExit(other: PhysicsBody, contact: ContactInfo): void;
  dispatchSensorEnter(other: PhysicsBody): void;
  dispatchSensorStay(other: PhysicsBody): void;
  dispatchSensorExit(other: PhysicsBody): void;
  serialize(): Record<string, unknown>;
}
