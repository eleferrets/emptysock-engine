import { Component } from '../core/Component.js';

export type RigidBodyType = 'dynamic' | 'fixed' | 'kinematicPositionBased' | 'kinematicVelocityBased';
export type ColliderShape = 'box' | 'circle' | 'capsule';

export interface ContactInfo {
  /** Impact force in Newtons (approximate). */
  impactForce: number;
}

export type CollisionCallback = (other: PhysicsBody, contact: ContactInfo) => void;
export type SensorCallback = (other: PhysicsBody) => void;

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

  /** Runtime Rapier body handle — set by PhysicsSystem */
  public bodyHandle: number | null = null;
  /** Runtime Rapier collider handle — set by PhysicsSystem */
  public colliderHandle: number | null = null;

  // ─── Collision callbacks ─────────────────────────────────────────────────

  private _onCollisionEnter: CollisionCallback | null = null;
  private _onCollisionExit: CollisionCallback | null = null;
  private _onSensorEnter: SensorCallback | null = null;
  private _onSensorStay: SensorCallback | null = null;
  private _onSensorExit: SensorCallback | null = null;

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

  // ─── Callback registration ───────────────────────────────────────────────

  onCollisionEnter(cb: CollisionCallback): void { this._onCollisionEnter = cb; }
  onCollisionExit(cb: CollisionCallback): void { this._onCollisionExit = cb; }
  onSensorEnter(cb: SensorCallback): void { this._onSensorEnter = cb; }
  onSensorStay(cb: SensorCallback): void { this._onSensorStay = cb; }
  onSensorExit(cb: SensorCallback): void { this._onSensorExit = cb; }

  // ─── Dispatchers — called by PhysicsSystem ───────────────────────────────

  dispatchCollisionEnter(other: PhysicsBody, contact: ContactInfo): void {
    this._onCollisionEnter?.(other, contact);
  }
  dispatchCollisionExit(other: PhysicsBody, contact: ContactInfo): void {
    this._onCollisionExit?.(other, contact);
  }
  dispatchSensorEnter(other: PhysicsBody): void { this._onSensorEnter?.(other); }
  dispatchSensorStay(other: PhysicsBody): void { this._onSensorStay?.(other); }
  dispatchSensorExit(other: PhysicsBody): void { this._onSensorExit?.(other); }

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
