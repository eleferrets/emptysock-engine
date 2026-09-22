[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / ComponentType

# Type Alias: ComponentType\<T\>

> **ComponentType**\<`T`\> = `string` & `object`

Defined in: [engine/src/core/Component.ts:10](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Component.ts#L10)

A branded component-type key. `ComponentType<T>` is a plain string at
runtime — the brand exists only so `entity.getComponent(Sprite.TYPE)`
infers `Sprite | undefined` without an explicit `<Sprite>` type argument,
and so a typo'd string literal doesn't silently type-check against the
wrong component. Component identity is still the underlying string (see
CLAUDE.md "Component types as identity keys") — this only adds a checked
seam on top of it, it does not change the lookup semantics.

## Type Declaration

### \_\_componentType?

> `readonly` `optional` **\_\_componentType?**: `T`

## Type Parameters

### T

`T` *extends* [`Component`](../classes/Component.md) = [`Component`](../classes/Component.md)
