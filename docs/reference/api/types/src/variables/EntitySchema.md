[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [types/src](../README.md) / EntitySchema

# Variable: EntitySchema

> `const` **EntitySchema**: `ZodObject`\<\{ `active`: `ZodDefault`\<`ZodBoolean`\>; `children`: `ZodDefault`\<`ZodArray`\<`ZodLazy`\<`ZodTypeAny`\>, `"many"`\>\>; `components`: `ZodDefault`\<`ZodArray`\<`ZodObject`\<\{ `data`: `ZodRecord`\<`ZodString`, `ZodUnknown`\>; `type`: `ZodString`; \}, `"strip"`, `ZodTypeAny`, \{ `data`: `Record`\<`string`, `unknown`\>; `type`: `string`; \}, \{ `data`: `Record`\<`string`, `unknown`\>; `type`: `string`; \}\>, `"many"`\>\>; `id`: `ZodString`; `name`: `ZodString`; `tags`: `ZodDefault`\<`ZodArray`\<`ZodString`, `"many"`\>\>; \}, `"strip"`, `ZodTypeAny`, \{ `active`: `boolean`; `children`: `any`[]; `components`: `object`[]; `id`: `string`; `name`: `string`; `tags`: `string`[]; \}, \{ `active?`: `boolean`; `children?`: `any`[]; `components?`: `object`[]; `id`: `string`; `name`: `string`; `tags?`: `string`[]; \}\>

Defined in: [types/src/index.ts:60](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/types/src/index.ts#L60)
