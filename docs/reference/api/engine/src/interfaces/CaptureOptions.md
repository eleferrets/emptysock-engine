[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / CaptureOptions

# Interface: CaptureOptions

Defined in: engine/src/Input.ts:127

## Properties

### allowModifiers?

> `optional` **allowModifiers?**: `boolean`

Defined in: engine/src/Input.ts:139

Accept a lone Shift/Ctrl/Alt/Meta press. Default false.

***

### axisThreshold?

> `optional` **axisThreshold?**: `number`

Defined in: engine/src/Input.ts:141

Axis magnitude that counts as a press. Default 0.5.

***

### cancelCodes?

> `optional` **cancelCodes?**: readonly `string`[]

Defined in: engine/src/Input.ts:133

Key codes that cancel the capture (resolve `null`). Default `["Escape"]`.

***

### kinds?

> `optional` **kinds?**: readonly [`CaptureKind`](../type-aliases/CaptureKind.md)[]

Defined in: engine/src/Input.ts:129

Which input kinds may be captured. Default: all.

***

### mode?

> `optional` **mode?**: `"physical"` \| `"char"`

Defined in: engine/src/Input.ts:135

`"physical"` (default) records `code` only; `"char"` also records `char` for letter keys the layout knows.

***

### signal?

> `optional` **signal?**: `AbortSignal`

Defined in: engine/src/Input.ts:137

Resolve `null` when aborted.

***

### timeoutMs?

> `optional` **timeoutMs?**: `number`

Defined in: engine/src/Input.ts:131

Resolve `null` if nothing is captured within this many ms. Default: none.
