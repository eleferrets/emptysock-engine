import type { ComponentDef } from "../Component.js";
import { Entity } from "../Entity.js";
import type { Scene } from "../Scene.js";
import {
  PhysicsNotInitializedError,
  type PhysicsSystem,
} from "../systems/PhysicsSystem.js";

/**
 * ENGINE_DESIGN.md §8 / RELEASE_PASS.md "MCP live bridge" — the engine-side
 * half of the query/command channel `emptysock-mcp`'s physics/scene tools
 * (`physics_raycast_2d`, `physics_overlap_circle`, `physics_body_state`,
 * plus entity/component reads and scene entity listing) relay against.
 *
 * This is the v2-aware counterpart to `core/IDEBridge.ts`: `IDEBridge` is a
 * `postMessage`-shaped, fire-and-forget broadcast (entity snapshots pushed
 * on a timer, component patches pushed back) built for the v1 object model
 * and the IDE's own iframe embedding. Raycasts and overlap tests need a
 * synchronous request/response round trip against a live v2 `Scene` and
 * `PhysicsSystem` instead, so this is a separate, narrower thing — it does
 * not replace `IDEBridge` or share its wire format.
 *
 * ## Transport-agnostic by design
 *
 * `QueryChannel` never touches a socket, `window`, or any transport. It is
 * the same "engine defines and depends on the interface, never a concrete
 * implementation" pattern as `Transport` (`NetworkActor`) and
 * `StorageAdapter` (`SaveSystem`) — CLAUDE.md's "Transport is an interface,
 * not a class" and "SaveSystem storage backend is an injected adapter"
 * entries. `handle()` is a plain, synchronous, JSON-serializable
 * request-in/response-out function. Whoever owns a live instance — the IDE's
 * preview iframe host, a launched dev build's own bootstrap code — is
 * responsible for:
 *
 *   1. Constructing one `QueryChannel` and calling `attach()` once a `Game`
 *      has a scene loaded (and again after each `loadScene`, since a new
 *      scene means a new `Scene`/`PhysicsSystem` pair).
 *   2. Wiring *some* transport (a `WebSocket` message handler, `IDEBridge`'s
 *      own `postMessage` pipe, an in-process function call for tests) that
 *      receives an `EngineQueryRequest`, calls `channel.handle(request.query)`,
 *      and sends the `EngineQueryResult` back over the same transport.
 *
 * `@emptysock/engine` ships neither the WebSocket server nor the
 * `emptysock-mcp` relay client — that is explicitly `emptysock-mcp`'s job
 * (a separate repo/pass), matching the engine environment boundary (no
 * network/DOM dependency belongs inside this package). This file is the
 * contract a future relay-side implementation builds against: the
 * `EngineQuery`/`EngineQueryResult` shapes below, plus `QueryChannel.handle`.
 *
 * ## No live instance, no fabricated answer
 *
 * ENGINE_DESIGN.md §8: "No live instance connected → a clear error, not a
 * fabricated answer." Every `handle()` call first checks whether a `Scene`
 * is attached at all; if not, every query kind — including ones that would
 * otherwise have a legitimate "empty" answer, like `listEntities` — returns
 * `{ ok: false, error: { code: "no-live-instance", ... } }` rather than an
 * empty array or a `hit: null` that would read as a genuine "found nothing"
 * result. The same distinction holds one level down for physics queries
 * specifically: a `Scene` can be attached with no `PhysicsSystem` (or one
 * that hasn't finished `init()`), which is `"no-physics-world"`, distinct
 * from both `"no-live-instance"` and a real "ray hit nothing"/"nothing
 * overlapping" answer (`data: null` / `data: []`) once a world genuinely is
 * being queried. Collapsing any of these three into one shape is exactly
 * the "fabricated answer" §8 warns against — an agent acting on a
 * mis-reported empty result could make a decision (e.g. "path is clear")
 * that is only true because nothing was actually queried.
 */

// --- Query request shapes ---------------------------------------------

interface Vec2 {
  x: number;
  y: number;
}

/** List every entity that carries at least one of the channel's registered component types. */
export interface ListEntitiesQuery {
  kind: "listEntities";
}

/** All registered component names present on one entity. */
export interface EntityInfoQuery {
  kind: "entityInfo";
  entityId: number;
}

/** One component's current field values on one entity. */
export interface GetComponentQuery {
  kind: "getComponent";
  entityId: number;
  component: string;
}

/** `physics_raycast_2d` — cast a ray, return the first hit (if any). */
export interface Raycast2DQuery {
  kind: "raycast2d";
  origin: Vec2;
  direction: Vec2;
  maxToi?: number;
  solid?: boolean;
}

/** `physics_overlap_circle` — every registered body overlapping a circle. */
export interface OverlapCircle2DQuery {
  kind: "overlapCircle2d";
  center: Vec2;
  radius: number;
}

