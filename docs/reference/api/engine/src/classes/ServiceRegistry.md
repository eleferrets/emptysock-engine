[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / ServiceRegistry

# Class: ServiceRegistry

Defined in: engine/src/Services.ts:33

```ts
class ScoreService {
  score = 0;
  add(n: number) { this.score += n; }
}

game.services.register(ScoreService);
const score = game.services.get(ScoreService); // typed as ScoreService
score.add(10);
```

## Constructors

### Constructor

> **new ServiceRegistry**(): `ServiceRegistry`

#### Returns

`ServiceRegistry`

## Methods

### get()

> **get**\<`T`\>(`ctor`): `T`

Defined in: engine/src/Services.ts:63

Retrieve a previously-registered instance with a real type, no casting
needed at the call site. Throws if `ctor` was never registered — a
missing service is a wiring bug, not a value a caller should have to
null-check every time.

#### Type Parameters

##### T

`T`

#### Parameters

##### ctor

[`ServiceConstructor`](../type-aliases/ServiceConstructor.md)\<`T`\>

#### Returns

`T`

***

### has()

> **has**\<`T`\>(`ctor`): `boolean`

Defined in: engine/src/Services.ts:74

`true` if `ctor` has been registered.

#### Type Parameters

##### T

`T`

#### Parameters

##### ctor

[`ServiceConstructor`](../type-aliases/ServiceConstructor.md)\<`T`\>

#### Returns

`boolean`

***

### register()

> **register**\<`T`\>(`ctor`): `T`

Defined in: engine/src/Services.ts:44

Construct and store one instance, keyed by the class itself (not a
string name — no typo-prone lookups, no ambiguity between two classes
that happen to share a name). Re-registering the same class is a no-op
that returns the existing instance and logs a warning, rather than
silently replacing state other code may already be holding a reference
into.

#### Type Parameters

##### T

`T`

#### Parameters

##### ctor

[`ServiceConstructor`](../type-aliases/ServiceConstructor.md)\<`T`\>

#### Returns

`T`

***

### unregister()

> **unregister**\<`T`\>(`ctor`): `void`

Defined in: engine/src/Services.ts:79

Drop a registered instance. Mainly useful for tests.

#### Type Parameters

##### T

`T`

#### Parameters

##### ctor

[`ServiceConstructor`](../type-aliases/ServiceConstructor.md)\<`T`\>

#### Returns

`void`
