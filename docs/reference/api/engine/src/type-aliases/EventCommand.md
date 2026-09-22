[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / EventCommand

# Type Alias: EventCommand

> **EventCommand** = \{ `speaker`: `string`; `text`: `string`; `type`: `"show-dialogue"`; \} \| \{ `index`: `number`; `type`: `"set-variable"`; `value`: `number`; \} \| \{ `index`: `number`; `type`: `"set-switch"`; `value`: `boolean`; \} \| \{ `src`: `string`; `type`: `"play-audio"`; `volume?`: `number`; \} \| \{ `scene`: `string`; `transition?`: `string`; `type`: `"transition-scene"`; \} \| \{ `entityId`: `string`; `tileX`: `number`; `tileY`: `number`; `type`: `"move-character"`; \}

Defined in: [engine/src/systems/MapEventSystem.ts:16](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/MapEventSystem.ts#L16)