/** `physics_body_state` — one registered `PhysicsBody`'s live Rapier state. */
export interface BodyState2DQuery {
  kind: "bodyState2d";
  entityId: number;
}

export type EngineQuery =
  | ListEntitiesQuery
  | EntityInfoQuery
  | GetComponentQuery
  | Raycast2DQuery
  | OverlapCircle2DQuery
  | BodyState2DQuery;

/** Envelope a transport sends across the wire; `id` round-trips for request/response matching. */
export interface EngineQueryRequest {
  id: string;
  query: EngineQuery;
}

// --- Result shapes -------------------------------------------------------

export type EngineQueryErrorCode =
  | "no-live-instance"
  | "no-physics-world"
  | "not-found"
  | "unknown-component";

export interface EngineQueryError {
  code: EngineQueryErrorCode;
  message: string;
}

export type EngineQueryResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: EngineQueryError };

/** Envelope a transport sends back; `id` matches the originating `EngineQueryRequest.id`. */
export interface EngineQueryResponse {
  id: string;
  result: EngineQueryResult<unknown>;
}

export interface EntitySummary {
  entityId: number;
  components: string[];
}

export interface RaycastResultData {
  entityId: number;
  point: Vec2;
  normal: Vec2;
  toi: number;
}

export interface BodyStateData {
  position: Vec2;
  rotation: number;
  velocity: Vec2;
  type: string;
  isSensor: boolean;
}

// --- Channel ---------------------------------------------------------------

interface LiveInstance {
  scene: Scene;
  physics: PhysicsSystem | undefined;
}

function noLiveInstance<T>(): EngineQueryResult<T> {
  return {
    ok: false,
    error: {
      code: "no-live-instance",
      message:
        "No live engine connected — start the game in the IDE or launch a dev build.",
    },
  };
}

function noPhysicsWorld<T>(): EngineQueryResult<T> {
  return {
    ok: false,
    error: {
      code: "no-physics-world",
      message:
        "This scene has no initialized physics world — nothing to raycast or overlap-test against.",
    },
  };
}

function notFound<T>(message: string): EngineQueryResult<T> {
  return { ok: false, error: { code: "not-found", message } };
}

function ok<T>(data: T): EngineQueryResult<T> {
  return { ok: true, data };
}

/**
 * The engine-side query/command channel (ENGINE_DESIGN.md §8). See the
 * module doc comment above for the transport-agnostic contract and the
 * no-live-instance-vs-empty-result distinction. One instance is meant to be
 * long-lived across scene reloads: call `attach()` again after every
 * `Game.loadScene()` (a new `Scene` means new entity ids and a new
 * `PhysicsSystem`), and `detach()` on `unloadScene()`/shutdown so in-flight
 * queries fail loudly with `"no-live-instance"` instead of resolving against
 * a torn-down scene.
 */
export class QueryChannel {
  private _live: LiveInstance | null = null;
  private readonly _components = new Map<string, ComponentDef>();

  /**
   * Register the component types this channel can read/list. Entity/
   * component queries only ever see components registered here — a `Scene`
   * has no built-in "list every entity regardless of shape" primitive
   * (ENGINE_DESIGN.md §21's `each()` always takes explicit component defs),
   * so the channel needs the same explicit list. Safe to call more than
   * once; later calls add to, rather than replace, the registered set.
   */
  registerComponents(...defs: ComponentDef[]): void {
    for (const def of defs) this._components.set(def.componentName, def);
  }

  /** Point this channel at a live `Scene` (and, if physics queries are needed, its `PhysicsSystem`). */
  attach(scene: Scene, physics?: PhysicsSystem): void {
    this._live = { scene, physics };
  }

  /** Nothing is live any more — every query now answers `"no-live-instance"`. */
  detach(): void {
    this._live = null;
  }

  get isLive(): boolean {
    return this._live !== null;
  }

  /**
   * Answer one query synchronously. Transport-agnostic on purpose (see the
   * module doc comment) — a caller wiring this to a real transport reads
   * `query` off an `EngineQueryRequest`, calls this, and sends back an
   * `EngineQueryResponse` with the same `id`.
   */
  handle(query: EngineQuery): EngineQueryResult<unknown> {
    switch (query.kind) {
      case "listEntities":
        return this._listEntities();
      case "entityInfo":
        return this._entityInfo(query.entityId);
      case "getComponent":
        return this._getComponent(query.entityId, query.component);
      case "raycast2d":
        return this._raycast2d(query);
      case "overlapCircle2d":
        return this._overlapCircle2d(query);
      case "bodyState2d":
        return this._bodyState2d(query.entityId);
    }
  }

