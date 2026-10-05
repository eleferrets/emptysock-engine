[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / ButtonState

# Variable: ButtonState

> `const` **ButtonState**: [`ComponentDef`](../interfaces/ComponentDef.md)\<\{ `background`: `string`; `borderRadius`: `number`; `color`: `string`; `disabled`: `boolean`; `font`: `string`; `fontId`: `string`; `fontSize`: `number`; `hoverBackground`: `string`; `label`: `string`; `pressedBackground`: `string`; `state`: `number`; \}\>

Defined in: engine/src/components/Widgets.ts:96

`state` (0 normal / 1 hover / 2 pressed) is written by `UISystem`'s
pointer dispatch each frame, not by game code — treat it as a read-only
output for rendering, the same "engine writes, game code reads" contract
`Layout`'s x/y/width/height already has.
