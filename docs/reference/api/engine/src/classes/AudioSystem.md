[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / AudioSystem

# Class: AudioSystem

Defined in: [engine/src/systems/AudioSystem.ts:9](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/AudioSystem.ts#L9)

## Constructors

### Constructor

> **new AudioSystem**(): `AudioSystem`

#### Returns

`AudioSystem`

## Properties

### defaultBuses

> `readonly` **defaultBuses**: readonly \[`"master"`, `"music"`, `"sfx"`, `"voice"`, `"ambient"`\]

Defined in: [engine/src/systems/AudioSystem.ts:49](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/AudioSystem.ts#L49)

## Accessors

### activeSnapshotTransitioning

#### Get Signature

> **get** **activeSnapshotTransitioning**(): `boolean`

Defined in: [engine/src/systems/AudioSystem.ts:172](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/AudioSystem.ts#L172)

##### Returns

`boolean`

***

### masterVolume

#### Get Signature

> **get** **masterVolume**(): `number`

Defined in: [engine/src/systems/AudioSystem.ts:14](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/AudioSystem.ts#L14)

##### Returns

`number`

#### Set Signature

> **set** **masterVolume**(`v`): `void`

Defined in: [engine/src/systems/AudioSystem.ts:18](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/AudioSystem.ts#L18)

##### Parameters

###### v

`number`

##### Returns

`void`

## Methods

### defineSnapshot()

> **defineSnapshot**(`name`, `busVolumes`): `void`

Defined in: [engine/src/systems/AudioSystem.ts:149](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/AudioSystem.ts#L149)

Register a named volume preset across buses (missing buses are left unchanged).

#### Parameters

##### name

`string`

##### busVolumes

`Record`\<`string`, `number`\>

#### Returns

`void`

***

### destroy()

> **destroy**(): `void`

Defined in: [engine/src/systems/AudioSystem.ts:202](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/AudioSystem.ts#L202)

#### Returns

`void`

***

### duck()

> **duck**(`bus`, `amount`, `fadeTime?`): `void`

Defined in: [engine/src/systems/AudioSystem.ts:116](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/AudioSystem.ts#L116)

Temporarily lower `bus`'s volume to `bus base volume * (1 - amount)`,
fading over `fadeTime` seconds, for as long as the duck is active.
Call `endDuck(bus)` to fade back to the base volume. Re-ducking a bus
that is already ducked replaces the previous duck.

#### Parameters

##### bus

`string`

##### amount

`number`

##### fadeTime?

`number` = `0.15`

#### Returns

`void`

***

### endDuck()

> **endDuck**(`bus`, `fadeTime?`): `void`

Defined in: [engine/src/systems/AudioSystem.ts:128](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/AudioSystem.ts#L128)

Fade a ducked bus back to its pre-duck base volume.

#### Parameters

##### bus

`string`

##### fadeTime?

`number` = `0.15`

#### Returns

`void`

***

### getBusVolume()

> **getBusVolume**(`busId`): `number`

Defined in: [engine/src/systems/AudioSystem.ts:42](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/AudioSystem.ts#L42)

#### Parameters

##### busId

`string`

#### Returns

`number`

***

### getGroupVolume()

> **getGroupVolume**(`group`): `number`

Defined in: [engine/src/systems/AudioSystem.ts:34](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/AudioSystem.ts#L34)

#### Parameters

##### group

`string`

#### Returns

`number`

***

### isDucked()

> **isDucked**(`bus`): `boolean`

Defined in: [engine/src/systems/AudioSystem.ts:139](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/AudioSystem.ts#L139)

#### Parameters

##### bus

`string`

#### Returns

`boolean`

***

### load()

> **load**(`id`, `src`, `options?`): `Howl`

Defined in: [engine/src/systems/AudioSystem.ts:57](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/AudioSystem.ts#L57)

#### Parameters

##### id

`string`

##### src

`string`

##### options?

[`SoundOptions`](../interfaces/SoundOptions.md) = `{}`

#### Returns

`Howl`

***

### pause()

> **pause**(`id`): `void`

Defined in: [engine/src/systems/AudioSystem.ts:84](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/AudioSystem.ts#L84)

#### Parameters

##### id

`string`

#### Returns

`void`

***

### play()

> **play**(`id`): `number` \| `null`

Defined in: [engine/src/systems/AudioSystem.ts:71](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/AudioSystem.ts#L71)

#### Parameters

##### id

`string`

#### Returns

`number` \| `null`

***

### setBusVolume()

> **setBusVolume**(`busId`, `volume`): `void`

Defined in: [engine/src/systems/AudioSystem.ts:38](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/AudioSystem.ts#L38)

#### Parameters

##### busId

`string`

##### volume

`number`

#### Returns

`void`

***

### setGroupVolume()

> **setGroupVolume**(`group`, `volume`): `void`

Defined in: [engine/src/systems/AudioSystem.ts:23](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/AudioSystem.ts#L23)

#### Parameters

##### group

`string`

##### volume

`number`

#### Returns

`void`

***

### stop()

> **stop**(`id`): `void`

Defined in: [engine/src/systems/AudioSystem.ts:80](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/AudioSystem.ts#L80)

#### Parameters

##### id

`string`

#### Returns

`void`

***

### transitionToSnapshot()

> **transitionToSnapshot**(`name`, `duration?`): `void`

Defined in: [engine/src/systems/AudioSystem.ts:154](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/AudioSystem.ts#L154)

Transition every bus in the snapshot to its stored volume over `duration` seconds.

#### Parameters

##### name

`string`

##### duration?

`number` = `0.5`

#### Returns

`void`

***

### unload()

> **unload**(`id`): `void`

Defined in: [engine/src/systems/AudioSystem.ts:88](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/AudioSystem.ts#L88)

#### Parameters

##### id

`string`

#### Returns

`void`

***

### unloadAll()

> **unloadAll**(): `void`

Defined in: [engine/src/systems/AudioSystem.ts:96](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/AudioSystem.ts#L96)

#### Returns

`void`

***

### update()

> **update**(`dt`): `void`

Defined in: [engine/src/systems/AudioSystem.ts:176](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/AudioSystem.ts#L176)

#### Parameters

##### dt

`number`

#### Returns

`void`