  /**
   * Builds a throwaway `Entity` handle (and, via `.get()`, throwaway
   * component proxies) for exactly one query call. This is *intentionally*
   * scratch state, never shared with the live game's own proxy cache: each
   * call passes its own fresh `Map()` as the proxy cache instead of reusing
   * `Scene`'s (the one `scene.spawn()`/`entity.get()` actually populate), so
   * a proxy this method hands back is never the *same* proxy object game
   * code elsewhere holds a reference to, even for the same `(world, eid,
   * component)` triple. That's fine today — every caller of `handle()`
   * (the query bridge, `emptysock-mcp`) only ever reads plain data out of
   * the result and never hands a query result's component object back into
   * game code — but it is a real invariant, not an accident: if a future
   * change ever needed proxy identity to round-trip (e.g. handing a
   * `getComponent` query's result to something that later mutates it and
   * expects the write to land), this per-call cache would silently break
   * that, since a write through it never touches the live game's own
   * cached proxy. Do not "fix" this by reaching into `Scene`'s private
   * proxy cache — keep this scratch and document the constraint here
   * instead.
   */
  private _entityHandle(entityId: number): Entity | null {
    const live = this._live;
    if (live === null) return null;
    // A fresh handle onto the same (world, eid) pair — cheap, and correct
    // for read-only queries even though it bypasses `Scene`'s shared proxy
    // cache (see `Entity`'s constructor doc: a handle carries no state of
    // its own beyond `world` + `eid`).
    return new Entity(live.scene.world, entityId, new Map());
  }

  private _listEntities(): EngineQueryResult<EntitySummary[]> {
    const live = this._live;
    if (live === null) return noLiveInstance();

    const byEntity = new Map<number, Set<string>>();
    for (const def of this._components.values()) {
      live.scene.each(def, (_component, entity) => {
        let names = byEntity.get(entity.eid);
        if (names === undefined) {
          names = new Set();
          byEntity.set(entity.eid, names);
        }
        names.add(def.componentName);
      });
    }

    const summaries: EntitySummary[] = [];
    for (const [entityId, names] of byEntity) {
      summaries.push({ entityId, components: [...names] });
    }
    return ok(summaries);
  }

  private _entityInfo(entityId: number): EngineQueryResult<EntitySummary> {
    const live = this._live;
    if (live === null) return noLiveInstance();

    const entity = this._entityHandle(entityId);
    if (entity === null || !entity.isAlive) {
      return notFound(`No live entity with id ${entityId}.`);
    }

    const components: string[] = [];
    for (const def of this._components.values()) {
      if (entity.has(def)) components.push(def.componentName);
    }
    return ok({ entityId, components });
  }

  private _getComponent(
    entityId: number,
    component: string,
  ): EngineQueryResult<Record<string, unknown>> {
    const live = this._live;
    if (live === null) return noLiveInstance();

    const def = this._components.get(component);
    if (def === undefined) {
      return {
        ok: false,
        error: {
          code: "unknown-component",
          message: `"${component}" is not registered with this query channel.`,
        },
      };
    }

    const entity = this._entityHandle(entityId);
    if (entity === null || !entity.isAlive) {
      return notFound(`No live entity with id ${entityId}.`);
    }
    const data = entity.get(def);
    if (data === undefined) {
      return notFound(`Entity ${entityId} has no "${component}" component.`);
    }
    return ok({ ...data });
  }

  private _raycast2d(
    query: Raycast2DQuery,
  ): EngineQueryResult<RaycastResultData | null> {
    const live = this._live;
    if (live === null) return noLiveInstance();
    if (live.physics === undefined) return noPhysicsWorld();

    try {
      const hit = live.physics.raycast(
        query.origin,
        query.direction,
        query.maxToi,
        query.solid,
      );
      if (hit === null) return ok(null);
      return ok({
        entityId: hit.entity.eid,
        point: hit.point,
        normal: hit.normal,
        toi: hit.toi,
      });
    } catch (err) {
      if (err instanceof PhysicsNotInitializedError) return noPhysicsWorld();
      throw err;
    }
  }

  private _overlapCircle2d(
    query: OverlapCircle2DQuery,
  ): EngineQueryResult<number[]> {
    const live = this._live;
    if (live === null) return noLiveInstance();
    if (live.physics === undefined) return noPhysicsWorld();

    try {
      const hits = live.physics.overlapCircle(query.center, query.radius);
      return ok(hits.map((entity) => entity.eid));
    } catch (err) {
      if (err instanceof PhysicsNotInitializedError) return noPhysicsWorld();
      throw err;
    }
  }

  private _bodyState2d(entityId: number): EngineQueryResult<BodyStateData> {
    const live = this._live;
    if (live === null) return noLiveInstance();
    if (live.physics === undefined) return noPhysicsWorld();

    const entity = this._entityHandle(entityId);
    if (entity === null || !entity.isAlive) {
      return notFound(`No live entity with id ${entityId}.`);
    }

    try {
      const state = live.physics.getBodyState(entity);
      if (state === undefined) {
        return notFound(`Entity ${entityId} has no registered physics body.`);
      }
      return ok(state);
    } catch (err) {
      if (err instanceof PhysicsNotInitializedError) return noPhysicsWorld();
      throw err;
    }
  }
}
