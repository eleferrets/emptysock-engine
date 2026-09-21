import type { ComponentDef, Entity, Scene } from "@emptysock/engine/v2";
import { getNetworkedFields } from "./NetworkedFields.js";
import { NetworkEntityMap } from "./NetworkEntityMap.js";
import type {
  CallbackProxyFn,
  GetStateCallbacksFn,
  RoomLike,
} from "./colyseusTypes.js";

/** Outbound sync message shape sent via `room.send(messageType, payload)`. */
export interface NetworkSyncPayload {
  readonly networkId: string;
  readonly componentName: string;
  readonly field: string;
  readonly value: unknown;
}

export interface NetworkSystemOptions {
  readonly scene: Scene;
  readonly room: RoomLike;
  /** Property name on `room.state` holding the `MapSchema` of networked entities, e.g. `"players"`. */
  readonly collection: string;
  /** Every `ComponentDef` a networked entity in this collection may carry. Only fields marked via `networked()` are synced. */
  readonly components: readonly ComponentDef[];
  /**
   * Network id owned by this client (usually `room.sessionId`). The entity
   * mapped to this id is treated as locally-authoritative: its networked
   * fields are read every `sync()` call and pushed outbound on change,
   * rather than being overwritten by inbound state. Omit for a
   * server-authoritative / spectator setup where nothing is sent outbound.
   */
  readonly localId?: string;
  /** `room.send` message type used for outbound field updates. Default `"networkSync"`. */
  readonly messageType?: string;
  /**
   * Injectable in place of colyseus.js's real `getStateCallbacks` — lets
   * tests supply a fake room/schema without a live Colyseus server. In
   * game code, pass the real `getStateCallbacks` imported from
   * `"colyseus.js"`.
   */
  readonly getStateCallbacks: GetStateCallbacksFn;
}

/**
 * The client-side half of ENGINE_DESIGN.md §23.2's networking bridge:
 * "`@emptysock/network` reads/writes through the same `.get()` Proxy layer
 * ... it only ever sees the same `Component` classes and `.get()` shape
 * every other part of the engine sees."
 *
 * `NetworkSystem` never imports bitECS and never reaches past
 * `entity.get(Component)` — every read/write to a networked field goes
 * through the exact same proxy game code uses. It knows nothing about
 * bitECS's entity ids either: the network<->local mapping is entirely
 * `NetworkEntityMap`, keyed on Colyseus's own schema-collection keys
 * (session ids for players, or whatever synthetic key the server assigns).
 */
export class NetworkSystem {
  readonly entities = new NetworkEntityMap();

  private readonly _scene: Scene;
  private readonly _room: RoomLike;
  private readonly _components: readonly ComponentDef[];
  private readonly _localId: string | undefined;
  private readonly _messageType: string;
  private readonly _$: CallbackProxyFn;
  /** Last-sent value per (networkId, componentName, field) — the outbound dirty-check baseline. */
  private readonly _lastSent = new Map<string, unknown>();
  private _unbindCollection: (() => void) | undefined;

  constructor(options: NetworkSystemOptions) {
    this._scene = options.scene;
    this._room = options.room;
    this._components = options.components;
    this._localId = options.localId;
    this._messageType = options.messageType ?? "networkSync";
    this._$ = options.getStateCallbacks(options.room);

    this._bindCollection(options.collection);
  }

  private _bindCollection(collection: string): void {
    const stateProxy = this._$(this._room.state) as unknown as Record<
      string,
      unknown
    >;
    const collectionProxy = stateProxy[collection] as {
      onAdd(cb: (item: unknown, key: string) => void): () => void;
      onRemove(cb: (item: unknown, key: string) => void): () => void;
    };

    const unsubAdd = collectionProxy.onAdd((schema, networkId) => {
      this._spawnFromSchema(networkId, schema);
    });
    const unsubRemove = collectionProxy.onRemove((_schema, networkId) => {
      const entity = this.entities.getEntity(networkId);
      if (entity !== undefined) {
        this._scene.destroy(entity);
        this.entities.deleteByNetworkId(networkId);
      }
    });
    this._unbindCollection = () => {
      unsubAdd();
      unsubRemove();
    };
  }

  private _spawnFromSchema(networkId: string, schema: unknown): void {
    const entity = this._scene.spawn();
    this.entities.set(networkId, entity);
    const isLocal = networkId === this._localId;

    for (const def of this._components) {
      const networkedFields = getNetworkedFields(def.componentName);
      const initial: Record<string, unknown> = {};
      if (networkedFields !== undefined) {
        for (const field of networkedFields) {
          const value = (schema as Record<string, unknown>)[field];
          if (value !== undefined) initial[field] = value;
        }
      }
      entity.add(def, initial as Partial<Record<string, unknown>> as never);

      // Remote entities: inbound writes only. The local player's own
      // entity is authoritative here and must not be overwritten by an
      // echo of the state it just pushed outbound.
      if (!isLocal && networkedFields !== undefined) {
        const schemaProxy = this._$(schema) as unknown as {
          listen<K extends string>(
            field: K,
            cb: (value: unknown, previous: unknown) => void,
          ): () => void;
        };
        for (const field of networkedFields) {
          schemaProxy.listen(field, (value) => {
            const component = entity.get(def) as
              | Record<string, unknown>
              | undefined;
            if (component !== undefined) component[field] = value;
          });
        }
      }
    }
  }

  /**
   * Call once per frame (or at whatever cadence the game wants to push
   * updates — networked state is "replicated a handful of times a second",
   * per ENGINE_DESIGN.md §23.2, not every-frame-at-60fps). Diffs the local
   * player's networked fields against the last value sent and calls
   * `room.send` for anything that changed.
   */
  sync(): void {
    if (this._localId === undefined) return;
    const entity = this.entities.getEntity(this._localId);
    if (entity === undefined || !entity.isAlive) return;

    for (const def of this._components) {
      const networkedFields = getNetworkedFields(def.componentName);
      if (networkedFields === undefined) continue;
      const component = entity.get(def) as Record<string, unknown> | undefined;
      if (component === undefined) continue;

      for (const field of networkedFields) {
        const key = `${def.componentName}.${field}`;
        const value = component[field];
        if (!this._lastSent.has(key) || this._lastSent.get(key) !== value) {
          this._lastSent.set(key, value);
          const payload: NetworkSyncPayload = {
            networkId: this._localId,
            componentName: def.componentName,
            field,
            value,
          };
          this._room.send(this._messageType, payload);
        }
      }
    }
  }

  /** Look up the local `Entity` mirroring a network id, if any. */
  getEntity(networkId: string): Entity | undefined {
    return this.entities.getEntity(networkId);
  }

  /** Look up the network id a local `Entity` was registered under, if any. */
  getNetworkId(entity: Entity): string | undefined {
    return this.entities.getNetworkId(entity);
  }

  /** Stop listening to the collection's onAdd/onRemove. Does not disconnect the room. */
  destroy(): void {
    this._unbindCollection?.();
    this._unbindCollection = undefined;
  }
}
