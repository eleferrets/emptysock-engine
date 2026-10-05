[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / Transform

# Variable: Transform

> `const` **Transform**: [`ComponentDef`](../interfaces/ComponentDef.md)\<\{ `rotation`: `number`; `scaleX`: `number`; `scaleY`: `number`; `x`: `number`; `y`: `number`; \}\>

Defined in: engine/src/components/Transform.ts:9

ECS-core equivalent of `../../components/Transform.ts`, built on `defineComponent`. All
fields are plain numbers, so this needs no special storage treatment
— `ComponentRegistry` gives it one parallel
array per field automatically.
