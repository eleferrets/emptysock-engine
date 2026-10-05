[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / KeyboardLayoutProvider

# Interface: KeyboardLayoutProvider

Defined in: engine/src/systems/KeyboardLayout.ts:14

Host-injected layout source. Must be synchronous, pure and cheap.

## Methods

### charForCode()

> **charForCode**(`code`): `string` \| `undefined`

Defined in: engine/src/systems/KeyboardLayout.ts:16

Unshifted printable char produced by physical `code`, or undefined (unknown / non-printable). Single code point; lowercased by the engine.

#### Parameters

##### code

`string`

#### Returns

`string` \| `undefined`

***

### labelForCode()?

> `optional` **labelForCode**(`code`): `string` \| `undefined`

Defined in: engine/src/systems/KeyboardLayout.ts:20

Optional: human label for UI ("A", "Q", "Space", "Ф").

#### Parameters

##### code

`string`

#### Returns

`string` \| `undefined`

***

### onChange()?

> `optional` **onChange**(`cb`): () => `void`

Defined in: engine/src/systems/KeyboardLayout.ts:18

Optional: subscribe to layout changes. Returns unsubscribe.

#### Parameters

##### cb

() => `void`

#### Returns

() => `void`
