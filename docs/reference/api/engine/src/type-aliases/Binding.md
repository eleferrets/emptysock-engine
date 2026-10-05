[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / Binding

# Type Alias: Binding

> **Binding** = \{ `char?`: `string`; `code`: `string`; `kind`: `"key"`; \} \| \{ `index`: `number`; `kind`: `"gamepadButton"`; `padIndex?`: `number`; \} \| \{ `axis`: `number`; `kind`: `"gamepadAxis"`; `padIndex?`: `number`; `threshold`: `number`; \}

Defined in: engine/src/Input.ts:20

One physical source an action can bind to. Deliberately narrower than a
pointer/gesture binding — §15.3 only names keyboard/gamepad as the
action-mapped devices; pointer/touch/gesture input stays a raw-only
device via `input.pointers`/`input.gestures`/`input.wheelEvents` on the
escape hatch, since "was action X pressed" doesn't map cleanly onto "is a
pinch gesture active" the way it does onto a key or a gamepad button.

## Union Members

### Type Literal

\{ `char?`: `string`; `code`: `string`; `kind`: `"key"`; \}

#### char?

> `readonly` `optional` **char?**: `string`

Optional: "the key that types this letter". When set and the active
layout knows a key for it, that key is read instead of `code`
(`layout.codeForChar(char) ?? code`). Letters only. Absent means a
purely physical binding, which is what old saves and authored
defaults are.

#### code

> `readonly` **code**: `string`

Physical `KeyboardEvent.code`. Always present; the fallback when `char` cannot be resolved.

#### kind

> `readonly` **kind**: `"key"`

***

### Type Literal

\{ `index`: `number`; `kind`: `"gamepadButton"`; `padIndex?`: `number`; \}

***

### Type Literal

\{ `axis`: `number`; `kind`: `"gamepadAxis"`; `padIndex?`: `number`; `threshold`: `number`; \}

#### axis

> `readonly` **axis**: `number`

#### kind

> `readonly` **kind**: `"gamepadAxis"`

#### padIndex?

> `readonly` `optional` **padIndex?**: `number`

#### threshold

> `readonly` **threshold**: `number`

Threshold beyond which the axis counts as "active". Sign matters.
