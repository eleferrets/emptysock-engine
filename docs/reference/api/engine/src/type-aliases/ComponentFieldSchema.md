[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / ComponentFieldSchema

# Type Alias: ComponentFieldSchema

> **ComponentFieldSchema** = \{ `kind`: `"number"`; \} \| \{ `kind`: `"string"`; \} \| \{ `kind`: `"boolean"`; \} \| \{ `kind`: `"enum"`; `options`: readonly `string`[]; \} \| \{ `kind`: `"entityRef"`; `relation?`: `string`; \}

Defined in: engine/src/Component.ts:11

Per-field inspector schema entry (the engine design notes: "co-located
optional schema, not decorators"). Describes how the IDE's Inspector
should render one field of a component's defaults object — enough to
pick a typed control (number input, text input, checkbox, dropdown), not
a full validation system. `options` is only meaningful for `"enum"` and
lists the literal values the dropdown offers.

## Union Members

### Type Literal

\{ `kind`: `"number"`; \}

***

### Type Literal

\{ `kind`: `"string"`; \}

***

### Type Literal

\{ `kind`: `"boolean"`; \}

***

### Type Literal

\{ `kind`: `"enum"`; `options`: readonly `string`[]; \}

***

### Type Literal

\{ `kind`: `"entityRef"`; `relation?`: `string`; \}

The field holds an `EntityRef` (`{ $ref: number }`, `NO_REF` when
empty). Scene load, save/load and room carry-over remap exactly the
fields declared this way (`remapRefs`). `relation`, when set, names a
`RelationDef` the pointed-at entity is expected to be linked through
(Inspector hint only; not enforced).
