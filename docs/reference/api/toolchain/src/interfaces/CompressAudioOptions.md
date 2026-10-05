[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [toolchain/src](../README.md) / CompressAudioOptions

# Interface: CompressAudioOptions

Defined in: toolchain/src/audioCompress.ts:35

## Properties

### codec?

> `optional` **codec?**: [`AudioCodec`](../type-aliases/AudioCodec.md)

Defined in: toolchain/src/audioCompress.ts:37

#### Default

```ts
"vorbis"
```

***

### quality?

> `optional` **quality?**: `number`

Defined in: toolchain/src/audioCompress.ts:39

Vorbis: `-q:a` (0-10, higher = better/bigger). Opus: kbps bitrate.
