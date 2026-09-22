import type { World } from "bitecs";
import { defineComponent } from "../Component.js";
import type { Entity } from "../Entity.js";

export type PhysicsBodyType = "dynamic" | "static" | "kinematic";
export type PhysicsBodyShape = "box" | "circle" | "capsule";

/** Approximate impact info handed to a collision callback. */
export interface ContactInfo {
  impactForce: number;
}

export type CollisionCallback = (other: Entity, contact: ContactInfo) => void;
export type SensorCallback = (other: Entity) => void;

/**
 * Plain-data shape of `PhysicsBody` (ENGINE_DESIGN.md §6) — everything Rapier
 * needs, expressed in plain-language properties instead of raw Rapier
 * descriptors/handles. This is the object `defineComponent` stores in
 * bitECS's per-field arrays, so it must satisfy `SerializableRecord` — no
 * functions here. Callback properties (`onCollide` etc.) are *not* part of
 * this shape; see the module doc comment below for why, and `getPhysicsBody`
 * for how they're still exposed as plain assignable properties.
 */
export const PhysicsBody = defineComponent(
  "PhysicsBody",
  () => ({
    type: "dynamic" as PhysicsBodyType,
    shape: "box" as PhysicsBodyShape,
    width: 32,
    height: 32,
    radius: 16,
    density: 1,
    friction: 0.5,
    restitution: 0.2,
    isSensor: false as boolean,
    position: { x: 0, y: 0 },
    rotation: 0,
    velocity: { x: 0, y: 0 },
    // Rapier handles, set by PhysicsSystem.registerEntity(); null until
    // registered. Kept on the component (rather than an internal-only map)
    // because v1 did the same and game code occasionally wants to know
    // whether a body has been registered yet.
    bodyHandle: null as number | null,
    colliderHandle: null as number | null,
  }),
  {
    // Only the plain-data fields a designer would actually want to tweak
    // from the Inspector get a schema entry — `position`/`velocity` (nested
    // objects) and the engine-managed Rapier handles are left unlisted, so
    // they fall back to the raw editor per `ComponentSchema`'s doc comment.
    schema: {
      type: { kind: "enum", options: ["dynamic", "static", "kinematic"] },
      shape: { kind: "enum", options: ["box", "circle", "capsule"] },
      width: { kind: "number" },
      height: { kind: "number" },
      radius: { kind: "number" },
      density: { kind: "number" },
      friction: { kind: "number" },
      restitution: { kind: "number" },
      isSensor: { kind: "boolean" },
      rotation: { kind: "number" },
    },
  },
);

/**
 * Non-obvious storage decision: collision/sensor callbacks (`onCollide`,
 * `onSensorEnter`, etc.) cannot live as fields of `PhysicsBody` itself.
 * `defineComponent<T extends SerializableRecord>` rejects any shape with a
 * function field at the type level (see `v2/Serializable.ts`) — that
 * constraint is intentional (Track 0: a component made only of
 * `Serializable` fields can be saved/loaded generically later) and physics
 * callbacks are exactly the kind of thing that constraint exists to keep out
 * of bitECS's arrays.
 *
 * So callbacks live in a side-table here, keyed first by the owning bitECS
 * `World` (so two scenes' entity id `5` never collide) and then by raw
 * entity id — mirroring the exact pattern `ComponentRegistry` already uses
 * for per-world storage scoping. `getPhysicsBody(entity)` hands back a proxy
 * that reads/writes the real `PhysicsBody` data proxy for ordinary fields
 * and reads/writes this side-table for the five callback properties, so
 * from game code's point of view `body.onCollisionEnter = fn` "is the
 * registration" (§4) exactly like every other property on the component —
 * the split is invisible outside this file and `PhysicsSystem`, which reads
 * the side-table directly via `getPhysicsCallbacks` to dispatch events.
 */
interface PhysicsCallbacks {
  onCollisionEnter?: CollisionCallback;
  onCollisionExit?: CollisionCallback;
  onSensorEnter?: SensorCallback;
  onSensorExit?: SensorCallback;
  onSensorStay?: SensorCallback;
}

const CALLBACK_KEYS = new Set<string>([
  "onCollisionEnter",
  "onCollisionExit",
  "onSensorEnter",
  "onSensorExit",
  "onSensorStay",
]);

const callbacksByWorld = new WeakMap<World, Map<number, PhysicsCallbacks>>();

/** @internal — read by `PhysicsSystem` to dispatch a stored callback. */
export function getPhysicsCallbacks(
  world: World,
  eid: number,
): PhysicsCallbacks {
  let byEntity = callbacksByWorld.get(world);
  if (byEntity === undefined) {
    byEntity = new Map();
    callbacksByWorld.set(world, byEntity);
  }
  let callbacks = byEntity.get(eid);
  if (callbacks === undefined) {
    callbacks = {};
    byEntity.set(eid, callbacks);
  }
  return callbacks;
}

/** Data shape plus the five assignable callback properties. */
export type PhysicsBodyHandle = ReturnType<typeof PhysicsBody.createDefaults> &
  PhysicsCallbacks;

const handleCache = new WeakMap<World, Map<number, PhysicsBodyHandle>>();

/**
 * The one intended way to read/write a `PhysicsBody`, including its
 * callback properties: `getPhysicsBody(entity).onCollisionEnter = (other) =>
 * {}`. Returns `undefined` if the entity is dead or has no `PhysicsBody`.
 * `entity.get(PhysicsBody)` still works for the plain-data fields, but
 * TypeScript won't let you assign a callback through it (correctly — those
 * fields aren't part of the serializable shape).
 */
export function getPhysicsBody(entity: Entity): PhysicsBodyHandle | undefined {
  const data = entity.get(PhysicsBody);
  if (data === undefined) return undefined;

  let byEntity = handleCache.get(entity.world);
  if (byEntity === undefined) {
    byEntity = new Map();
    handleCache.set(entity.world, byEntity);
  }
  let handle = byEntity.get(entity.eid);
  if (handle !== undefined) return handle;

  handle = new Proxy({} as PhysicsBodyHandle, {
    get(_target, prop) {
      if (typeof prop !== "string") return undefined;
      if (CALLBACK_KEYS.has(prop)) {
        return getPhysicsCallbacks(entity.world, entity.eid)[
          prop as keyof PhysicsCallbacks
        ];
      }
      return (data as unknown as Record<string, unknown>)[prop];
    },
    set(_target, prop, value) {
      if (typeof prop !== "string") return false;
      if (CALLBACK_KEYS.has(prop)) {
        (
          getPhysicsCallbacks(entity.world, entity.eid) as Record<
            string,
            unknown
          >
        )[prop] = value;
        return true;
      }
      (data as unknown as Record<string, unknown>)[prop] = value;
      return true;
    },
    has(_target, prop) {
      return (
        typeof prop === "string" &&
        (CALLBACK_KEYS.has(prop) ||
          prop in (data as unknown as Record<string, unknown>))
      );
    },
  });
  byEntity.set(entity.eid, handle);
  return handle;
}
