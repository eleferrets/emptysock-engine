import { Component } from '../core/Component.js';

export type RigidBodyType = 'dynamic' | 'fixed' | 'kinematicPositionBased' | 'kinematicVelocityBased';
export type ColliderShape = 'box' | 'circle' | 'capsule';

export interface ContactInfo {
  /** Impact force in Newtons (approximate). */
  impactForce: number;
}

/**
 * PhysicsBody — value component describing the shape and material of a rigid
 * body. Game code reads and writes these properties only; the runtime handles
 * (Rapier body/collider ids) live inside PhysicsSystem and are never exposed
 * here.
 */
export class PhysicsBody extends Component {
  public bodyType: RigidBodyType;
  public shape: ColliderShape;
  public width: number;
  public height: number;
  public radius: number;
  public density: number;
  public friction: number;
  public restitution: number;
  public isSensor: boolean;

  constructor(options: {
    bodyType?: RigidBodyType;
    shape?: ColliderShape;
    width?: number;
    height?: number;
    radius?: number;
    density?: number;
    friction?: number;
    restitution?: number;
    isSensor?: boolean;
  } = {}) {
    super('PhysicsBody');
    this.bodyType = options.bodyType ?? 'dynamic';
    this.shape = options.shape ?? 'box';
    this.width = options.width ?? 32;
    this.height = options.height ?? 32;
    this.radius = options.radius ?? 16;
    this.density = options.density ?? 1;
    this.friction = options.friction ?? 0.5;
    this.restitution = options.restitution ?? 0.2;
    this.isSensor = options.isSensor ?? false;
  }

  override serialize(): Record<string, unknown> {
    return {
      ...super.serialize(),
      bodyType: this.bodyType,
      shape: this.shape,
      width: this.width,
      height: this.height,
      radius: this.radius,
      density: this.density,
      friction: this.friction,
      restitution: this.restitution,
      isSensor: this.isSensor,
    };
  }
}
