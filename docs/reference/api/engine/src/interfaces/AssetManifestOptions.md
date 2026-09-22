[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / AssetManifestOptions

# Interface: AssetManifestOptions

Defined in: [engine/src/systems/AssetManifest.ts:33](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/AssetManifest.ts#L33)

## Properties

### audioSystem?

> `optional` **audioSystem?**: [`AudioSystem`](../classes/AudioSystem.md)

Defined in: [engine/src/systems/AssetManifest.ts:49](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/AssetManifest.ts#L49)

AudioSystem to warm for "audio" assets. Calling AudioSystem.load() here
registers the Howl under the descriptor's id in AudioSystem's own sound
map, so audio.play(id) later hits the same loaded Howl instead of
loading a fresh one.

***

### continueOnError?

> `optional` **continueOnError?**: `boolean`

Defined in: [engine/src/systems/AssetManifest.ts:57](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/AssetManifest.ts#L57)

When true (default), a failed asset is recorded and loading continues
with the rest of the manifest. When false, load() rejects on the first
failure (still reporting which asset via the thrown AssetLoadFailure).

***

### fetchImpl?

> `optional` **fetchImpl?**: \{(`input`, `init?`): `Promise`\<`Response`\>; (`input`, `init?`): `Promise`\<`Response`\>; \}

Defined in: [engine/src/systems/AssetManifest.ts:51](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/AssetManifest.ts#L51)

Injectable fetch implementation, e.g. for tests. Defaults to global fetch.

#### Call Signature

> (`input`, `init?`): `Promise`\<`Response`\>

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Window/fetch)

##### Parameters

###### input

`RequestInfo` \| `URL`

###### init?

`RequestInit`

##### Returns

`Promise`\<`Response`\>

#### Call Signature

> (`input`, `init?`): `Promise`\<`Response`\>

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Window/fetch)

##### Parameters

###### input

`string` \| `Request` \| `URL`

###### init?

`RequestInit`

##### Returns

`Promise`\<`Response`\>

***

### textureLoader?

> `optional` **textureLoader?**: [`TextureLoader`](../type-aliases/TextureLoader.md)

Defined in: [engine/src/systems/AssetManifest.ts:42](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/AssetManifest.ts#L42)

Loader used for "texture" assets. Uses the same `TextureLoader` shape as
`RenderPipelineOptions.textureLoader` — pass the exact function you gave
RenderPipeline (or nothing, since both default to `Assets.load`) so a
texture preloaded here lands in the identical pixi.js `Assets` cache
RenderPipeline resolves through, and is instantly available (no
redundant fetch) the first time gameplay code renders it.
