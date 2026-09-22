[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / MapEventSystem

# Class: MapEventSystem

Defined in: [engine/src/systems/MapEventSystem.ts:48](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/MapEventSystem.ts#L48)

## Constructors

### Constructor

> **new MapEventSystem**(`store?`): `MapEventSystem`

Defined in: [engine/src/systems/MapEventSystem.ts:63](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/MapEventSystem.ts#L63)

#### Parameters

##### store?

[`VariableStore`](VariableStore.md) = `variableStore`

The `VariableStore` used to gate `when`-conditioned events
and to apply `set-variable` / `set-switch` commands. Defaults to the
shared `variableStore` singleton; pass a different instance for isolated
testing or a per-save-slot store.

#### Returns

`MapEventSystem`

## Methods

### addEvent()

> **addEvent**(`event`): `void`

Defined in: [engine/src/systems/MapEventSystem.ts:72](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/MapEventSystem.ts#L72)

#### Parameters

##### event

[`MapEvent`](../interfaces/MapEvent.md)

#### Returns

`void`

***

### clear()

> **clear**(): `void`

Defined in: [engine/src/systems/MapEventSystem.ts:196](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/MapEventSystem.ts#L196)

#### Returns

`void`

***

### destroy()

> **destroy**(): `void`

Defined in: [engine/src/systems/MapEventSystem.ts:203](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/MapEventSystem.ts#L203)

#### Returns

`void`

***

### loadEvents()

> **loadEvents**(`events`): `void`

Defined in: [engine/src/systems/MapEventSystem.ts:80](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/MapEventSystem.ts#L80)

#### Parameters

##### events

[`MapEvent`](../interfaces/MapEvent.md)[]

#### Returns

`void`

***

### removeEvent()

> **removeEvent**(`id`): `void`

Defined in: [engine/src/systems/MapEventSystem.ts:76](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/MapEventSystem.ts#L76)

#### Parameters

##### id

`string`

#### Returns

`void`

***

### setHandler()

> **setHandler**(`handler`): `void`

Defined in: [engine/src/systems/MapEventSystem.ts:68](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/MapEventSystem.ts#L68)

Register the handler that executes each command

#### Parameters

##### handler

[`EventCommandHandler`](../type-aliases/EventCommandHandler.md)

#### Returns

`void`

***

### toJSON()

> **toJSON**(): [`MapEvent`](../interfaces/MapEvent.md)[]

Defined in: [engine/src/systems/MapEventSystem.ts:210](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/MapEventSystem.ts#L210)

Serialize all events (for saving in emptysock.project.json)

#### Returns

[`MapEvent`](../interfaces/MapEvent.md)[]

***

### update()

> **update**(`playerTileX`, `playerTileY`, `actionPressed`): `void`

Defined in: [engine/src/systems/MapEventSystem.ts:86](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/MapEventSystem.ts#L86)

Call each frame; tileX/tileY = player tile position; actionPressed = action button was pressed this frame

#### Parameters

##### playerTileX

`number`

##### playerTileY

`number`

##### actionPressed

`boolean`

#### Returns

`void`
