# 6 — Actor Model & Multiplayer

The Actor Model is EmptySock's mechanism for decoupled, message-driven game logic. It is also the foundation for multiplayer: swapping in a network transport is the only change needed to route messages over the wire.

---

## 6.1 Why actors

Traditional game code has objects that call each other's methods directly. This creates tight coupling: `enemy.takeDamage(10)` requires a reference to `enemy`, and the caller can inspect all of `enemy`'s fields. As the codebase grows this becomes an implicit shared-state problem — any code anywhere can mutate any object.

Actors replace direct calls with messages. `system.send('enemy-1', { type: 'TAKE_DAMAGE', amount: 10 })` requires only the actor's ID. The actor's internal state is private. The interaction graph is the set of message types, which is explicit and auditable.

---

## 6.2 Defining an Actor

```typescript
import { Actor, type Message, type ActorId } from "@emptysock/engine";

// Define message types for this actor:
type EnemyMessage =
  | { type: "TAKE_DAMAGE"; amount: number }
  | { type: "HEAL"; amount: number }
  | { type: "STUN"; duration: number };

class EnemyActor extends Actor {
  private _health = 100;
  private _stunTimer = 0;

  // receive() is called for every message in the mailbox.
  // It is called synchronously during ActorSystem.update(dt).
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

  // update() runs every frame, after the mailbox is drained.
  update(dt: number): void {
    if (this._stunTimer > 0) {
      this._stunTimer -= dt;
      return; // stunned, skip AI
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

## 6.3 ActorSystem

```typescript
import { ActorSystem } from "@emptysock/engine";

const system = new ActorSystem();

// Register an actor:
const enemy = new EnemyActor("enemy-1");
system.register(enemy); // throws if 'enemy-1' is already registered

// Send a message (queued, processed next update):
system.send("enemy-1", { type: "TAKE_DAMAGE", amount: 25 });

// Broadcast to all registered actors:
system.broadcast({ type: "FREEZE", duration: 3.0 });

// In your game loop:
system.update(dt); // flushes all mailboxes, then calls update(dt) on running actors

// Remove an actor:
system.unregister("enemy-1");

// Destroy all actors and clear the registry:
system.destroy();
```

**Ordering guarantee:** Messages sent in frame N are processed in frame N's `update()` call — specifically, all inboxes are drained before any `update()` runs. Messages sent _during_ an actor's `receive()` are processed in the same flush pass (the inbox is drained until empty).

**Performance:** `broadcast()` is O(n actors). For frequent per-frame messages (input state, tick), prefer targeted `send()` to specific actor IDs.

**One ActorSystem per scene.** Create it in `onLoad`, call `update(dt)` in `onUpdate`, call `destroy()` in `onDestroy`.

---

## 6.4 NetworkActor

`NetworkActor` extends `Actor` with a pluggable `Transport`. It does not add networking knowledge to the actor itself — it simply routes incoming transport messages into `receive()` and exposes `sendRemote()` for outbound messages.

```typescript
import {
  NetworkActor,
  type Transport,
  type TransportMessage,
} from "@emptysock/engine";

class MultiplayerEnemyActor extends NetworkActor {
  receive(msg: Message): void {
    // Handles BOTH local messages (from system.send)
    // AND remote messages (from the transport).
    // The actor cannot distinguish which source.
    if ((msg as any).type === "TAKE_DAMAGE") {
      /* ... */
    }
  }

  broadcastToAll(msg: Message): void {
    // Send to all remote peers:
    this.sendRemote("broadcast", msg as unknown as Record<string, unknown>);
    // Also handle locally:
    this.send(msg);
  }
}
```

---

## 6.5 Transport interface

`Transport` is an interface. You implement it for whatever network layer you use — WebSocket, WebRTC data channels, a local loopback for testing, etc. The engine never imports a concrete transport.

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
        const payload = JSON.parse(e.data) as TransportMessage;
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
system.register(actor);
```

> **Tip:** For local testing, implement a `LoopbackTransport` that immediately calls its own handler with sent messages. This lets you test the full multiplayer message flow without a server.

---

## 6.6 Testing actors

Because actors communicate only via messages, testing is straightforward:

```typescript
test("enemy takes damage", () => {
  const system = new ActorSystem();
  const enemy = new EnemyActor("e");
  system.register(enemy);
  system.send("e", { type: "TAKE_DAMAGE", amount: 40 });
  system.update(0.016);
  expect((enemy as any)._health).toBe(60);
});
```
