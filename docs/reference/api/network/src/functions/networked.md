[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [network/src](../README.md) / networked

# Function: networked()

> **networked**\<`T`\>(`def`, `fields`): `ComponentDef`\<`T`\>

Defined in: [network/src/NetworkedFields.ts:36](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/network/src/NetworkedFields.ts#L36)

Mark a subset of `def`'s fields as networked. Call this once per
component, on both client and server, right next to (or instead of) the
game's own `defineComponent` call:

```ts
const Position = defineComponent("Position", () => ({ x: 0, y: 0 }));
networked(Position, ["x", "y"]);
```

Returns `def` unchanged so it composes in a `defineComponent(...)` chain
without an extra local variable:

```ts
const Position = networked(
  defineComponent("Position", () => ({ x: 0, y: 0 })),
  ["x", "y"],
);
```

## Type Parameters

### T

`T` *extends* `SerializableRecord`

## Parameters

### def

`ComponentDef`\<`T`\>

### fields

readonly keyof `T` & `string`[]

## Returns

`ComponentDef`\<`T`\>
