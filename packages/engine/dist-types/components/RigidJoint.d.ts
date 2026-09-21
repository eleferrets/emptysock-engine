import { Component, type ComponentType } from "../core/Component.js";
export type JointType = "fixed" | "revolute" | "prismatic" | "spring";
export interface RevoluteOptions {
  /** Anchor point on body A in local space */
  anchorA?: {
    x: number;
    y: number;
  };
  /** Anchor point on body B in local space */
  anchorB?: {
    x: number;
    y: number;
  };
  minAngle?: number;
  maxAngle?: number;
}
export interface PrismaticOptions {
  anchorA?: {
    x: number;
    y: number;
  };
  anchorB?: {
    x: number;
    y: number;
  };
  /** Slide axis in local space of body A */
  axis?: {
    x: number;
    y: number;
  };
  minDistance?: number;
  maxDistance?: number;
}
export interface SpringOptions {
  anchorA?: {
    x: number;
    y: number;
  };
  anchorB?: {
    x: number;
    y: number;
  };
  restLength?: number;
  stiffness?: number;
  damping?: number;
}
export declare class RigidJoint extends Component {
  static readonly TYPE: ComponentType<RigidJoint>;
  readonly jointType: JointType;
  /** ID of the Entity that holds the second PhysicsBody in this joint. */
  bodyBEntityId: number | null;
  readonly revolute: RevoluteOptions;
  readonly prismatic: PrismaticOptions;
  readonly spring: SpringOptions;
  /** Runtime Rapier joint handle — set by PhysicsSystem. */
  jointHandle: number | null;
  constructor(options?: {
    jointType?: JointType;
    bodyBEntityId?: number;
    revolute?: RevoluteOptions;
    prismatic?: PrismaticOptions;
    spring?: SpringOptions;
  });
  serialize(): Record<string, unknown>;
}
