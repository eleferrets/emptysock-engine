[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [types/src](../README.md) / AssetEntrySchema

# Variable: AssetEntrySchema

> `const` **AssetEntrySchema**: `ZodObject`\<\{ `checksum`: `ZodOptional`\<`ZodString`\>; `id`: `ZodString`; `metadata`: `ZodDefault`\<`ZodRecord`\<`ZodString`, `ZodUnknown`\>\>; `name`: `ZodString`; `path`: `ZodString`; `size`: `ZodOptional`\<`ZodNumber`\>; `type`: `ZodEnum`\<\[`"image"`, `"audio"`, `"font"`, `"json"`, `"spritesheet"`, `"tilemap"`, `"shader"`\]\>; \}, `"strip"`, `ZodTypeAny`, \{ `checksum?`: `string`; `id`: `string`; `metadata`: `Record`\<`string`, `unknown`\>; `name`: `string`; `path`: `string`; `size?`: `number`; `type`: `"audio"` \| `"image"` \| `"font"` \| `"json"` \| `"spritesheet"` \| `"tilemap"` \| `"shader"`; \}, \{ `checksum?`: `string`; `id`: `string`; `metadata?`: `Record`\<`string`, `unknown`\>; `name`: `string`; `path`: `string`; `size?`: `number`; `type`: `"audio"` \| `"image"` \| `"font"` \| `"json"` \| `"spritesheet"` \| `"tilemap"` \| `"shader"`; \}\>

Defined in: [types/src/index.ts:105](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/types/src/index.ts#L105)
