[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / resolveSpriteFramePath

# Function: resolveSpriteFramePath()

> **resolveSpriteFramePath**(`sprite`): `string`

Defined in: engine/src/components/Sprite.ts:173

Resolves `Sprite.texturePath`/`currentFrame`/`frameCount` into the actual
path to load/display this tick. A `frameCount <= 1` sprite (the common,
pre-animation case) returns `texturePath` unchanged — no `"{n}"` template
to resolve, byte-for-byte identical behaviour to before this field
existed. A multi-frame sprite replaces the literal `"{n}"` substring with
the floored, wrapped-or-clamped frame index. Shared by `RenderPipeline`
(actual rendering) and `SpriteAnimationSystem`'s own tests (asserting the
resolved path advances) so the two can never disagree on the convention.

## Parameters

### sprite

#### currentFrame

`number`

#### frameCount

`number`

#### texturePath

`string`

## Returns

`string`
