[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / PinchGesture

# Interface: PinchGesture

Defined in: [engine/src/systems/PointerSystem.ts:55](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/PointerSystem.ts#L55)

## Properties

### deltaScale

> **deltaScale**: `number`

Defined in: [engine/src/systems/PointerSystem.ts:65](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/PointerSystem.ts#L65)

scale delta since the previous pinch event this gesture.

***

### distance

> **distance**: `number`

Defined in: [engine/src/systems/PointerSystem.ts:61](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/PointerSystem.ts#L61)

Current distance between the two pointers.

***

### scale

> **scale**: `number`

Defined in: [engine/src/systems/PointerSystem.ts:63](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/PointerSystem.ts#L63)

distance / startDistance — 1 means no change, >1 means spreading, <1 means pinching in.

***

### type

> **type**: `"pinch"`

Defined in: [engine/src/systems/PointerSystem.ts:56](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/PointerSystem.ts#L56)

***

### x

> **x**: `number`

Defined in: [engine/src/systems/PointerSystem.ts:58](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/PointerSystem.ts#L58)

Center point between the two pointers, in the same coordinate space as pointer x/y.

***

### y

> **y**: `number`

Defined in: [engine/src/systems/PointerSystem.ts:59](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/PointerSystem.ts#L59)
