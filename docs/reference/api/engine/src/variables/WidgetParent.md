[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / WidgetParent

# Variable: WidgetParent

> `const` **WidgetParent**: `Relation`\<`unknown`\>

Defined in: engine/src/ui/WidgetTree.ts:39

the release notes Track 3 / ground rule 4a's real relation. Every widget
entity that has a parent carries one `WidgetParent(parentEid)` pair
component pointing at it. `withAutoRemoveSubject()` means destroying a
parent widget's underlying entity cascades: bitECS removes the relation
pair from every child automatically, and `WidgetTree` reacts to that the
same way it reacts to an explicit `destroyWidget()` — via the next
`layout()` pass no longer finding that child's ancestor chain, and the
caller's own `Scene.destroy()` on the parent (which is what actually
triggers this) is expected to destroy the child entities itself, same as
any other parent/child game-object relationship. This relation carries no
store — it's a pure structural edge — so `createRelation()` is called with
no `withStore()` modifier, only `withAutoRemoveSubject()`.
