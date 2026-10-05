[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [network/src](../README.md) / networked

# Function: networked()

> **networked**\<`T`\>(`def`, `fields`): `ComponentDef`\<`T`\>

Defined in: network/src/NetworkedFields.ts:52

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

**Constraint: networked fields must be primitive-typed, or reassigned as
a whole new value on every change — never mutated in place.**
`NetworkSystem.sync()`'s outbound dirty-check (see its doc comment) uses
strict equality (`this._lastSent.get(key) !== value`) against the last
value it sent. For a primitive field this is exactly "did the value
change". For an object- or array-shaped field, mutating it in place
(`component.inventory.push(item)`, `component.pos.x = 5`) does not change
which reference is stored in the component, so the strict-equality check
never sees a difference and the mutation is silently never replicated.
If a networked field must hold an object/array, always assign a new one
(`component.inventory = [...component.inventory, item]`) so the
reference itself changes. This is a deliberate, documented limitation,
not a bug to work around locally — fixing it would mean deep-equality or
a different change-detection strategy entirely, a bigger design decision
than a single field-marking helper should make unilaterally.

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
