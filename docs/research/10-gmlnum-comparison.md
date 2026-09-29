# 10 gmlNum string pass-through (research, read-only)

Verdict: the fix EXISTS; test coverage is UNIT-level only, the actual "comparison" scenario is not covered.

- Fix: `packages/engine/src/compat/gmlInstanceVars.ts:159-178` (`gmlNum`). Strings: lines 163-173, numeric strings coerce, any other string returns unchanged (`return value.trim() !== "" && !Number.isNaN(n) ? n : (value as unknown as number)`, :171-173). Objects pass through at :175-178. Doc comment :135-158 explains why coercing to 0 broke `x == "some string"`.
- Test: `packages/engine/src/__tests__/compatGml.test.ts:100-115` (`describe("gmlNum")`): asserts `gmlNum("hello")` -> "hello" (:108), `gmlNum("")` -> "" (:109), `"12.5"` -> 12.5, Map/array identity.
- Transpiler side: reads go through `GmlActions.gmlNum(getGmlVar/getGmlObjectVar/getGmlRefVar(...))` (toolchain/src/gms2-transpile.ts:5029, :5132); tests only assert emitted TEXT (gms2-transpile.test.ts:583, 2279, 2291). Sprite-name compare emission is tested textually at gms2-transpile.test.ts:163-170 (`sprite_index == spr_dad_hug` -> quoted `"./assets/sprites/spr_dad_hug/frame_0.png"`) and :2382.

Missing precisely: no test executes `gmlNum(getGmlVar(entity, ctx, "sprite_field")) === "./assets/sprites/spr_x/frame_0.png"` with a stored string path, i.e. the end-to-end path that was always false when the string was flattened to 0. (Note a bare `sprite_index` read does NOT go through gmlNum, it uses `Sprite.texturePath ?? ""`, test :172-176; so the regression risk is a custom instance var holding a sprite path.) Also a path string like "./assets/..." is non-numeric so passes, but a sprite named e.g. "1e3" or "0x10" would coerce via `Number()`; edge, untested.

Proposed test (add to compatGml.test.ts after :115; check the exact `setGmlVar/getGmlVar` signatures in gmlInstanceVars.ts and how other tests build an Entity/ctx before pasting):
```ts
it("does not break a stored sprite-path comparison", async () => {
  const { gmlNum, setGmlVar, getGmlVar } = await import("../compat/gmlInstanceVars.js");
  const path = "./assets/sprites/spr_x/frame_0.png";
  const entity = makeEntity(); const ctx = makeCtx();   // reuse the file's existing helpers
  setGmlVar(entity, ctx, "spr", path);
  expect(gmlNum(getGmlVar(entity, ctx, "spr")) === path).toBe(true);
  expect(gmlNum(getGmlVar(entity, ctx, "spr")) == 0).toBe(false);
  expect(gmlNum("1e3")).toBe(1000); // documents the numeric-looking-name edge
});
```
If no entity helper exists, the minimal version needs only `gmlNum(path) === path` and `gmlNum(path) !== 0`.
