import {
  Component,
  componentType,
  type ComponentType,
} from "../core/Component.js";

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
export class PhysicsBody extends Component {
  static readonly TYPE: ComponentType<PhysicsBody> =
    componentType<PhysicsBody>("PhysicsBody");

  public bodyType: RigidBodyType;
  public shape: ColliderShape;
  public width: number;
  public height: number;
  public radius: number;
  public density: number;
  public friction: number;
  public restitution: number;
  public isSensor: boolean;

  /** Rapier rigid body handle. Set by PhysicsSystem.registerEntity(); null until registered. */
  public bodyHandle: number | null = null;
  /** Rapier collider handle. Set by PhysicsSystem.registerEntity(); null until registered. */
  public colliderHandle: number | null = null;

  private readonly _onCollisionEnter: CollisionCallback[] = [];
  private readonly _onCollisionExit: CollisionCallback[] = [];
  private readonly _onSensorEnter: SensorCallback[] = [];
  private readonly _onSensorExit: SensorCallback[] = [];
  private readonly _onSensorStay: SensorCallback[] = [];

  constructor(
    options: {
      bodyType?: RigidBodyType;
      shape?: ColliderShape;
      width?: number;
      height?: number;
      radius?: number;
      density?: number;
      friction?: number;
      restitution?: number;
      isSensor?: boolean;
    } = {},
  ) {
    super("PhysicsBody");
    this.bodyType = options.bodyType ?? "dynamic";
    this.shape = options.shape ?? "box";
    this.width = options.width ?? 32;
    this.height = options.height ?? 32;
    this.radius = options.radius ?? 16;
    this.density = options.density ?? 1;
    this.friction = options.friction ?? 0.5;
    this.restitution = options.restitution ?? 0.2;
    this.isSensor = options.isSensor ?? false;
  }

  /** Register a callback invoked when this body starts touching another (non-sensor) body. */
  onCollisionEnter(cb: CollisionCallback): void {
    this._onCollisionEnter.push(cb);
  }

  /** Register a callback invoked when this body stops touching another (non-sensor) body. */
  onCollisionExit(cb: CollisionCallback): void {
    this._onCollisionExit.push(cb);
  }

  /** Register a callback invoked when another body enters this sensor. */
  onSensorEnter(cb: SensorCallback): void {
    this._onSensorEnter.push(cb);
  }

  /** Register a callback invoked when another body exits this sensor. */
  onSensorExit(cb: SensorCallback): void {
    this._onSensorExit.push(cb);
  }

  /** Register a callback invoked every step another body remains inside this sensor. */
  onSensorStay(cb: SensorCallback): void {
    this._onSensorStay.push(cb);
  }

  /** Called by PhysicsSystem when Rapier reports a collision start with `other`. */
  dispatchCollisionEnter(other: PhysicsBody, contact: ContactInfo): void {
    for (const cb of this._onCollisionEnter) cb(other, contact);
  }

  /** Called by PhysicsSystem when Rapier reports a collision end with `other`. */
  dispatchCollisionExit(other: PhysicsBody, contact: ContactInfo): void {
    for (const cb of this._onCollisionExit) cb(other, contact);
  }

  /** Called by PhysicsSystem when Rapier reports a sensor intersection start with `other`. */
  dispatchSensorEnter(other: PhysicsBody): void {
    for (const cb of this._onSensorEnter) cb(other);
  }

  /** Called by PhysicsSystem when Rapier reports a sensor intersection end with `other`. */
  dispatchSensorExit(other: PhysicsBody): void {
    for (const cb of this._onSensorExit) cb(other);
  }

  /** Called by PhysicsSystem once per step while `other` remains inside this sensor. */
  dispatchSensorStay(other: PhysicsBody): void {
    for (const cb of this._onSensorStay) cb(other);
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
