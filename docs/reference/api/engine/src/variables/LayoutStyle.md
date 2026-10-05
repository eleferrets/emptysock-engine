[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / LayoutStyle

# Variable: LayoutStyle

> `const` **LayoutStyle**: [`ComponentDef`](../interfaces/ComponentDef.md)\<\{ `flexDirection`: `number`; `flexGrow`: `number`; `flexShrink`: `number`; `gap`: `number`; `height`: `number`; `left`: `number`; `overflow`: `number`; `padding`: `number`; `positionType`: `number`; `scrollX`: `number`; `scrollY`: `number`; `top`: `number`; `width`: `number`; \}\>

Defined in: engine/src/components/Layout.ts:17

Layout style *inputs* for one widget entity (the release notes Track 3 /
ground rule 4a). Mirrors the subset of `yoga-layout`'s `Node` setters
`WidgetTree`'s layout pass actually drives — a small, deliberately
incomplete slice (enough for a scrollable list: a column or row of
fixed/auto-sized children with gap/padding/grow), not a full flexbox
surface. Extend as real widgets need more of Yoga's API, not
speculatively.

`width`/`height` of `-1` means "auto" (Yoga's `setWidthAuto()`/
`setHeightAuto()`) rather than a fixed pixel size — a sentinel instead of
a second boolean pair per axis, since every other field here is already a
plain number and `Serializable` allows it.
