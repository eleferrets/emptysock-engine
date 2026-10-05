[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [toolchain/src](../README.md) / CodegenPrefabsOptions

# Interface: CodegenPrefabsOptions

Defined in: toolchain/src/prefabCodegenCli.ts:32

The `emptysock-toolchain codegen-prefabs <project-dir>` build step
(`cli.ts`) — the follow-up `prefabCodegen.ts`'s own doc comment and
CLAUDE.md's "Prefab `.d.ts` codegen lives in toolchain, not the engine"
entry both used to flag as not-yet-wired. Split out of `cli.ts` itself so
it's testable without spawning the built `dist/cli.js` binary or
importing a module that calls `program.parseAsync(process.argv)` as a
side effect on import.

Scans `projectDir` for every `*.prefab.json` file, builds a
`ComponentLookup` seeded from every `ComponentDef` `@emptysock/engine`
exports (its built-in components — `Transform`, `Sprite`, `PhysicsBody`,
…) merged with whatever `ComponentDef`s the caller's own
`componentModules` export, and writes `generatePrefabTypes`'s output to
disk. A real game's own custom components live in the game's own
compiled JS, which this CLI has no way to discover on its own — the
caller points at those modules explicitly via `componentModules`.

## Properties

### componentModules?

> `readonly` `optional` **componentModules?**: readonly `string`[]

Defined in: toolchain/src/prefabCodegenCli.ts:36

Extra compiled JS module paths whose `ComponentDef` exports register the project's own components.

***

### out?

> `readonly` `optional` **out?**: `string`

Defined in: toolchain/src/prefabCodegenCli.ts:34

Output `.d.ts` path. Defaults to `<projectDir>/prefabs.generated.d.ts`.
