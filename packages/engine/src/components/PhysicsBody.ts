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

  private readonly _onCollisionEnterHandlers: CollisionCallback[] = [];
  private readonly _onCollisionExitHandlers: CollisionCallback[] = [];
  private readonly _onSensorEnterHandlers: SensorCallback[] = [];
  private readonly _onSensorStayHandlers: SensorCallback[] = [];
  private readonly _onSensorExitHandlers: SensorCallback[] = [];

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

  onCollisionEnter(cb: CollisionCallback): () => void {
    this._onCollisionEnterHandlers.push(cb);
    return () => { const i = this._onCollisionEnterHandlers.indexOf(cb); if (i !== -1) this._onCollisionEnterHandlers.splice(i, 1); };
  }
  onCollisionExit(cb: CollisionCallback): () => void {
    this._onCollisionExitHandlers.push(cb);
    return () => { const i = this._onCollisionExitHandlers.indexOf(cb); if (i !== -1) this._onCollisionExitHandlers.splice(i, 1); };
  }
  onSensorEnter(cb: SensorCallback): () => void {
    this._onSensorEnterHandlers.push(cb);
    return () => { const i = this._onSensorEnterHandlers.indexOf(cb); if (i !== -1) this._onSensorEnterHandlers.splice(i, 1); };
  }
  onSensorStay(cb: SensorCallback): () => void {
    this._onSensorStayHandlers.push(cb);
    return () => { const i = this._onSensorStayHandlers.indexOf(cb); if (i !== -1) this._onSensorStayHandlers.splice(i, 1); };
  }
  onSensorExit(cb: SensorCallback): () => void {
    this._onSensorExitHandlers.push(cb);
    return () => { const i = this._onSensorExitHandlers.indexOf(cb); if (i !== -1) this._onSensorExitHandlers.splice(i, 1); };
  }

  // ─── Dispatchers — called by PhysicsSystem ───────────────────────────────

  dispatchCollisionEnter(other: PhysicsBody, contact: ContactInfo): void {
    for (const cb of this._onCollisionEnterHandlers) cb(other, contact);
  }
  dispatchCollisionExit(other: PhysicsBody, contact: ContactInfo): void {
    for (const cb of this._onCollisionExitHandlers) cb(other, contact);
  }
  dispatchSensorEnter(other: PhysicsBody): void {
    for (const cb of this._onSensorEnterHandlers) cb(other);
  }
  dispatchSensorStay(other: PhysicsBody): void {
    for (const cb of this._onSensorStayHandlers) cb(other);
  }
  dispatchSensorExit(other: PhysicsBody): void {
    for (const cb of this._onSensorExitHandlers) cb(other);
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
