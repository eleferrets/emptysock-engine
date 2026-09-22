[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / EventCommand

# Type Alias: EventCommand

> **EventCommand** = \{ `speaker`: `string`; `text`: `string`; `type`: `"show-dialogue"`; \} \| \{ `index`: `number`; `type`: `"set-variable"`; `value`: `number`; \} \| \{ `index`: `number`; `type`: `"set-switch"`; `value`: `boolean`; \} \| \{ `src`: `string`; `type`: `"play-audio"`; `volume?`: `number`; \} \| \{ `scene`: `string`; `transition?`: `string`; `type`: `"transition-scene"`; \} \| \{ `entityId`: `string`; `tileX`: `number`; `tileY`: `number`; `type`: `"move-character"`; \}

Defined in: [engine/src/systems/MapEventSystem.ts:16](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/MapEventSystem.ts#L16)
