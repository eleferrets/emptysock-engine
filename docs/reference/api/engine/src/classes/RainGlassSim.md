[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / RainGlassSim

# Class: RainGlassSim

Defined in: engine/src/systems/RainGlassSim.ts:157

## Constructors

### Constructor

> **new RainGlassSim**(`opts`): `RainGlassSim`

Defined in: engine/src/systems/RainGlassSim.ts:202

#### Parameters

##### opts

[`RainGlassSimOptions`](../interfaces/RainGlassSimOptions.md)

#### Returns

`RainGlassSim`

## Properties

### \_acc

> `protected` **\_acc**: `number` = `0`

Defined in: engine/src/systems/RainGlassSim.ts:199

***

### \_frame

> `protected` **\_frame**: `number` = `0`

Defined in: engine/src/systems/RainGlassSim.ts:195

***

### \_heads

> `protected` `readonly` **\_heads**: `Int16Array`

Defined in: engine/src/systems/RainGlassSim.ts:193

***

### \_next

> `protected` `readonly` **\_next**: `Int16Array`

Defined in: engine/src/systems/RainGlassSim.ts:194

***

### \_spawnAcc

> `protected` **\_spawnAcc**: `number` = `0`

Defined in: engine/src/systems/RainGlassSim.ts:200

***

### \_wiperAngle

> `protected` **\_wiperAngle**: `number`

Defined in: engine/src/systems/RainGlassSim.ts:196

***

### \_wiperOneShot

> `protected` **\_wiperOneShot**: `boolean` = `false`

Defined in: engine/src/systems/RainGlassSim.ts:198

***

### \_wiperTime

> `protected` **\_wiperTime**: `number` = `0`

Defined in: engine/src/systems/RainGlassSim.ts:197

***

### beadCap

> **beadCap**: `number`

Defined in: engine/src/systems/RainGlassSim.ts:175

***

### beadCount

> **beadCount**: `number` = `0`

Defined in: engine/src/systems/RainGlassSim.ts:183

Live trail bead count.

***

### evapRate

> **evapRate**: `number`

Defined in: engine/src/systems/RainGlassSim.ts:167

***

### fog

> **fog**: `number`

Defined in: engine/src/systems/RainGlassSim.ts:179

Eased condensation 0..1.

***

### fogTarget

> **fogTarget**: `number`

Defined in: engine/src/systems/RainGlassSim.ts:177

***

### height

> `readonly` **height**: `number`

Defined in: engine/src/systems/RainGlassSim.ts:159

***

### intensity

> **intensity**: `number`

Defined in: engine/src/systems/RainGlassSim.ts:165

***

### pool

> `readonly` **pool**: `DropPool`

Defined in: engine/src/systems/RainGlassSim.ts:160

***

### rMax

> `readonly` **rMax**: `number`

Defined in: engine/src/systems/RainGlassSim.ts:190

***

### rMin

> `readonly` **rMin**: `number`

Defined in: engine/src/systems/RainGlassSim.ts:189

***

### rng

> `readonly` **rng**: `Rng`

Defined in: engine/src/systems/RainGlassSim.ts:161

***

### rSlide

> `readonly` **rSlide**: `number`

Defined in: engine/src/systems/RainGlassSim.ts:191

***

### simTime

> **simTime**: `number` = `0`

Defined in: engine/src/systems/RainGlassSim.ts:170

***

### sizeScale

> **sizeScale**: `number`

Defined in: engine/src/systems/RainGlassSim.ts:166

***

### slope

> **slope**: `number`

Defined in: engine/src/systems/RainGlassSim.ts:171

***

### spawned

> **spawned**: `number` = `0`

Defined in: engine/src/systems/RainGlassSim.ts:169

Total drops ever spawned by the spawner (not counting beads or addDrop).

***

### spawnPerSec

> `readonly` **spawnPerSec**: `number`

Defined in: engine/src/systems/RainGlassSim.ts:163

***

### speedScale

> **speedScale**: `number`

Defined in: engine/src/systems/RainGlassSim.ts:173

***

### stepSec

> `readonly` **stepSec**: `number`

Defined in: engine/src/systems/RainGlassSim.ts:162

***

### trails

> **trails**: `boolean`

Defined in: engine/src/systems/RainGlassSim.ts:176

***

### trailScale

> **trailScale**: `number`

Defined in: engine/src/systems/RainGlassSim.ts:174

***

### unit

> `readonly` **unit**: `number`

Defined in: engine/src/systems/RainGlassSim.ts:188

Geometry unit: map height / 144, so tuning constants are resolution independent.

***

### wet

> `readonly` **wet**: `Uint8Array`

Defined in: engine/src/systems/RainGlassSim.ts:185

Smear-trail height 0..255 per map px, decays over time.

***

### width

> `readonly` **width**: `number`

Defined in: engine/src/systems/RainGlassSim.ts:158

***

### wind

> **wind**: `number`

Defined in: engine/src/systems/RainGlassSim.ts:172

***

### wiper

> `readonly` **wiper**: [`WiperOptions`](../interfaces/WiperOptions.md)

Defined in: engine/src/systems/RainGlassSim.ts:181

Wiper settings; mutate through setWiper.

## Accessors

### dropCount

#### Get Signature

> **get** **dropCount**(): `number`

Defined in: engine/src/systems/RainGlassSim.ts:244

##### Returns

`number`

***

### wiperAngle

#### Get Signature

> **get** **wiperAngle**(): `number`

Defined in: engine/src/systems/RainGlassSim.ts:322

Current blade angle in radians, for a game-drawn blade.

##### Returns

`number`

## Methods

### \_advanceWiper()

> `protected` **\_advanceWiper**(`dt`): `void`

Defined in: engine/src/systems/RainGlassSim.ts:335

#### Parameters

##### dt

`number`

#### Returns

`void`

***

### \_cellOf()

> `protected` **\_cellOf**(`x`, `y`, `cell`, `cols`, `rows`): `number`

Defined in: engine/src/systems/RainGlassSim.ts:573

#### Parameters

##### x

`number`

##### y

`number`

##### cell

`number`

##### cols

`number`

##### rows

`number`

#### Returns

`number`

***

### \_cull()

> `protected` **\_cull**(): `void`

Defined in: engine/src/systems/RainGlassSim.ts:611

#### Returns

`void`

***

### \_decayWet()

> `protected` **\_decayWet**(`amount`): `void`

Defined in: engine/src/systems/RainGlassSim.ts:502

#### Parameters

##### amount

`number`

#### Returns

`void`

***

### \_free()

> `protected` **\_free**(`i`): `void`

Defined in: engine/src/systems/RainGlassSim.ts:624

#### Parameters

##### i

`number`

#### Returns

`void`

***

### \_merge()

> `protected` **\_merge**(): `void`

Defined in: engine/src/systems/RainGlassSim.ts:511

Merges overlapping pairs (distance < 0.8 * sum of radii), conserving volume.

#### Returns

`void`

***

### \_mergePair()

> `protected` **\_mergePair**(`i`, `j`): `void`

Defined in: engine/src/systems/RainGlassSim.ts:585

#### Parameters

##### i

`number`

##### j

`number`

#### Returns

`void`

***

### \_shed()

> `protected` **\_shed**(`i`, `r`): `void`

Defined in: engine/src/systems/RainGlassSim.ts:460

A sliding drop loses a bead's worth of volume (a bead drop is left behind when allowed).

#### Parameters

##### i

`number`

##### r

`number`

#### Returns

`void`

***

### \_spawn()

> `protected` **\_spawn**(`dt`): `void`

Defined in: engine/src/systems/RainGlassSim.ts:289

#### Parameters

##### dt

`number`

#### Returns

`void`

***

### \_stampWet()

> `protected` **\_stampWet**(`cx`, `cy`, `rad`, `val`): `void`

Defined in: engine/src/systems/RainGlassSim.ts:482

#### Parameters

##### cx

`number`

##### cy

`number`

##### rad

`number`

##### val

`number`

#### Returns

`void`

***

### \_substep()

> `protected` **\_substep**(`dt`): `void`

Defined in: engine/src/systems/RainGlassSim.ts:281

#### Parameters

##### dt

`number`

#### Returns

`void`

***

### \_update()

> `protected` **\_update**(`dt`): `void`

Defined in: engine/src/systems/RainGlassSim.ts:406

Per-substep motion, trails, merging, evaporation, fog and wet decay.

#### Parameters

##### dt

`number`

#### Returns

`void`

***

### \_wipeAt()

> `protected` **\_wipeAt**(`angle`): `void`

Defined in: engine/src/systems/RainGlassSim.ts:365

Clears drops and wet map under the blade at `angle`.

#### Parameters

##### angle

`number`

#### Returns

`void`

***

### addDrop()

> **addDrop**(`x`, `y`, `r`, `stick?`): `number`

Defined in: engine/src/systems/RainGlassSim.ts:261

Places a drop directly (tests, scripted scenes). Returns the slot or -1.

#### Parameters

##### x

`number`

##### y

`number`

##### r

`number`

##### stick?

`number` = `0`

#### Returns

`number`

***

### setWiper()

> **setWiper**(`patch`): `void`

Defined in: engine/src/systems/RainGlassSim.ts:309

#### Parameters

##### patch

`Partial`\<[`WiperOptions`](../interfaces/WiperOptions.md)\>

#### Returns

`void`

***

### step()

> **step**(`dtSeconds`): `void`

Defined in: engine/src/systems/RainGlassSim.ts:272

Advances by `dtSeconds` (clamped) in fixed substeps.

#### Parameters

##### dtSeconds

`number`

#### Returns

`void`

***

### totalVolume()

> **totalVolume**(): `number`

Defined in: engine/src/systems/RainGlassSim.ts:249

Sum of r^3 over live drops (proportional to water volume).

#### Returns

`number`

***

### triggerWipe()

> **triggerWipe**(): `void`

Defined in: engine/src/systems/RainGlassSim.ts:314

Runs one wiper sweep (out and back) even when the wiper is not enabled.

#### Returns

`void`
