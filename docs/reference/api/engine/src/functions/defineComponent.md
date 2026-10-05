[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / defineComponent

# Function: defineComponent()

> **defineComponent**\<`T`\>(`componentName`, `createDefaults`, `options?`): [`ComponentDef`](../interfaces/ComponentDef.md)\<`T`\>

Defined in: engine/src/Component.ts:123

Define a component by name and a defaults factory.

```ts
const Position = defineComponent("Position", () => ({ x: 0, y: 0 }));
player.add(Position, { x: 100 });
player.get(Position).x; // 100
```

The name is load-bearing — hot-reloading the
module that calls `defineComponent("Position", ...)` produces a new JS
object every time, but the engine's component registry treats two defs
with the same `componentName` as the *same* component, replacing the old
definition's entry rather than creating a second, unrelated one.

## Type Parameters

### T

`T` *extends* [`SerializableRecord`](../type-aliases/SerializableRecord.md)

## Parameters

### componentName

`string`

### createDefaults

() => `T`

### options?

[`DefineComponentOptions`](../interfaces/DefineComponentOptions.md)\<`T`\>

## Returns

[`ComponentDef`](../interfaces/ComponentDef.md)\<`T`\>
