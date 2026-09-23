import { describe, expect, it, beforeEach } from "vitest";
import { defineComponent, Scene } from "@emptysock/engine";
import { networked, clearNetworkedFields } from "../NetworkedFields.js";
import { NetworkSystem } from "../NetworkSystem.js";
import type {
  CallbackProxyFn,
  GetStateCallbacksFn,
  RoomLike,
} from "../colyseusTypes.js";

/**
 * A minimal fake of colyseus.js's `getStateCallbacks(room)` / `$(instance)`
 * proxy, built directly from the real callback shapes confirmed against
 * colyseus.js's own docs (see `colyseusTypes.ts`'s header comment):
 * `$(room.state).players.onAdd/.onRemove`, `$(schemaInstance).listen(field, cb)`.
 * There is no official client-side testing helper for this (Colyseus ships
 * server-side room test utilities, not a fake client connection), so this
 * fixture stands in for a live server.
 */
class FakeMapSchema<T> {
  private readonly _items = new Map<string, T>();
  private readonly _addListeners = new Set<(item: T, key: string) => void>();
  private readonly _removeListeners = new Set<(item: T, key: string) => void>();

  onAdd(cb: (item: T, key: string) => void): () => void {
    this._addListeners.add(cb);
    return () => this._addListeners.delete(cb);
  }

  onRemove(cb: (item: T, key: string) => void): () => void {
    this._removeListeners.add(cb);
    return () => this._removeListeners.delete(cb);
  }

  add(key: string, item: T): void {
    this._items.set(key, item);
    for (const cb of this._addListeners) cb(item, key);
  }

  remove(key: string): void {
    const item = this._items.get(key);
    if (item === undefined) return;
    this._items.delete(key);
    for (const cb of this._removeListeners) cb(item, key);
  }
}

interface PlayerSchema {
  x: number;
  y: number;
  [field: string]: unknown;
}

class FakeRoomState {
  readonly players = new FakeMapSchema<PlayerSchema>();
}

class FakeRoom implements RoomLike {
  readonly state = new FakeRoomState();
  readonly sent: { type: string; payload: unknown }[] = [];
  constructor(readonly sessionId: string) {}
  send(type: string, payload: unknown): void {
    this.sent.push({ type, payload });
  }
}

/** Builds a fake `getStateCallbacks` bound to per-instance listener bookkeeping. */
function makeGetStateCallbacks(): GetStateCallbacksFn {
  const listenersByInstance = new WeakMap<
    object,
    Map<string, Set<(value: unknown, previous: unknown) => void>>
  >();

  const proxyFn: CallbackProxyFn = (<T>(instance: T) => {
    if (instance instanceof FakeMapSchema) {
      return instance as never;
    }
    const target = instance as object;
    let fieldListeners = listenersByInstance.get(target);
    if (fieldListeners === undefined) {
      fieldListeners = new Map();
      listenersByInstance.set(target, fieldListeners);
    }
    const fl = fieldListeners;
    return new Proxy(instance as object, {
      get(objTarget, prop: string | symbol) {
        if (prop === "listen") {
          return (field: string, cb: (v: unknown, p: unknown) => void) => {
            let set = fl.get(field);
            if (set === undefined) {
              set = new Set();
              fl.set(field, set);
            }
            set.add(cb);
            return () => set?.delete(cb);
          };
        }
        return Reflect.get(objTarget, prop);
      },
    }) as never;
  }) as CallbackProxyFn;

  // Expose a way for the test to fire a "field changed" event as if the
  // server pushed new state — mirrors what colyseus.js does internally
  // when it decodes an incoming patch and calls registered `listen` callbacks.
  (
    proxyFn as unknown as {
      _fire: (
        instance: object,
        field: string,
        value: unknown,
        previous: unknown,
      ) => void;
    }
  )._fire = (instance, field, value, previous) => {
    const set = listenersByInstance.get(instance)?.get(field);
    if (set === undefined) return;
    for (const cb of set) cb(value, previous);
  };

  return (() => proxyFn) as GetStateCallbacksFn;
}

