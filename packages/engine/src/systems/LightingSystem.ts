// Real 2D dynamic point-light system — data/collection only, framework-agnostic.
// Actual pixels come from RenderSystem.syncLighting() (mirrors the split
// PostProcessSystem/RenderSystem already use: PostProcessSystem stores
// framework-agnostic settings, RenderSystem translates them into real pixi
// objects). This file never imports pixi.js, so it stays inside the engine
// environment boundary and is fully unit-testable under plain Node/Vitest.
//
// Library-vs-hand-roll audit (RELEASE_PASS.md's "as little engine-original
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
import type { Scene } from "../Scene.js";
import { Transform } from "../components/Transform.js";
import { LightSource } from "../components/LightSource.js";

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
}

const DEFAULT_MAX_LIGHTS = 32;

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

  constructor(options: LightingSystemOptions = {}) {
    this.maxLights = options.maxLights ?? DEFAULT_MAX_LIGHTS;
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
   */
  collectLights(
    scene: Scene,
    reference: { x: number; y: number } = { x: 0, y: 0 },
  ): LightSample[] {
    const lights: LightSample[] = [];
    scene.each(Transform, LightSource, (transform, light) => {
      if (!light.enabled || light.radius <= 0) return;
      lights.push({
        x: transform.x + light.offsetX,
        y: transform.y + light.offsetY,
        radius: light.radius,
        colour: light.colour,
        intensity: light.intensity,
        falloff: light.falloff,
      });
    });

    if (lights.length <= this.maxLights) return lights;

    lights.sort((a, b) => distanceSq(a, reference) - distanceSq(b, reference));
    return lights.slice(0, this.maxLights);
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
