[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [toolchain/src](../README.md) / generatePrefabTypes

# Function: generatePrefabTypes()

> **generatePrefabTypes**(`files`, `lookup`, `options?`): `string`

Defined in: [toolchain/src/prefabCodegen.ts:86](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/toolchain/src/prefabCodegen.ts#L86)

Reads a project's `.prefab.json` file contents plus its registered
component lookup, and emits a `.d.ts` string declaring one
`PrefabDef<{...}>`-typed ambient `const` per prefab — so
`scene.spawn(EnemyPrefab, props)` autocompletes `props` against that
prefab's actual, merged component field shape (defaults from every
component it declares, plus everything it `extends`).

The emitted file is meant to sit alongside the prefab JSON and be
`import`ed (its `declare const`s, not its types, are what game code
actually uses) — see `packages/toolchain/src/__tests__/prefabCodegen.test.ts`
for the exact shape asserted.

## Parameters

### files

readonly `PrefabFile`[]

### lookup

`ComponentLookup`

### options?

[`PrefabCodegenOptions`](../interfaces/PrefabCodegenOptions.md) = `{}`

## Returns

`string`
