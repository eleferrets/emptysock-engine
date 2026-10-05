[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [types/src](../README.md) / AssetManifestSchema

# Variable: AssetManifestSchema

> `const` **AssetManifestSchema**: `ZodObject`\<\{ `assets`: `ZodDefault`\<`ZodArray`\<`ZodObject`\<\{ `checksum`: `ZodOptional`\<`ZodString`\>; `id`: `ZodString`; `metadata`: `ZodDefault`\<`ZodRecord`\<`ZodString`, `ZodUnknown`\>\>; `name`: `ZodString`; `path`: `ZodString`; `size`: `ZodOptional`\<`ZodNumber`\>; `type`: `ZodEnum`\<\[`"image"`, `"audio"`, `"font"`, `"json"`, `"spritesheet"`, `"tilemap"`, `"shader"`\]\>; \}, `"strip"`, `ZodTypeAny`, \{ `checksum?`: `string`; `id`: `string`; `metadata`: `Record`\<`string`, `unknown`\>; `name`: `string`; `path`: `string`; `size?`: `number`; `type`: `"audio"` \| `"image"` \| `"font"` \| `"json"` \| `"spritesheet"` \| `"tilemap"` \| `"shader"`; \}, \{ `checksum?`: `string`; `id`: `string`; `metadata?`: `Record`\<`string`, `unknown`\>; `name`: `string`; `path`: `string`; `size?`: `number`; `type`: `"audio"` \| `"image"` \| `"font"` \| `"json"` \| `"spritesheet"` \| `"tilemap"` \| `"shader"`; \}\>, `"many"`\>\>; `version`: `ZodDefault`\<`ZodNumber`\>; \}, `"strip"`, `ZodTypeAny`, \{ `assets`: `object`[]; `version`: `number`; \}, \{ `assets?`: `object`[]; `version?`: `number`; \}\>

Defined in: types/src/index.ts:83