describe("NetworkSystem", () => {
  const Position = defineComponent("Position", () => ({ x: 0, y: 0 }));
  networked(Position, ["x", "y"]);

  beforeEach(() => {
    // NetworkedFields is a module-level registry; keep tests independent
    // of registration order the way ComponentRegistry's own tests do.
    clearNetworkedFields();
    networked(Position, ["x", "y"]);
  });

  it("writes an inbound remote spawn through entity.get(Component), not bitECS internals", () => {
    const scene = new Scene();
    const room = new FakeRoom("local-session");
    const getStateCallbacks = makeGetStateCallbacks();

    const net = new NetworkSystem({
      scene,
      room,
      collection: "players",
      components: [Position],
      localId: room.sessionId,
      getStateCallbacks,
    });

    room.state.players.add("remote-session", { x: 10, y: 20 });

    const remoteEntity = net.getEntity("remote-session");
    expect(remoteEntity).toBeDefined();
    expect(remoteEntity?.get(Position)?.x).toBe(10);
    expect(remoteEntity?.get(Position)?.y).toBe(20);
  });

  it("applies a simulated state-sync update to the local entity mirror", () => {
    const scene = new Scene();
    const room = new FakeRoom("local-session");
    const getStateCallbacks = makeGetStateCallbacks();
    const $ = getStateCallbacks(room);

    const net = new NetworkSystem({
      scene,
      room,
      collection: "players",
      components: [Position],
      localId: room.sessionId,
      getStateCallbacks,
    });

    const schema: PlayerSchema = { x: 0, y: 0 };
    room.state.players.add("remote-session", schema);

    // Simulate the server pushing a patch for "x" on that schema instance.
    (
      $ as unknown as {
        _fire: (i: object, f: string, v: unknown, p: unknown) => void;
      }
    )._fire(schema, "x", 42, 0);

    expect(net.getEntity("remote-session")?.get(Position)?.x).toBe(42);
  });

  it("a local write to a networked field triggers an outbound sync call on the next sync()", () => {
    const scene = new Scene();
    const room = new FakeRoom("local-session");
    const getStateCallbacks = makeGetStateCallbacks();

    const net = new NetworkSystem({
      scene,
      room,
      collection: "players",
      components: [Position],
      localId: room.sessionId,
      getStateCallbacks,
    });

    room.state.players.add(room.sessionId, { x: 0, y: 0 });
    const localEntity = net.getEntity(room.sessionId);
    expect(localEntity).toBeDefined();

    const position = localEntity?.get(Position);
    expect(position).toBeDefined();
    if (position === undefined) throw new Error("unreachable");
    position.x = 99;

    net.sync();

    expect(room.sent).toContainEqual({
      type: "networkSync",
      payload: {
        networkId: room.sessionId,
        componentName: "Position",
        field: "x",
        value: 99,
      },
    });

    // Calling sync() again with no further local change sends nothing new.
    const sentCountAfterFirstSync = room.sent.length;
    net.sync();
    expect(room.sent.length).toBe(sentCountAfterFirstSync);
  });

  it("does not overwrite the local entity's own fields from inbound listen callbacks", () => {
    const scene = new Scene();
    const room = new FakeRoom("local-session");
    const getStateCallbacks = makeGetStateCallbacks();

    const net = new NetworkSystem({
      scene,
      room,
      collection: "players",
      components: [Position],
      localId: room.sessionId,
      getStateCallbacks,
    });

    room.state.players.add(room.sessionId, { x: 5, y: 5 });
    const localEntity = net.getEntity(room.sessionId);
    const position = localEntity?.get(Position);
    expect(position).toBeDefined();
    if (position === undefined) throw new Error("unreachable");
    position.x = 7;
    expect(position.x).toBe(7);
  });

  it("removes the local entity mirror when the remote entity despawns (entity-id <-> network-id round trip)", () => {
    const scene = new Scene();
    const room = new FakeRoom("local-session");
    const getStateCallbacks = makeGetStateCallbacks();

    const net = new NetworkSystem({
      scene,
      room,
      collection: "players",
      components: [Position],
      getStateCallbacks,
    });

    room.state.players.add("remote-session", { x: 1, y: 1 });
    const entity = net.getEntity("remote-session");
    expect(entity).toBeDefined();
    expect(entity?.isAlive).toBe(true);
    expect(net.getNetworkId(entity as NonNullable<typeof entity>)).toBe(
      "remote-session",
    );

    room.state.players.remove("remote-session");

    expect(net.getEntity("remote-session")).toBeUndefined();
    expect(entity?.isAlive).toBe(false);
  });

  it("reconcile() drops the mapping for an entity destroyed locally (not via onRemove)", () => {
    const scene = new Scene();
    const room = new FakeRoom("local-session");
    const getStateCallbacks = makeGetStateCallbacks();

    const net = new NetworkSystem({
      scene,
      room,
      collection: "players",
      components: [Position],
      getStateCallbacks,
    });

    room.state.players.add("remote-session", { x: 1, y: 1 });
    const entity = net.getEntity("remote-session");
    expect(entity).toBeDefined();
    if (entity === undefined) throw new Error("unreachable");

    // Local gameplay code destroys the entity directly — no onRemove fires.
    scene.destroy(entity);
    expect(entity.isAlive).toBe(false);
    // Mapping is still stale until reconciled.
    expect(net.entities.size).toBe(1);

    net.reconcile();

    expect(net.entities.size).toBe(0);
    expect(net.getEntity("remote-session")).toBeUndefined();
    expect(net.getNetworkId(entity)).toBeUndefined();
  });

  it("sync() reconciles a locally-destroyed entity before its dirty-check poll, preventing a stale alias", () => {
    const scene = new Scene();
    const room = new FakeRoom("local-session");
    const getStateCallbacks = makeGetStateCallbacks();

    const net = new NetworkSystem({
      scene,
      room,
      collection: "players",
      components: [Position],
      localId: room.sessionId,
      getStateCallbacks,
    });

    room.state.players.add("remote-session", { x: 1, y: 1 });
    const remoteEntity = net.getEntity("remote-session");
    expect(remoteEntity).toBeDefined();
    if (remoteEntity === undefined) throw new Error("unreachable");

    scene.destroy(remoteEntity);
    expect(net.entities.size).toBe(1);

    // A new spawn elsewhere in the same scene can now recycle the freed
    // rawId. Without reconciliation, the stale map entry would alias it.
    const unrelated = scene.spawn();
    unrelated.add(Position, { x: 0, y: 0 });

    net.sync();

    expect(net.getEntity("remote-session")).toBeUndefined();
  });
});
