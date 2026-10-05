[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [types/src](../README.md) / EngineConfigSchema

# Variable: EngineConfigSchema

> `const` **EngineConfigSchema**: `ZodObject`\<\{ `antialias`: `ZodDefault`\<`ZodBoolean`\>; `backgroundColor`: `ZodDefault`\<`ZodNumber`\>; `height`: `ZodDefault`\<`ZodNumber`\>; `physics`: `ZodDefault`\<`ZodObject`\<\{ `gravity`: `ZodDefault`\<`ZodObject`\<\{ `x`: `ZodNumber`; `y`: `ZodNumber`; \}, `"strip"`, `ZodTypeAny`, \{ `x`: `number`; `y`: `number`; \}, \{ `x`: `number`; `y`: `number`; \}\>\>; `timestep`: `ZodDefault`\<`ZodNumber`\>; \}, `"strip"`, `ZodTypeAny`, \{ `gravity`: \{ `x`: `number`; `y`: `number`; \}; `timestep`: `number`; \}, \{ `gravity?`: \{ `x`: `number`; `y`: `number`; \}; `timestep?`: `number`; \}\>\>; `powerPreference`: `ZodDefault`\<`ZodEnum`\<\[`"default"`, `"high-performance"`, `"low-power"`\]\>\>; `resolution`: `ZodDefault`\<`ZodNumber`\>; `width`: `ZodDefault`\<`ZodNumber`\>; \}, `"strip"`, `ZodTypeAny`, \{ `antialias`: `boolean`; `backgroundColor`: `number`; `height`: `number`; `physics`: \{ `gravity`: \{ `x`: `number`; `y`: `number`; \}; `timestep`: `number`; \}; `powerPreference`: `"default"` \| `"high-performance"` \| `"low-power"`; `resolution`: `number`; `width`: `number`; \}, \{ `antialias?`: `boolean`; `backgroundColor?`: `number`; `height?`: `number`; `physics?`: \{ `gravity?`: \{ `x`: `number`; `y`: `number`; \}; `timestep?`: `number`; \}; `powerPreference?`: `"default"` \| `"high-performance"` \| `"low-power"`; `resolution?`: `number`; `width?`: `number`; \}\>

Defined in: types/src/index.ts:141
