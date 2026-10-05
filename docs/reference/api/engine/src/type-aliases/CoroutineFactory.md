[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / CoroutineFactory

# Type Alias: CoroutineFactory

> **CoroutineFactory** = [`CoroutineGen`](CoroutineGen.md) \| (() => [`CoroutineGen`](CoroutineGen.md)) \| ((`signal`) => [`CoroutineGen`](CoroutineGen.md))

Defined in: engine/src/Coroutines.ts:27

A generator factory that also accepts an `AbortSignal`, so a coroutine
body that kicks off real async work (a `fetch`, a `postMessage`
round-trip) can pass the signal straight through and have it abort
automatically when the owning entity is destroyed — see the module doc
comment below for why this is a signal the coroutine body opts into,
not something the scheduler forces on every yield.
