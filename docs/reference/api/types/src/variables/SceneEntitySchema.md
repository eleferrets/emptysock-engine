[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [types/src](../README.md) / SceneEntitySchema

# Variable: SceneEntitySchema

> `const` **SceneEntitySchema**: `ZodObject`\<\{ `active`: `ZodOptional`\<`ZodBoolean`\>; `components`: `ZodOptional`\<`ZodRecord`\<`ZodString`, `ZodObject`\<\{ `data`: `ZodRecord`\<`ZodString`, `ZodUnknown`\>; `v`: `ZodOptional`\<`ZodNumber`\>; \}, `"strip"`, `ZodTypeAny`, \{ `data`: `Record`\<`string`, `unknown`\>; `v?`: `number`; \}, \{ `data`: `Record`\<`string`, `unknown`\>; `v?`: `number`; \}\>\>\>; `ext`: `ZodOptional`\<`ZodRecord`\<`ZodString`, `ZodRecord`\<`ZodString`, `ZodUnknown`\>\>\>; `id`: `ZodString`; `layer`: `ZodOptional`\<`ZodString`\>; `name`: `ZodOptional`\<`ZodString`\>; `parent`: `ZodOptional`\<`ZodString`\>; `persistent`: `ZodOptional`\<`ZodBoolean`\>; `pool`: `ZodOptional`\<`ZodBoolean`\>; `prefab`: `ZodOptional`\<`ZodObject`\<\{ `name`: `ZodString`; `props`: `ZodOptional`\<`ZodRecord`\<`ZodString`, `ZodUnknown`\>\>; \}, `"strip"`, `ZodTypeAny`, \{ `name`: `string`; `props?`: `Record`\<`string`, `unknown`\>; \}, \{ `name`: `string`; `props?`: `Record`\<`string`, `unknown`\>; \}\>\>; `tags`: `ZodOptional`\<`ZodArray`\<`ZodString`, `"many"`\>\>; \}, `"strip"`, `ZodTypeAny`, \{ `active?`: `boolean`; `components?`: `Record`\<`string`, \{ `data`: `Record`\<`string`, `unknown`\>; `v?`: `number`; \}\>; `ext?`: `Record`\<`string`, `Record`\<`string`, `unknown`\>\>; `id`: `string`; `layer?`: `string`; `name?`: `string`; `parent?`: `string`; `persistent?`: `boolean`; `pool?`: `boolean`; `prefab?`: \{ `name`: `string`; `props?`: `Record`\<`string`, `unknown`\>; \}; `tags?`: `string`[]; \}, \{ `active?`: `boolean`; `components?`: `Record`\<`string`, \{ `data`: `Record`\<`string`, `unknown`\>; `v?`: `number`; \}\>; `ext?`: `Record`\<`string`, `Record`\<`string`, `unknown`\>\>; `id`: `string`; `layer?`: `string`; `name?`: `string`; `parent?`: `string`; `persistent?`: `boolean`; `pool?`: `boolean`; `prefab?`: \{ `name`: `string`; `props?`: `Record`\<`string`, `unknown`\>; \}; `tags?`: `string`[]; \}\>

Defined in: types/src/scene.ts:33
