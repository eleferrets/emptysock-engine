[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / GameSignals

# Interface: GameSignals

Defined in: engine/src/systems/SignalBus.ts:23

Game-wide signal/broadcast bus. Any code holding the `Game` (or a scene's
`ctx.signals`) can `emit` a named signal with a payload and every listener
registered under that name is called synchronously, in registration order.
Augment `GameSignals` to type names/payloads:

    declare module "@emptysock/engine" { interface GameSignals { "player-died": { id: number } } }

`broadcast` reaches every listener of every signal (the "wildcard" tap used
by debugging tools). `SignalGroup` gives a scene a single `dispose()` that
removes everything it subscribed, so a scene's `onDestroy` cannot leak
handlers into the next scene (same stale-registration hazard as
ActorSystem, see CLAUDE.md).

A listener throwing never blocks the other listeners; the error is
collected and re-thrown as one AggregateError after all have run.
Emitting from inside a listener is allowed and dispatched immediately
(nested), so an emit-loop on the same signal is the caller's to avoid.

## Indexable

> \[`name`: `string`\]: `unknown`
