[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / WheelEventInfo

# Interface: WheelEventInfo

Defined in: [engine/src/systems/PointerSystem.ts:74](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/PointerSystem.ts#L74)

## Properties

### deltaMode

> **deltaMode**: `number`

Defined in: [engine/src/systems/PointerSystem.ts:80](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/PointerSystem.ts#L80)

0 = pixel, 1 = line, 2 = page — WheelEvent.DOM_DELTA_*

***

### deltaX

> **deltaX**: `number`

Defined in: [engine/src/systems/PointerSystem.ts:76](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/PointerSystem.ts#L76)

Horizontal scroll amount, sign/units depend on deltaMode.

***

### deltaY

> **deltaY**: `number`

Defined in: [engine/src/systems/PointerSystem.ts:78](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/PointerSystem.ts#L78)

Vertical scroll amount, sign/units depend on deltaMode.

***

### isPinchZoom

> **isPinchZoom**: `boolean`

Defined in: [engine/src/systems/PointerSystem.ts:90](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/PointerSystem.ts#L90)

True when this event represents a pinch-to-zoom gesture on a trackpad.

***

### source

> **source**: `"trackpad"` \| `"mouse-wheel"`

Defined in: [engine/src/systems/PointerSystem.ts:88](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/PointerSystem.ts#L88)

Heuristic classification of the input device. Trackpads typically
deliver small fractional pixel deltas on every frame of a gesture and
report `ctrlKey === true` for pinch-to-zoom gestures on Chrome/Firefox/
Safari (a synthesized signal, not literal Ctrl-key state). Mouse wheels
deliver large, discrete integer deltas per "click" of the wheel.
