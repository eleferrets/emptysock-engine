# 19 — Multiplayer Boilerplate

This section shows how to add multiplayer to an EmptySock game using the Transport injection pattern.

---

## Transport is an interface, not a class

`NetworkActor` accepts a `Transport` interface. The engine does not ship a concrete WebSocket or WebRTC implementation — see [CLAUDE.md](../../CLAUDE.md) for the rationale (bundle size). Your game code provides the concrete implementation and injects it at runtime.

The `Transport` interface (from `@emptysock/engine`):

```ts
export interface Transport {
  send(data: string): void;
  onMessage(handler: (data: string) => void): void;
  close(): void;
}
```

---

## Minimal WebSocket transport

The following implementation satisfies the `Transport` interface using the browser's built-in `WebSocket`. It is safe to write in game code because it never imports from the engine package — it only implements the interface shape.

```ts
import type { Transport } from "@emptysock/engine";

export class WebSocketTransport implements Transport {
  private readonly socket: WebSocket;
  private messageHandler: ((data: string) => void) | null = null;

  constructor(url: string) {
    this.socket = new WebSocket(url);

    this.socket.addEventListener("message", (event) => {
      if (typeof event.data === "string" && this.messageHandler !== null) {
        this.messageHandler(event.data);
      }
    });

    this.socket.addEventListener("error", (event) => {
      console.error("WebSocketTransport error", event);
    });
  }

  send(data: string): void {
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(data);
    }
  }

  onMessage(handler: (data: string) => void): void {
    this.messageHandler = handler;
  }

  close(): void {
    this.socket.close();
  }
}
```

The implementation is intentionally minimal. Production code should handle reconnection, binary framing, and message queuing before the socket is open.

---

## Wiring the transport into NetworkActor

Create a `NetworkActor`, pass the transport, and register the actor with the scene's `ActorSystem` in `onLoad`:

```ts
import { Scene, NetworkActor, ActorSystem } from "@emptysock/engine";
import { WebSocketTransport } from "./WebSocketTransport";

export class MultiplayerScene extends Scene {
  private actorSystem: ActorSystem | null = null;

  onLoad(): void {
    this.actorSystem = new ActorSystem();

    const transport = new WebSocketTransport("wss://your-server/game");
    const netActor = new NetworkActor(transport);

    this.actorSystem.register(netActor);
  }

  onUpdate(dt: number): void {
    this.actorSystem?.update(dt);
  }

  onDestroy(): void {
    this.actorSystem?.destroy();
    this.actorSystem = null;
  }
}
```

---

## ActorSystem ordering

Because `ActorSystem` drains every actor's inbox before calling `update()` on any actor (see [06-actor-model.md](06-actor-model.md)), all messages arriving from the network transport during frame N are fully processed before any actor's `update()` runs for that frame. This means your game logic always sees a consistent snapshot of network state at the start of each `update()` call.

Do not create a shared `ActorSystem` that persists across scenes. Create a new one in `onLoad` and destroy it in `onDestroy`. A persistent `ActorSystem` would process stale messages from actors belonging to unloaded scenes.
