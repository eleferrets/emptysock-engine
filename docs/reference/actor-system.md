# ActorSystem

The Actor Model is EmptySock's mechanism for decoupled, message-driven game logic. This page is the full API reference for `Actor`, `ActorSystem`, `NetworkActor`, and `Transport`.

For a conceptual introduction and usage patterns, see the [Actors and Networking guide](../guides/actors-and-networking.md).

---

## Actor

`Actor` is the base class for objects that communicate via message-passing.

Import: `import { Actor, type Message } from '@emptysock/engine';`

### Constructor

```typescript
const actor = new MyActor("unique-id");
```

The string ID must be unique within the `ActorSystem` it is registered with. Registering a duplicate ID throws.

### Methods to override

| Method    | Signature              | Description                                                                                  |
| --------- | ---------------------- | -------------------------------------------------------------------------------------------- |
| `receive` | `(msg: Message): void` | Called for every message in the inbox. Called synchronously during `ActorSystem.update(dt)`. |
| `update`  | `(dt: number): void`   | Called every frame, after all inboxes are drained.                                           |

### Lifecycle

| Method            | Description                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------- |
| `actor.stop()`    | Marks `isRunning = false`. Future `update()` calls are skipped. The actor stays registered. |
| `actor.isRunning` | `boolean` — whether the actor receives `update()` calls                                     |

### Sending from inside an actor

Inside `receive()` or `update()`, an actor can send messages to itself or others through the ActorSystem reference it received at registration:

```typescript
// Actors receive a ref to their system when registered
this.system.send("other-actor", { type: "HELLO" });
```

---

## ActorSystem

`ActorSystem` owns actor registration, message dispatch, and the inbox-drain-before-update loop.

Import: `import { ActorSystem } from '@emptysock/engine';`

**Create one ActorSystem per scene.** Create it in `onLoad`, call `update(dt)` in `onUpdate`, call `destroy()` in `onDestroy`. A shared ActorSystem that persists across scenes will process stale messages from actors that belong to an unloaded scene.

### `system.register(actor: Actor): void`

Register an actor. Throws if an actor with the same ID is already registered.

```typescript
const system = new ActorSystem();
system.register(new EnemyActor("enemy-1"));
```

### `system.unregister(id: string): void`

Remove an actor from the registry. Pending messages are discarded.

### `system.send(id: string, msg: Message): void`

Queue a message for the actor with the given ID. The message is processed during the next `update()` call.

```typescript
system.send("enemy-1", { type: "TAKE_DAMAGE", amount: 25 });
```

### `system.broadcast(msg: Message): void`

Queue the message for all registered actors. O(n actors).

```typescript
system.broadcast({ type: "FREEZE", duration: 3.0 });
```

> For frequent per-frame messages, prefer targeted `send()` to specific IDs over `broadcast()`.

### `system.update(dt: number): void`

1. Drains every actor's inbox (calls `receive()` for each message).
2. Calls `update(dt)` on every running actor.

**Ordering guarantee:** All messages sent in frame N are processed before any actor's frame-N `update()` runs. Messages sent during `receive()` are processed in the same flush pass — not deferred to the next frame.

```typescript
// In your scene's onUpdate:
system.update(dt);
```

### `system.destroy(): void`

Clears all actors and their message queues.

---

## NetworkActor

`NetworkActor` extends `Actor` with a pluggable `Transport`. It routes incoming transport messages into `receive()` and exposes `sendRemote()` for outbound messages.

Import: `import { NetworkActor } from '@emptysock/engine';`

### `actor.setTransport(transport: Transport): void`

Wire in a `Transport` implementation. Hooks `onReceive` to route remote messages into `receive()`.

```typescript
const transport = new WebSocketTransport("wss://game.example.com/ws");
await transport.connect();
actor.setTransport(transport);
```

### `actor.sendRemote(channel: string, msg: Record<string, unknown>): void`

Send a message to remote peers via the transport.

---

## Transport

`Transport` is an interface — not a class. Implement it for whatever network layer you use. The engine never ships a concrete transport.

Import: `import { type Transport, type TransportMessage } from '@emptysock/engine';`

### Interface

```typescript
interface Transport {
  connect(): Promise<void>;
  disconnect(): void;
  send(actorId: string, msg: Record<string, unknown>): void;
  onReceive(handler: (payload: TransportMessage) => void): void;
}
```

### TransportMessage

```typescript
interface TransportMessage {
  actorId: string;
  msg: Record<string, unknown>;
}
```

### Example: WebSocket implementation

```typescript
import { type Transport, type TransportMessage } from "@emptysock/engine";

class WebSocketTransport implements Transport {
  private _ws: WebSocket;
  private _handler: ((p: TransportMessage) => void) | null = null;

  constructor(url: string) {
    this._ws = new WebSocket(url);
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this._ws.onopen = () => resolve();
      this._ws.onerror = (e) => reject(e);
      this._ws.onmessage = (e) => {
        const payload = JSON.parse(e.data as string) as TransportMessage;
        this._handler?.(payload);
      };
    });
  }

  disconnect(): void {
    this._ws.close();
  }

  send(actorId: string, msg: Record<string, unknown>): void {
    this._ws.send(JSON.stringify({ actorId, msg }));
  }

  onReceive(handler: (payload: TransportMessage) => void): void {
    this._handler = handler;
  }
}
```
