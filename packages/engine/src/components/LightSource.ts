import { defineComponent } from "../Component.js";

/**
 * A point-light emitter attached to an entity. Position is read from the
 * entity's `Transform` (see `LightingSystem.collectLights()`) plus this
 * component's `offsetX`/`offsetY` — a torch prop's light sits a few pixels
 * above the sprite's own origin, not exactly on top of it, so the offset is
 * a real field rather than something a caller has to fake by nudging
 * `Transform` itself.
 *
 * All fields are plain numbers/booleans (`Serializable`), matching every
 * other component in this codebase (`PhysicsBody`, `Meta`, ...) — nothing
 * here needs a callback or a non-serialisable field, so there's no side-table
 * split to do (contrast `PhysicsBody`'s collision callbacks).
 */
export const LightSource = defineComponent(
  "LightSource",
  () => ({
    /** Light radius in world units (px). The light contributes nothing beyond this distance. */
    radius: 200,
    /** Light colour, 0xRRGGBB. */
    colour: 0xffffff,
    /** Brightness multiplier. 1 = the light's colour at full strength at its centre; >1 can blow out past white when combined with other lights (additive), <1 dims it. */
    intensity: 1,
    /**
     * Falloff exponent. `1` is a roughly linear fade from centre to edge;
     * `<1` (e.g. `0.5`) keeps the light bright for most of its radius then
     * drops sharply near the edge; `>1` (e.g. `2`) fades gently near the
     * centre and drops off more sharply overall. See
     * `LightingSystem`'s doc comment for the exact curve.
     */
    falloff: 1,
    /** Offset from the owning entity's Transform, world units. */
    offsetX: 0,
    offsetY: 0,
    /** A disabled light is skipped by `LightingSystem.collectLights()` entirely — cheaper than removing/re-adding the component for a flickering torch, and a real on/off switch for gameplay (a torch that's been extinguished). */
    enabled: true as boolean,
  }),
  {
    schema: {
      radius: { kind: "number" },
      colour: { kind: "number" },
      intensity: { kind: "number" },
      falloff: { kind: "number" },
      offsetX: { kind: "number" },
      offsetY: { kind: "number" },
      enabled: { kind: "boolean" },
    },
  },
);
