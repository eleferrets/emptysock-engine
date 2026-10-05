[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / COMPONENT\_REGISTRY

# Variable: COMPONENT\_REGISTRY

> `const` **COMPONENT\_REGISTRY**: readonly `string`[]

Defined in: engine/src/index.ts:516

Curated list of built-in `componentName`s an editor's "Add Component"
picker can offer for an entity that isn't live yet — there is no running
`Scene`/`World` to ask `componentRegistry.registeredComponents()` about
in that editing-time context, so some static list is unavoidable. It
deliberately does not try to be exhaustive (widget/UI components,
`Meta`, and anything a game defines itself via `defineComponent` are real
components that just aren't offered from this generic picker) — extend it
as new built-in components earn a place in that dropdown.
