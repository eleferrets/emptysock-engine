/**
 * Not a runtime test — this file is only meant to be *type-checked*
 * (`npm run typecheck` / `tsc --noEmit`, which includes `src/**\/*`). It
 * exists to lock in ENGINE_DESIGN.md §4/§10.2's "onUpdate cannot be async —
 * that's a type error" claim as an actual, enforced compiler check rather
 * than prose that could silently stop being true.
 *
 * If either `@ts-expect-error` below stops being necessary (i.e. TypeScript
 * no longer rejects the async `onUpdate`), `tsc` fails the build with
 * "Unused '@ts-expect-error' directive" — that failure is the point: it
 * means someone needs to look at why the guard in `defineScene` broke.
 */
import { defineScene } from "../../v2/Game.js";

defineScene({
  // @ts-expect-error — onUpdate must not be async (ENGINE_DESIGN.md §4).
  async onUpdate(_dt: number) {
    await Promise.resolve();
  },
});

// A synchronous onUpdate is fine and must NOT need @ts-expect-error.
defineScene({
  onUpdate(_dt: number) {
    // plain, synchronous work
  },
});
