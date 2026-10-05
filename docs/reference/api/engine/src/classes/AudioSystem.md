[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / AudioSystem

# Class: AudioSystem

Defined in: engine/src/systems/AudioSystem.ts:9

## Constructors

### Constructor

> **new AudioSystem**(): `AudioSystem`

#### Returns

`AudioSystem`

## Properties

### defaultBuses

> `readonly` **defaultBuses**: readonly \[`"master"`, `"music"`, `"sfx"`, `"voice"`, `"ambient"`\]

Defined in: engine/src/systems/AudioSystem.ts:49

## Accessors

### activeSnapshotTransitioning

#### Get Signature

> **get** **activeSnapshotTransitioning**(): `boolean`

Defined in: engine/src/systems/AudioSystem.ts:195

##### Returns

`boolean`

***

### masterVolume

#### Get Signature

> **get** **masterVolume**(): `number`

Defined in: engine/src/systems/AudioSystem.ts:14

##### Returns

`number`

#### Set Signature

> **set** **masterVolume**(`v`): `void`

Defined in: engine/src/systems/AudioSystem.ts:18

##### Parameters

###### v

`number`

##### Returns

`void`

## Methods

### defineSnapshot()

> **defineSnapshot**(`name`, `busVolumes`): `void`

Defined in: engine/src/systems/AudioSystem.ts:172

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

Defined in: engine/src/systems/AudioSystem.ts:225

#### Returns

`void`

***

### duck()

> **duck**(`bus`, `amount`, `fadeTime?`): `void`

Defined in: engine/src/systems/AudioSystem.ts:139

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

Defined in: engine/src/systems/AudioSystem.ts:151

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

Defined in: engine/src/systems/AudioSystem.ts:42

#### Parameters

##### busId

`string`

#### Returns

`number`

***

### getGroupVolume()

> **getGroupVolume**(`group`): `number`

Defined in: engine/src/systems/AudioSystem.ts:34

#### Parameters

##### group

`string`

#### Returns

`number`

***

### isDucked()

> **isDucked**(`bus`): `boolean`

Defined in: engine/src/systems/AudioSystem.ts:162

#### Parameters

##### bus

`string`

#### Returns

`boolean`

***

### load()

> **load**(`id`, `src`, `options?`): `Howl`

Defined in: engine/src/systems/AudioSystem.ts:57

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

Defined in: engine/src/systems/AudioSystem.ts:107

#### Parameters

##### id

`string`

#### Returns

`void`

***

### play()

> **play**(`id`): `number` \| `null`

Defined in: engine/src/systems/AudioSystem.ts:71

#### Parameters

##### id

`string`

#### Returns

`number` \| `null`

***

### setBusVolume()

> **setBusVolume**(`busId`, `volume`): `void`

Defined in: engine/src/systems/AudioSystem.ts:38

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

Defined in: engine/src/systems/AudioSystem.ts:23

#### Parameters

##### group

`string`

##### volume

`number`

#### Returns

`void`

***

### setPitch()

> **setPitch**(`id`, `rate`): `void`

Defined in: engine/src/systems/AudioSystem.ts:98

Sets a loaded sound's playback rate (1 = unchanged, 0.5 = half speed/an
octave down, 2 = double speed/an octave up) — Howler's own real,
documented `Howl.rate()` API. This is the engine-side answer to
`audio_sound_pitch(index, pitch)`, which is a real, common
idiom for cheap sound variety (a slightly different pitch each time the
same gunshot/footstep sample plays, rather than needing several
near-identical audio files) — see the compat layer's
`audio_sound_pitch`. Applies to every currently-playing (and future)
instance of this loaded sound id, matching the per-sound
(not per-play-instance) pitch semantic. A `id` that was never `load()`ed
is a safe, honest no-op — the same "warn, don't throw" shape `play()`
already uses for a missing sound.

#### Parameters

##### id

`string`

##### rate

`number`

#### Returns

`void`

***

### stop()

> **stop**(`id`): `void`

Defined in: engine/src/systems/AudioSystem.ts:80

#### Parameters

##### id

`string`

#### Returns

`void`

***

### transitionToSnapshot()

> **transitionToSnapshot**(`name`, `duration?`): `void`

Defined in: engine/src/systems/AudioSystem.ts:177

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

Defined in: engine/src/systems/AudioSystem.ts:111

#### Parameters

##### id

`string`

#### Returns

`void`

***

### unloadAll()

> **unloadAll**(): `void`

Defined in: engine/src/systems/AudioSystem.ts:119

#### Returns

`void`

***

### update()

> **update**(`dt`): `void`

Defined in: engine/src/systems/AudioSystem.ts:199

#### Parameters

##### dt

`number`

#### Returns

`void`
