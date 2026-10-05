[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / UpdateFn

# Type Alias: UpdateFn

> **UpdateFn** = (`dt`) => `void`

Defined in: engine/src/Game.ts:37

A game-defined update hook. TypeScript enforces the engine design notes's
"onUpdate cannot be async" at compile time by typing this as returning
`void`, not `Promise<void>` — a TS caller declaring `async onUpdate` gets
a type error, not a runtime footgun. JS callers get no compile-time check,
so `Game.update()` also does a dev-mode runtime check (see `_warnIfAsync`).

## Parameters

### dt

`number`

## Returns

`void`
