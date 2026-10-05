[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / Layout

# Variable: Layout

> `const` **Layout**: [`ComponentDef`](../interfaces/ComponentDef.md)\<\{ `height`: `number`; `width`: `number`; `x`: `number`; `y`: `number`; \}\>

Defined in: engine/src/components/Layout.ts:85

Layout *outputs* — written by `WidgetTree.layout()` every layout pass,
read by anything that needs a widget's final on-screen box (hit-testing,
rendering). `x`/`y` are absolute (relative to the layout root), not
relative to the parent the way Yoga's own `getComputedLeft()`/
`getComputedTop()` are — `WidgetTree` accumulates each ancestor's offset
while walking the hierarchy-ordered query so callers never have to walk
back up the tree themselves to find a widget's real screen position.
