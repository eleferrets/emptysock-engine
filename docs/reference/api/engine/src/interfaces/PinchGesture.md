[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / PinchGesture

# Interface: PinchGesture

Defined in: engine/src/systems/PointerSystem.ts:55

## Properties

### deltaScale

> **deltaScale**: `number`

Defined in: engine/src/systems/PointerSystem.ts:65

scale delta since the previous pinch event this gesture.

***

### distance

> **distance**: `number`

Defined in: engine/src/systems/PointerSystem.ts:61

Current distance between the two pointers.

***

### scale

> **scale**: `number`

Defined in: engine/src/systems/PointerSystem.ts:63

distance / startDistance — 1 means no change, >1 means spreading, <1 means pinching in.

***

### type

> **type**: `"pinch"`

Defined in: engine/src/systems/PointerSystem.ts:56

***

### x

> **x**: `number`

Defined in: engine/src/systems/PointerSystem.ts:58

Center point between the two pointers, in the same coordinate space as pointer x/y.

***

### y

> **y**: `number`

Defined in: engine/src/systems/PointerSystem.ts:59
