// Real 2D dynamic point-light system — data/collection only, framework-agnostic.
// Actual pixels come from RenderSystem.syncLighting() (mirrors the split
// PostProcessSystem/RenderSystem already use: PostProcessSystem stores
// framework-agnostic settings, RenderSystem translates them into real pixi
// objects). This file never imports pixi.js, so it stays inside the engine
// environment boundary and is fully unit-testable under plain Node/Vitest.
//
// Library-vs-hand-roll audit (the release notes "as little engine-original
// code as this can honestly get away with" methodology): `pixi-filters@6.1.5`
// — already an engine dependency, already used by PostProcessSystem's
// `outline` mapping — ships a real, purpose-built `SimpleLightmapFilter`
// (`multiplies the scene by ambient + a lightmap texture`, confirmed by
// reading its actual WGSL/GLSL source in
// `node_modules/pixi-filters/lib/simple-lightmap/`). That is the real
// library-level primitive this system is built on — see RenderSystem.ts's
// `syncLighting()` doc comment for how the lightmap texture itself is
// produced (real pixi `Graphics`/`RenderTexture`, no new npm dependency, no
// hand-rolled multi-light-uniform-array shader). A `pixijs-light2d`-style
// dedicated lighting package exists on npm but is a small, single-maintainer,
// not-already-installed dependency for something `pixi-filters` — a package
// this engine already trusts and already depends on — already covers the
// hard part of; not worth the extra dependency surface for the actual gap
// that's left (turning a light list into a lightmap texture, which is a
// handful of `Graphics.circle().fill()` calls, not a research problem).
//
// Real shadow-casting (occlusion): a `LightSource` on one side of a
// `LightOccluder` no longer illuminates straight through it. See
// `LightOcclusion.ts`'s module doc comment for the algorithm (a real
// visibility-polygon computation from occluder-segment endpoints, not an
// approximation) and CLAUDE.md's LightingSystem entry for the full
// rationale, including the honest remaining perf caveat.
import type { Scene } from "../Scene.js";
import { Transform } from "../components/Transform.js";
import { LightSource } from "../components/LightSource.js";
import { LightOccluder } from "../components/LightOccluder.js";
import {
  boxOccluderSegments,
  boxWithinReach,
  computeVisibilityPolygon,
  type Point,
  type Segment,
} from "./LightOcclusion.js";

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

const DEFAULT_MAX_LIGHTS = 32;
const DEFAULT_RAY_SAMPLES = 32;

/** A `LightOccluder`, resolved to its world-space box centre and size. */
interface OccluderBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Collects `LightSource` entities each frame and hands `RenderSystem` a
 * plain list to render. No per-entity or per-World side-table is needed —
 * unlike `PhysicsBody`'s callbacks or `VisualScriptState`'s evaluation scope,
 * every field a light needs is plain serialisable data that already lives on
 * the component itself, so `collectLights()` can read it straight off
 * `scene.each()` with nothing extra to track or clear on destroy.
 */
export class LightingSystem {
  ambient: AmbientLight = { colour: 0xffffff, level: 0 };
  maxLights: number;
  raySamples: number;

  constructor(options: LightingSystemOptions = {}) {
    this.maxLights = options.maxLights ?? DEFAULT_MAX_LIGHTS;
    this.raySamples = options.raySamples ?? DEFAULT_RAY_SAMPLES;
  }

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
    reference: { x: number; y: number } = { x: 0, y: 0 },
  ): LightSample[] {
    const occluders = this._collectOccluders(scene);

    const lights: LightSample[] = [];
    scene.each(Transform, LightSource, (transform, light) => {
      if (!light.enabled || light.radius <= 0) return;
      const x = transform.x + light.offsetX;
      const y = transform.y + light.offsetY;
      lights.push({
        x,
        y,
        radius: light.radius,
        colour: light.colour,
        intensity: light.intensity,
        falloff: light.falloff,
        coneAngle: (light.coneAngle * Math.PI) / 180,
        coneDirection: (light.coneDirection * Math.PI) / 180,
        visibility: this._computeVisibility(
          x,
          y,
          light.radius,
          occluders,
          (light.coneAngle * Math.PI) / 180,
          (light.coneDirection * Math.PI) / 180,
        ),
      });
    });

    if (lights.length <= this.maxLights) return lights;

    lights.sort((a, b) => distanceSq(a, reference) - distanceSq(b, reference));
    return lights.slice(0, this.maxLights);
  }

  /** Every enabled `LightOccluder` (with a `Transform`) in `scene`, resolved to a world-space box. */
  private _collectOccluders(scene: Scene): OccluderBox[] {
    const boxes: OccluderBox[] = [];
    scene.each(Transform, LightOccluder, (transform, occluder) => {
      if (!occluder.enabled || occluder.width <= 0 || occluder.height <= 0) {
        return;
      }
      boxes.push({
        x: transform.x + occluder.offsetX,
        y: transform.y + occluder.offsetY,
        width: occluder.width,
        height: occluder.height,
      });
    });
    return boxes;
  }

  /**
   * One light's real visible region, or `null` when nothing nearby could
   * possibly occlude it — see `LightSample.visibility`'s doc comment for
   * why `null` is the deliberate "render exactly like before" fast path,
   * not a degenerate case that needs special-casing downstream.
   */
  private _computeVisibility(
    lightX: number,
    lightY: number,
    radius: number,
    occluders: readonly OccluderBox[],
    coneAngle: number,
    coneDirection: number,
  ): Point[] | null {
    const segments: Segment[] = [];
    for (const box of occluders) {
      if (
        !boxWithinReach(
          lightX,
          lightY,
          radius,
          box.x,
          box.y,
          box.width,
          box.height,
        )
      ) {
        continue;
      }
      for (const seg of boxOccluderSegments(
        box.x,
        box.y,
        box.width,
        box.height,
      )) {
        segments.push({
          ax: seg.ax - lightX,
          ay: seg.ay - lightY,
          bx: seg.bx - lightX,
          by: seg.by - lightY,
        });
      }
    }

    const polygon = computeVisibilityPolygon(
      radius,
      segments,
      this.raySamples,
      { direction: coneDirection, angle: coneAngle },
    );
    if (polygon === null) return null;
    return polygon.map((p) => ({ x: p.x + lightX, y: p.y + lightY }));
  }
}

function distanceSq(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}
