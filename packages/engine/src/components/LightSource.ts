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
    /**
     * Cone/spot-light wedge angle, in degrees, centred on `coneDirection`.
     * `360` (the default) is an ordinary point light — every angle around
     * the light is lit, matching this component's original point-light-only
     * behaviour exactly, byte-for-byte (see `LightingSystem.collectLights()`
     * / `LightOcclusion.computeVisibilityPolygon()`'s own doc comments for
     * why a value `>= 360` never enters the cone-clipping path at all). A
     * value `< 360` restricts the light to a real pie-slice wedge — a
     * flashlight, a headlamp, a streetlamp's downward cone — the common
     * "spot light" case real GameMaker lighting systems (e.g. the
     * `Crystal`/`ED5` community lighting assets) support alongside plain
     * point lights.
     */
    coneAngle: 360,
    /** Cone direction in degrees, `0` pointing along +X, increasing clockwise (screen-space convention, matching `Transform.rotation`'s degrees-vs-radians sibling fields elsewhere in this codebase). Only matters when `coneAngle < 360`. */
    coneDirection: 0,
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
      coneAngle: { kind: "number" },
      coneDirection: { kind: "number" },
    },
  },
);
