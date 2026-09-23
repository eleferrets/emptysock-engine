import type { ComponentDef } from "../Component.js";
import type { Scene } from "../Scene.js";
import { type PhysicsSystem } from "../systems/PhysicsSystem.js";
/**
 * ENGINE_DESIGN.md §8 / RELEASE_PASS.md "MCP live bridge" — the engine-side
 * half of the query/command channel `emptysock-mcp`'s physics/scene tools
 * (`physics_raycast_2d`, `physics_overlap_circle`, `physics_body_state`,
 * plus entity/component reads and scene entity listing) relay against.
 *
 * This is also the IDE's live Inspector transport target — `apps/ide`'s
 * preview iframe host constructs one, finds the running game's `Game`
 * instance via the static `Game.instances` registry, attaches its
 * `currentScene`, and relays `listEntities`/`entityInfo`/`getComponent`/
 * `setComponent` queries over `postMessage`. `core/IDEBridge.ts`'s own
 * `postMessage` wire format (`es:entities`/`es:set-component`, a fire-
 * and-forget broadcast built for the classic object model) has no real
 * caller anywhere in `apps/ide` — nothing ever calls `ideBridge.install()`
 * — so there was never a live protocol to migrate off of, only a dead one
 * to leave alone for the deletion pass.
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
/**
 * Merge `patch` into one component's live fields on one entity — the one
 * mutation this channel supports, alongside its otherwise read-only query
 * kinds. Exists for the IDE's live Inspector: editing a value while the
 * game is running has to reach the same live component data
 * `getComponent`/`listEntities` read, not a separate write path.
 */
export interface SetComponentQuery {
  kind: "setComponent";
  entityId: number;
  component: string;
  patch: Record<string, unknown>;
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
  | SetComponentQuery
  | Raycast2DQuery
  | OverlapCircle2DQuery
  | BodyState2DQuery;
/** Envelope a transport sends across the wire; `id` round-trips for request/response matching. */
export interface EngineQueryRequest {
  id: string;
  query: EngineQuery;
}
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
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: EngineQueryError;
    };
/** Envelope a transport sends back; `id` matches the originating `EngineQueryRequest.id`. */
export interface EngineQueryResponse {
  id: string;
  result: EngineQueryResult<unknown>;
}
export interface EntitySummary {
  entityId: number;
  components: string[];
  /**
   * From the entity's optional `Meta` component (RELEASE_PASS.md Track 0's
   * deferred IDEBridge/QueryChannel unification, resolved by
   * `ecs/components/Meta.ts`) — `undefined`/absent fields mean the entity
   * carries no `Meta` component at all, the common case for a purely
   * code-spawned entity. Never fabricated: a `name` present here always
   * came from a real `Meta.name` field, not a placeholder.
   */
  name?: string;
  tags?: readonly string[];
  active?: boolean;
  /** From the entity's optional `Transform` component, when present. */
  x?: number;
  y?: number;
  rotation?: number;
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
export declare class QueryChannel {
  private _live;
  private readonly _components;
  /**
   * Register component types this channel should read/list even before
   * `componentRegistry` has seen any live entity use them (e.g. right after
   * `attach()`, before the first `scene.spawn()`). Not required for
   * ordinary operation any more: `_resolveComponents()`/`_resolveComponent()`
   * also consult `componentRegistry.registeredComponents(scene.world)`
   * directly, which is what makes this channel work against a game whose
   * component set the caller never enumerated up front — the whole point
   * of ground rule 13's "IDE Inspector reads a real `ComponentRegistry`-
   * driven schema" item this channel now serves. Safe to call more than
   * once; later calls add to, rather than replace, the registered set.
   */
  registerComponents(...defs: ComponentDef[]): void;
  /** Every component this channel can currently see: manually registered, plus whatever `componentRegistry` has observed live on this scene's world. */
  private _resolveComponents;
  /** Resolve one component by name — manually registered first, then whatever `componentRegistry` has observed live. */
  private _resolveComponent;
  /** Point this channel at a live `Scene` (and, if physics queries are needed, its `PhysicsSystem`). */
  attach(scene: Scene, physics?: PhysicsSystem): void;
  /** Nothing is live any more — every query now answers `"no-live-instance"`. */
  detach(): void;
  get isLive(): boolean;
  /**
   * Answer one query synchronously. Transport-agnostic on purpose (see the
   * module doc comment) — a caller wiring this to a real transport reads
   * `query` off an `EngineQueryRequest`, calls this, and sends back an
   * `EngineQueryResponse` with the same `id`.
   */
  handle(query: EngineQuery): EngineQueryResult<unknown>;
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
  private _entityHandle;
  /** `Meta`/`Transform` fields for `EntitySummary`, when the entity carries either — see `EntitySummary`'s own doc comment. */
  private _summaryExtras;
  private _listEntities;
  private _entityInfo;
  private _getComponent;
  private _setComponent;
  private _raycast2d;
  private _overlapCircle2d;
  private _bodyState2d;
}
export {};
