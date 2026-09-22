[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [types/src](../README.md) / SceneSchema

# Variable: SceneSchema

> `const` **SceneSchema**: `ZodObject`\<\{ `backgroundColor`: `ZodDefault`\<`ZodString`\>; `entities`: `ZodDefault`\<`ZodArray`\<`ZodObject`\<\{ `active`: `ZodDefault`\<`ZodBoolean`\>; `children`: `ZodDefault`\<`ZodArray`\<`ZodLazy`\<`ZodTypeAny`\>, `"many"`\>\>; `components`: `ZodDefault`\<`ZodArray`\<`ZodObject`\<\{ `data`: `ZodRecord`\<..., ...\>; `type`: `ZodString`; \}, `"strip"`, `ZodTypeAny`, \{ `data`: `Record`\<..., ...\>; `type`: `string`; \}, \{ `data`: `Record`\<..., ...\>; `type`: `string`; \}\>, `"many"`\>\>; `id`: `ZodString`; `name`: `ZodString`; `tags`: `ZodDefault`\<`ZodArray`\<`ZodString`, `"many"`\>\>; \}, `"strip"`, `ZodTypeAny`, \{ `active`: `boolean`; `children`: `any`[]; `components`: `object`[]; `id`: `string`; `name`: `string`; `tags`: `string`[]; \}, \{ `active?`: `boolean`; `children?`: `any`[]; `components?`: `object`[]; `id`: `string`; `name`: `string`; `tags?`: `string`[]; \}\>, `"many"`\>\>; `id`: `ZodString`; `metadata`: `ZodDefault`\<`ZodObject`\<\{ `author`: `ZodOptional`\<`ZodString`\>; `createdAt`: `ZodOptional`\<`ZodNumber`\>; `updatedAt`: `ZodOptional`\<`ZodNumber`\>; \}, `"strip"`, `ZodTypeAny`, \{ `author?`: `string`; `createdAt?`: `number`; `updatedAt?`: `number`; \}, \{ `author?`: `string`; `createdAt?`: `number`; `updatedAt?`: `number`; \}\>\>; `name`: `ZodString`; `version`: `ZodDefault`\<`ZodNumber`\>; \}, `"strip"`, `ZodTypeAny`, \{ `backgroundColor`: `string`; `entities`: `object`[]; `id`: `string`; `metadata`: \{ `author?`: `string`; `createdAt?`: `number`; `updatedAt?`: `number`; \}; `name`: `string`; `version`: `number`; \}, \{ `backgroundColor?`: `string`; `entities?`: `object`[]; `id`: `string`; `metadata?`: \{ `author?`: `string`; `createdAt?`: `number`; `updatedAt?`: `number`; \}; `name`: `string`; `version?`: `number`; \}\>

Defined in: [types/src/index.ts:71](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/types/src/index.ts#L71)
