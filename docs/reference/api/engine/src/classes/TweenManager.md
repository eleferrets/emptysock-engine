[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / TweenManager

# Class: TweenManager

Defined in: engine/src/systems/TweenSystem.ts:37

## Constructors

### Constructor

> **new TweenManager**(): `TweenManager`

#### Returns

`TweenManager`

## Methods

### after()

> **after**(`seconds`, `fn`): [`TweenHandle`](../interfaces/TweenHandle.md)

Defined in: engine/src/systems/TweenSystem.ts:78

Call `fn` once after `seconds`. Returns a handle whose `cancel()` prevents
the callback from firing.

#### Parameters

##### seconds

`number`

##### fn

() => `void`

#### Returns

[`TweenHandle`](../interfaces/TweenHandle.md)

***

### destroy()

> **destroy**(): `void`

Defined in: engine/src/systems/TweenSystem.ts:163

#### Returns

`void`

***

### every()

> **every**(`seconds`, `fn`): [`TweenHandle`](../interfaces/TweenHandle.md)

Defined in: engine/src/systems/TweenSystem.ts:99

Call `fn` repeatedly every `seconds`. Returns a handle whose `cancel()`
stops further calls.

#### Parameters

##### seconds

`number`

##### fn

() => `void`

#### Returns

[`TweenHandle`](../interfaces/TweenHandle.md)

***

### killAll()

> **killAll**(): `void`

Defined in: engine/src/systems/TweenSystem.ts:158

#### Returns

`void`

***

### to()

> **to**(`target`, `props`, `options`): [`TweenHandle`](../interfaces/TweenHandle.md)

Defined in: engine/src/systems/TweenSystem.ts:45

Animate numeric properties of `target` to the values in `props` over time.
Returns a handle whose `cancel()` stops the tween immediately.

#### Parameters

##### target

`Record`\<`string`, `number`\>

##### props

`Record`\<`string`, `number`\>

##### options

[`TweenOptions`](../interfaces/TweenOptions.md)

#### Returns

[`TweenHandle`](../interfaces/TweenHandle.md)

***

### update()

> **update**(`deltaTime`): `void`

Defined in: engine/src/systems/TweenSystem.ts:116

#### Parameters

##### deltaTime

`number`

#### Returns

`void`
