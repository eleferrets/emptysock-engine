# SignalBus

Game-wide named signals. One instance per `Game` (`game.signals`, `ctx.signals` in a scene).

```ts
const off = ctx.signals.on<{ id: number }>("player-died", (p) => respawn(p.id));
ctx.signals.emit("player-died", { id: 3 });
off();
```

- `on` / `once` / `off` / `onAny` (wildcard tap) / `emit` (returns listener count) / `broadcast(payload)` (every signal with listeners).
- `bus.group()` returns a `SignalGroup`; call `dispose()` in `onDestroy` to remove everything the scene subscribed.
- A throwing listener does not stop the rest; errors are re-thrown together as an `AggregateError`.
- Dispatch is synchronous and nested emits run immediately.
