import type { Scene } from "../Scene.js";
import { type Point } from "./LightOcclusion.js";
/** 0 = pitch black except lit areas, 1 = fully lit (no darkness at all). */
export interface AmbientLight {
  /** Ambient tint, 0xRRGGBB. White (0xffffff) is the ordinary "just dim everything" case. */
  colour: number;
  /** 0..1. See `AmbientLight`'s own doc comment. */
  level: number;
}
/** One light, resolved to world position, ready to render — collectLights()'s output shape. */
export interface LightSample {
  x: number;
  y: number;
  radius: number;
  colour: number;
  intensity: number;
  falloff: number;
  /** Cone wedge angle, radians. `2*Math.PI` (a full circle) is an ordinary point light — see `LightSource.coneAngle`'s doc comment. */
  coneAngle: number;
  /** Cone direction, radians. Only matters when `coneAngle < 2*Math.PI`. See `LightSource.coneDirection`. */
  coneDirection: number;
  /**
   * The light's real, occlusion-aware visible region, in world space —
   * `null` when no `LightOccluder` was within this light's radius (the
   * common case for most lights in most scenes), which is what keeps a
   * scene with zero occluders behaviourally identical to the
   * pre-occlusion implementation: `RenderSystem.syncLighting()` renders an
   * ordinary, un-masked circular falloff whenever this is `null`. See
   * `LightOcclusion.ts`'s doc comment for the actual algorithm.
   */
  visibility: Point[] | null;
}
export interface LightingSystemOptions {
  /**
   * Hard cap on simultaneous lights actually rendered. A real-time 2D
   * lighting pass draws every light into an offscreen texture every frame
   * (see RenderSystem.syncLighting()); an unbounded light count is an
   * unbounded per-frame draw-call/fill-rate cost with no ceiling, so this
   * system enforces one rather than trusting every game to self-limit.
   * Common real-time 2D lighting implementations land in the 16-32 range;
   * 32 is the default here.
   */
  maxLights?: number;
  /**
   * Angle samples cast evenly around the full circle per light, in
   * addition to the angles `LightOcclusion.ts` already casts at every
   * nearby occluder corner — see that file's `buildAngleList()` doc
   * comment for why an occluded light needs these at all (approximating
   * the unoccluded arcs of its own circular falloff as a polygon). Higher
   * is a rounder-looking falloff at a real, linear per-light ray cost;
   * 32 is a reasonable default for a torch-sized light. Only matters for a
   * light that actually has at least one occluder within reach — a light
   * with none never enters the visibility-polygon path at all.
   */
  raySamples?: number;
}
/**
 * Collects `LightSource` entities each frame and hands `RenderSystem` a
 * plain list to render. No per-entity or per-World side-table is needed —
 * unlike `PhysicsBody`'s callbacks or `VisualScriptState`'s evaluation scope,
 * every field a light needs is plain serialisable data that already lives on
 * the component itself, so `collectLights()` can read it straight off
 * `scene.each()` with nothing extra to track or clear on destroy.
 */
export declare class LightingSystem {
  ambient: AmbientLight;
  maxLights: number;
  raySamples: number;
  constructor(options?: LightingSystemOptions);
  /**
   * Every enabled `LightSource` (with a `Transform`) in `scene`, resolved to
   * world position, capped at `maxLights`. When there are more live lights
   * than the cap, this keeps the `maxLights` lights nearest `reference`
   * (typically the camera/viewport centre) and drops the rest — the honest
   * "degrade gracefully, never crash, never silently truncate an arbitrary
   * subset" shape this codebase already uses elsewhere (see `QueryChannel`'s
   * doc comment on partial-success reporting). A disabled light or a
   * non-positive radius is skipped outright, the same way a light with zero
   * practical effect would be.
   *
   * Each returned sample's `visibility` is real shadow-casting output, not
   * a placeholder — see `LightOcclusion.ts`'s module doc comment for the
   * algorithm. This method collects every enabled `LightOccluder` in
   * `scene` once (not once per light), then for each light spatially culls
   * that shared list down to only the occluders within the light's own
   * radius (`boxWithinReach()` — an AABB-vs-circle distance test, O(1) per
   * occluder) before doing any real ray work. Worst case is still
   * `O(lights x occluders x rays)`, same shape `renderMultiCamera()`'s own
   * doc comment names for its N-render-pass cost — for the "torch-lit
   * dungeon, 5-10 lights, dozens of wall segments" scale CLAUDE.md's
   * lighting entry documents as the target, this is a few thousand
   * ray/segment tests per frame, comfortably cheap; a scene with hundreds
   * of simultaneous occluded lights would need real profiling before
   * shipping, the same honest caveat this codebase's other N-pass features
   * already carry rather than pretending is free.
   */
  collectLights(
    scene: Scene,
    reference?: {
      x: number;
      y: number;
    },
  ): LightSample[];
  /** Every enabled `LightOccluder` (with a `Transform`) in `scene`, resolved to a world-space box. */
  private _collectOccluders;
  /**
   * One light's real visible region, or `null` when nothing nearby could
   * possibly occlude it — see `LightSample.visibility`'s doc comment for
   * why `null` is the deliberate "render exactly like before" fast path,
   * not a degenerate case that needs special-casing downstream.
   */
  private _computeVisibility;
}
