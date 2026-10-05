[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / GameGlobals

# Interface: GameGlobals

Defined in: engine/src/systems/GlobalStore.ts:32

Augmentable registry of known global names -> value types. Game code (or
the IDE's generated globals declaration file) extends it via declaration
merging so `ctx.globals.get("score")` is typed and autocompleted:

    declare module "@emptysock/engine" { interface GameGlobals { score: number } }

Names not declared here still work through the untyped string overloads.
