# Actors and Networking

The **Actor Model** is EmptySock's mechanism for decoupled, message-driven game logic. It's also the foundation for multiplayer: swapping in a network transport is the only change required to route messages over a network.

For the complete API, see [ActorSystem reference](../reference/actor-system.md).

> **Heads up:** the `Transport` pattern below is the engine-level building block. If you're using `@emptysock/engine/v2` and want real state replication rather than hand-rolled message routing, the optional `@emptysock/network` package (Colyseus-based) now has a proper way to mark replicated fields with `networked(componentDef, ["field", ...])`. See [What's New in v2](../getting-started/whats-new-v2.md) and the troubleshooting entry on strict-equality dirty checking if a networked field ever seems to stop syncing.

---

## Why use actors?

Traditional game code has objects that call each other's methods directly. That creates tight coupling: `enemy.takeDamage(10)` requires a reference to `enemy`, and the caller can poke around in all of `enemy`'s fields while it's at it. As the codebase grows, this quietly turns into an implicit shared-state problem.

Actors replace direct calls with messages. `system.send('enemy-1', { type: 'TAKE_DAMAGE', amount: 10 })` requires only the actor's ID. The actor's internal state is private. The interaction graph is the set of message types, which is explicit and auditable.

> The Actor Model is optional. Small games can put all logic in `onUpdate()`. Reach for actors when you need clear communication channels between independent game systems, or when you want to test logic in isolation.

---

## Defining an Actor

```typescript
import { Actor, type Message } from "@emptysock/engine";

type EnemyMessage =
  | { type: "TAKE_DAMAGE"; amount: number }
  | { type: "HEAL"; amount: number }
  | { type: "STUN"; duration: number };

class EnemyActor extends Actor {
  private _health = 100;
  private _stunTimer = 0;

  receive(msg: Message): void {
    const m = msg as unknown as EnemyMessage;
    if (m.type === "TAKE_DAMAGE") {
      this._health -= m.amount;
      if (this._health <= 0) this.die();
    } else if (m.type === "HEAL") {
      this._health = Math.min(100, this._health + m.amount);
    } else if (m.type === "STUN") {
      this._stunTimer = m.duration;
    }
  }

  update(dt: number): void {
    if (this._stunTimer > 0) {
      this._stunTimer -= dt;
      return;
    }
    this.runAI(dt);
  }

  private runAI(dt: number): void {
    /* ... */
  }
  private die(): void {
    this.stop(); // marks isRunning = false, skips future updates
  }
}
```

---

## ActorSystem

Create one `ActorSystem` per scene. Always destroy it in `onDestroy` — a shared `ActorSystem` that persists across scenes will process stale messages from actors that belong to an unloaded scene.

```typescript
import { ActorSystem } from "@emptysock/engine";

export class GameScene extends Scene {
  private _actors!: ActorSystem;

  override async onLoad(): Promise<void> {
    this._actors = new ActorSystem();

    const enemy = new EnemyActor("enemy-1");
    this._actors.register(enemy);
  }

  override onUpdate(dt: number): void {
    // Send messages:
    this._actors.send("enemy-1", { type: "TAKE_DAMAGE", amount: 25 });

    // Drive the system (flushes mailboxes, then calls update on all actors):
    this._actors.update(dt);
  }

  override onDestroy(): void {
    this._actors.destroy();
  }
}
```

**Ordering guarantee:** Messages sent in frame N are processed in frame N's `update()` call — all inboxes are drained before any `update()` runs. Messages sent during an actor's `receive()` are processed in the same flush pass.

### Broadcast

```typescript
// Send a message to all registered actors:
this._actors.broadcast({ type: "FREEZE", duration: 3.0 });
```

`broadcast()` is O(n actors). For frequent per-frame messages, prefer targeted `send()` to specific actor IDs.

---

## NetworkActor

`NetworkActor` extends `Actor` with a pluggable `Transport`. It routes incoming transport messages into `receive()` and exposes `sendRemote()` for outbound messages. The actor cannot distinguish whether a message came from local code or over the network.

```typescript
import { NetworkActor, type Transport } from "@emptysock/engine";

class MultiplayerEnemyActor extends NetworkActor {
  receive(msg: Message): void {
    // Handles both local messages (from system.send)
    // and remote messages (from the transport).
  }

  broadcastToAll(msg: Message): void {
    this.sendRemote("broadcast", msg as unknown as Record<string, unknown>);
    this.send(msg); // also handle locally
  }
}
```

---

## Transport

`Transport` is an interface. You implement it for whatever network layer you use. The engine never ships a concrete transport — games that have no multiplayer should not pay for the weight of a WebSocket client or WebRTC stack.

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

**Wiring the transport:**

```typescript
const transport = new WebSocketTransport("wss://game.example.com/ws");
await transport.connect();

const actor = new MultiplayerEnemyActor("remote-enemy");
actor.setTransport(transport); // hooks onReceive
this._actors.register(actor);
```

> For local testing, implement a `LoopbackTransport` that immediately calls its own handler with sent messages. This lets you test the full multiplayer message flow without a server.

---

## Testing actors

Because actors communicate only via messages, testing is straightforward:

```typescript
test("enemy takes damage", () => {
  const system = new ActorSystem();
  const enemy = new EnemyActor("e");
  system.register(enemy);
  system.send("e", { type: "TAKE_DAMAGE", amount: 40 });
  system.update(0.016);
  expect((enemy as unknown as { _health: number })._health).toBe(60);
});
```
