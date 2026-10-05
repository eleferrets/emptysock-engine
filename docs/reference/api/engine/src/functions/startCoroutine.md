[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / startCoroutine

# Function: startCoroutine()

> **startCoroutine**(`entity`, `factory`, `id?`): [`CoroutineHandle`](../interfaces/CoroutineHandle.md)

Defined in: engine/src/Coroutines.ts:110

Start a coroutine on `entity`. The coroutine is stopped automatically the
instant the entity is no longer alive (checked every `updateCoroutines()`
call) — game code never has to manually stop a coroutine on entity
destroy.

## Parameters

### entity

[`Entity`](../classes/Entity.md)

### factory

[`CoroutineFactory`](../type-aliases/CoroutineFactory.md)

### id?

`string`

## Returns

[`CoroutineHandle`](../interfaces/CoroutineHandle.md)

## Example

```typescript
entity.startCoroutine(function* () {
  yield waitSeconds(1.0);
  doSomething();
});

// Opt into abort-on-destroy for real async work:
entity.startCoroutine(function* (signal) {
  const res = yield* awaitFetch(fetch("/api/loot", { signal }));
  doSomethingWith(res);
});
```
