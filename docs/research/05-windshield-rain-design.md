# 05 Windshield rain: design for a rewrite of RainGlassFilter

Status: research only. No prototype was built; all costs below are estimates
from technique analysis, not measurements. Sources were recalled from memory
and NOT re-fetched in this session (no network verification); treat URLs and
claims as leads to confirm.

## 0. Current state (verified in repo)

- `packages/engine/src/systems/RainGlassFilter.ts` (260 lines): pixi v8
  `Filter` + `GlProgram`, one fragment pass, two hashed droplet grids, fake
  radial normal, vertical trail. Uniforms in a `UniformGroup`: uTime,
  uIntensity, uDropletSize, uDropletSpeed, uStreakAmount, uResolution.
  Exports `RAIN_GLASS_FRAGMENT`, `RainGlassFilter`, `createRainGlassFilter`,
  `RainGlassFilterOptions` (index.ts:134-137).
- Wired as `"rain-glass"` layer filter type: `PostProcessSystem.ts` (options
  at ~52-58, case at 275), `RenderSystem.ts` (import 34, `_rainGlassLastTick`
  180, `syncPostProcessLayerFilters` ~440 calls `_tickRainGlassFilters` 464,
  build at 522, options sync at 623). Tests: `__tests__/RainGlassFilter.test.ts`
  and `RenderSystem.test.ts`. Also referenced in `scripts/gpu-verify.harness.ts`,
  `docs/gpu-verify/README.md`, `docs/manual/05-systems-reference.md`,
  `docs/decisions/rendering-and-pipeline.md` (line 67-73), eslint config.
- Known pixi constraints already learned (rendering-and-pipeline.md): filter
  vertex stage has only `aPosition`; uniforms must be a `UniformGroup` given
  to the constructor; a filter on the render root is ignored (wrap in a child
  container). `GPUTier` = potato/low/mid/high (`GPUTier.ts`, via HostAdapter).
- Weakness: no drop merging, no real trails (a fade term), no persistent
  drop identity, no fog/condensation, no wiper, look is "lens droplets" not
  windscreen. Only swiftshader timing exists (+2-3 ms at 640x360).

## 1. Technique survey

| # | Technique | How | Cost (est.) | Verdict |
|---|-----------|-----|-------------|---------|
| A | Procedural grid drops, "Heartfelt" (Martijn Steinrucken / BigWings, Shadertoy, 2017) | Per pixel: 2-3 layered hashed cells, each drop a jittered blob with a time-driven fall + trail; normal from the drop SDF; blur level by fog | ALU heavy: ~3 layers x (hash + trail) plus blur mip fetches; O(pixels); 100-250 ALU ops/pixel | This is what we have, roughly. Great looking, but drops cannot merge or react to wipers, and drop identity is fixed to cells |
| B | CPU sim + canvas-2D drop map + WebGL refraction (Lucas Bebber, Codrops "Rain & Water Effect Experiments", 2015; RainEffect repo) | JS keeps a drop list (spawn, gravity, trail spawning small drops, merge on overlap), draws each drop as a sprite into a 2D canvas (R,G = x/y normal-ish, B = depth, A = mask), uploads canvas as texture, shader refracts a background and blurs by "fog" | CPU: hundreds of drops = tens of microseconds each in JS; texture upload of a small canvas per frame (256x256 to 512x512) ~0.1-0.3 ms; GPU: 1 fullscreen pass, 1 texture + scene fetch(es) | The proposed direction. Proven on WebGL1 hardware in 2015; physically plausible merging and trails come free from the sim |
| C | Particle sprites as drops (each drop a quad with normal-map sprite, rendered to RT) | Same as B but GPU draws drops as instanced sprites into a RT | Needs instancing/pixi ParticleContainer; more draw setup; CPU sim still needed for merging | Good upgrade path for high tier if canvas-fill CPU cost hurts; not needed first |
| D | Screen-space normal map + `DisplacementFilter` (pixi-filters / stock) | Pre-authored animated normal map scrolled over scene | ~1 sample; trivially cheap | Cheap fallback for "potato" tier; looks like a scrolling texture, no drops that move independently |
| E | Sprite-flipbook/decal windshield overlay (racing games commonly) | Pre-rendered drop atlas composited, plus a few refractive drops | Very cheap | Basis for the low tier's look only |
| F | Full 3D windscreen shader with cubemap/planar reflection (Forza/GT/Project CARS class) | Real geometry, environment probes, dirt maps | Not applicable to a 2D pixi engine | Out of scope; borrow ideas only: wiper sweep clearing a wedge, drops accelerating and streaking under speed/wind, blur increasing with fog/condensation |
| G | Blurred scene via pyramid/dual-Kawase (Marius Bjorge, SIGGRAPH 2015 "Bandwidth-Efficient Rendering") | Downsample chain with 4-5 taps per level, upsample | 2 to 4 tiny passes at 1/2..1/16 res; far cheaper than a big Gaussian | Best way to get fog blur; pixi has `BlurFilter` (Gaussian, separable, multipass) and pixi-filters has `KawaseBlurFilter` (already a dependency: `pixi-filters ^6.1.5`) |

Further references to check: Shadertoy "Heartfelt" (ltffzl); Codrops article
above; Bjorge SIGGRAPH 2015; pixi v8 docs "Filters" and `RenderTexture` /
`Texture.from` with `ImageSource`/`BufferImageSource`; Iñigo Quilez articles
for smooth-min blobs (merge look).

Key insight: everything visually convincing in A-F reduces to three ingredients:
(1) a per-pixel height/normal field of drops and trails, (2) sharp refraction
of the scene through big drops (scene flipped and magnified, as a real drop is
a lens), (3) diffuse blur/fog where there is no drop. B gives (1) from a
sim, so the shader only does (2)+(3).

## 2. Design

### 2.1 Module layout (all under packages/engine/src/systems/, no DOM)

- `RainGlassSim.ts`  pure sim, no pixi import. Deterministic given seed.
- `RainGlassMap.ts`  rasterises the sim into a `Uint8Array` RGBA buffer (pure).
- `RainGlassFilter.ts`  pixi Filter (rewritten), owns the drop-map texture.
- `RainGlassTiers.ts`  tier table and `resolveRainTier(gpuTier)` (pure).

Sim and map contain no pixi imports so vitest can run them with no renderer.

### 2.2 Data structures (struct-of-arrays, pooled, zero per-frame alloc)

Fixed capacity N = tier.maxDrops (64 / 128 / 256 for low/med/high, see table).

```ts
class DropPool {
  readonly x: Float32Array;      // map-space px (0..mapW)
  readonly y: Float32Array;
  readonly r: Float32Array;      // radius in map px
  readonly vy: Float32Array;     // slide velocity px/s
  readonly vx: Float32Array;     // lateral wobble/wind
  readonly stick: Float32Array;  // remaining "static" seconds before it may slide
  readonly trailAcc: Float32Array; // distance travelled since last trail bead
  readonly alive: Uint8Array;
  readonly free: Uint16Array;    // free-list stack
  freeTop: number;
  count: number;
}
```

Trail beads: small static drops (r 0.6-1.2 px) left behind sliding drops
are ordinary pool entries with `vy = 0`, `stick = large`, so trails cost pool
slots and evaporate naturally (r shrinks, dies below 0.4). No separate trail
buffer. A second, optional persistent layer `wet: Uint8Array(mapW*mapH)` (R8)
stores a smear trail height that decays; sliding drops stamp it. This makes
long continuous streaks cheap (one stamp per frame per sliding drop) instead of
one bead per few px. Recommended: use `wet` for trails, pool beads only for
tier high.

RNG: `mulberry32(seed)` returning float in [0,1); state in a `Uint32Array(1)`
so it can be saved/restored. Never `Math.random`.

### 2.3 Sim step (`step(dt)`, dt clamped to 1/20 s, fixed 1/60 substeps)

1. Spawn: accumulator `spawnAcc += intensity * tier.spawnPerSec * dt`; while
   >= 1 and free slot available: pick x uniform, y uniform in the upper 85%
   of the map (drops appear anywhere on a windscreen, not only the top),
   radius from a power-law (many small, few big): `r = rMin + (rMax-rMin) *
   u^3`. `stick = rand * 2 s + r * k` (bigger drops overcome friction sooner).
2. Slide: a drop moves only if `r >= rSlide` (threshold ~ 2.2 map px) and
   `stick <= 0`. `vy += (g * r*r - friction) * dt` clamped to `vMax`; `g` scales with
   `slope` option (0 = flat/hood-like, 1 = vertical glass). Add `vx = wobble
   noise + wind`, where wobble is a cheap hash of `(id, t*4)` (no per-frame
   alloc). Each moved distance adds to `trailAcc`; every `trailStep` px the
   drop stamps the `wet` map and sheds a bead of radius `0.35*r`, losing that
   volume (`r = cbrt(r^3 - bead^3)`); a drop that shrinks below `rSlide` stops.
3. Merge: spatial hash grid, cell size = 2*rMax, `Int16Array` heads + next
   links (rebuilt each step, O(N)). For each pair with `dist < (ri+rj)*0.8`:
   keep the larger, `r = cbrt(ri^3 + rj^3)`, position volume-weighted, `vy` =
   volume-weighted, `stick = 0` (merged drop starts sliding), free the other.
   Process in ascending index order so results are deterministic.
4. Evaporation/cull: `r -= evapRate * dt` for static drops; kill if `r < 0.4`
   or `y - r > mapH`. Freed slots pushed to the free stack.
5. Fog: scalar `fog` in 0..1 (option), eased toward target
   (`fog += (target - fog) * min(1, dt*0.5)`); wiper (2.5) also clears it locally.
6. `wet` decay: every 4th frame `wet[i] = max(0, wet[i] - decay)` over the map
   (mapW*mapH <= 65k bytes at high; ~0.03 ms).

### 2.4 Wiper (option `wiper`)

```ts
interface WiperOptions {
  enabled: boolean;
  pivotX: number; pivotY: number;   // 0..1 of view, e.g. 0.5, 1.15 (below screen)
  armLength: number;                // 0..1 of view height
  minAngle: number; maxAngle: number; // radians, sweep range
  periodSec: number;                // full out-and-back time
  bladeWidth: number;               // map px
  pauseSec: number;                 // park pause between sweeps (intermittent mode)
}
```

Angle `a(t)` is a triangle/ease-in-out wave of time. Per step, compute the
swept wedge between `aPrev` and `aNow`; for each live drop whose centre is
within `bladeWidth/2 + r` of the blade segment (point-to-segment distance),
kill it (or, with `wiperCarry`, push its volume into a "bead line" that
re-emits a few small drops behind the blade, a nice touch); zero `wet` bytes
in the swept area (rasterise the segment at `aNow`, thick line, plus
subdivide for fast sweeps); reduce local fog by writing a `clear` channel
(the B channel of the map, see 2.5). A wiper drawn as a visible blade is the
game's own job (sprite); the sim exposes `wiperAngle` for it.

### 2.5 Drop-map texture format

Size: tier map (e.g. 160x90, 256x144, 384x216; always 16:9 or the view aspect
rounded), RGBA8, NEAREST or LINEAR filtered (LINEAR; drops are smooth),
uploaded each frame from one preallocated `Uint8Array` via a pixi
`BufferImageSource` (`resource` = the array; call `source.update()` after
writing, no new allocation). Channels:

- R, G: surface normal xy (drop height gradient), 128 = flat. Normalised so
  the shader does `n = (rg - 0.5) * 2`.
- B: drop thickness/height (0 none, 255 max) used for lens magnification and
  specular sharpness; also carries trail height from `wet` at lower values.
- A: clear-glass mask: 255 where glass is wet/covered by drop or trail (so
  fogged area around it is "cleared" by the drop, as in real condensation),
  wiper zeroes both.

Rasterising a drop (radius r, centre cx, cy): loop the bounding box
(2r+1)^2 px, `d = dist/r`; if `d<1`, `h = sqrt(1-d*d)` (hemisphere),
gradient `n = (dx, dy)/r * (1 - h)`-style; write with max blend on B, overwrite
normal where new h larger. Radius <= 12 px at high, so 250 drops x ~300 px =
75k px writes ~0.2-0.4 ms JS. A precomputed drop-stamp lookup (one `Uint8Array`
per quantised radius, 16 sizes) avoids sqrt per pixel and is recommended
for mid/high.

### 2.6 Shader (pixi v8 Filter, GLSL; WGSL twin optional)

pixi v8 filters accept `glProgram` and `gpuProgram`. Existing filters here are
WebGL-only (`GlProgram`); keep that first. Provide `GpuProgram` (WGSL) as a
later step only if the engine enables the WebGPU renderer (check
`RenderSystem` renderer preference before investing).

Uniforms in one `UniformGroup`: uTime, uFog (float), uBlur (float px at
scene res), uRefract (float), uDropMap is a texture resource, uDropTexel
(vec2 = 1/mapSize), uTint (vec3), uLightDir (vec2 for the specular), uResolution.
Texture resource: `resources: { uniforms: group, uDropMap: source, uDropMapSampler: source.style }`
(for GL programs pixi v8 binds `sampler2D uDropMap` by resource name; verify
the exact binding syntax in a gpu-verify run, since the earlier bug list shows
resource plumbing is easy to get wrong).

Fragment sketch (single pass, vertex unchanged from current `RAIN_GLASS_VERTEX`):

```glsl
in vec2 vUV; out vec4 finalColor;
uniform sampler2D uTexture;   // scene
uniform sampler2D uDropMap;
uniform float uFog, uBlur, uRefract;
uniform vec2 uDropTexel;
uniform vec3 uTint; uniform vec2 uLightDir;

vec3 blurred(vec2 uv, float px, vec2 texel) {
  // 8-tap golden-angle disc, rotated per pixel with cheap interleaved noise
  vec3 acc = vec3(0.0);
  for (int i = 0; i < TAPS; i++) {           // TAPS is a #define per tier
    float a = float(i) * 2.39996 + n;        // n = 6.2831 * ign(gl_FragCoord.xy)
    float r = sqrt((float(i) + 0.5) / float(TAPS)) * px;
    acc += texture(uTexture, uv + vec2(cos(a), sin(a)) * r * texel).rgb;
  }
  return acc / float(TAPS);
}
void main() {
  vec4 m = texture(uDropMap, vUV);
  vec2 n = (m.rg - 0.5) * 2.0;               // drop normal
  float h = m.b, wet = m.a;
  // Drop = lens: strong offset + flip magnification, only where h>0
  vec2 uv = vUV - n * uRefract * h;
  // Fog blur elsewhere; wet area (and trail) is sharp/less blurred
  float fogHere = uFog * (1.0 - wet);
  vec3 col = mix(texture(uTexture, uv).rgb,
                 blurred(uv, uBlur * fogHere, uInputSize.zw), smoothstep(0.0, 0.2, fogHere));
  col = mix(col, uTint, fogHere * 0.25);      // milky condensation
  // specular + darker rim
  float spec = pow(max(dot(normalize(vec3(n, 0.6)), normalize(vec3(uLightDir, 0.7))), 0.0), 24.0);
  col += spec * h * 0.6;
  col *= 1.0 - 0.25 * smoothstep(0.7, 1.0, length(n)) * h; // rim shadow
  finalColor = vec4(col, 1.0);
}
```

Notes: `for` with constant `TAPS` unrolls; TAPS injected by string replace when
the program is built, so each tier is its own `GlProgram` (cache by tier).
Cheaper alternative for blur (recommended for med/high): pre-blur the scene
once at 1/4 res with pixi-filters `KawaseBlurFilter` (or two `BlurFilter`
passes) into a RenderTexture, then the fog term is a single extra `texture()`
lookup of that blurred RT; costs one small RT pass but no per-pixel disc loop.
This is Section 1 row G. Decide in step 5 by measurement.

Aspect: sample `uDropMap` using `vUV` (0..1 over the filtered area), so the
map covers the layer's frame; aspect mismatch is handled by making the map
aspect equal to the frame aspect at `setResolution`.

### 2.7 Quality tiers

| | potato | low | mid | high |
|---|---|---|---|---|
| Map res | 128x72 | 160x90 | 256x144 | 384x216 |
| Max drops | 40 | 64 | 128 | 256 |
| Spawn/s at intensity 1 | 6 | 12 | 24 | 48 |
| Trails | none | wet map only | wet + beads (cap 24) | wet + beads |
| Merging | grid off, O(N^2) check ok (N=40) | grid | grid | grid + volume conservation |
| Fog blur | none (tint only) | 6 taps, half-res scene fetch not used | 8 taps or pre-blurred RT | pre-blurred RT (Kawase, 2 passes) + 4 taps |
| Refraction | 1 sample | 1 sample | 1 sample | 1 sample + chromatic split (2 extra) |
| Sim rate | 30 Hz | 30 Hz | 60 Hz | 60 Hz |
| Map upload | every 2nd frame | every 2nd | every frame | every frame |
| Est. GPU (1080p, real GPU) | <0.2 ms | ~0.3 ms | ~0.6 ms | ~1.0-1.5 ms |
| Est. CPU | <0.1 ms | ~0.2 ms | ~0.5 ms | ~1 ms |

GPU/CPU rows are unmeasured guesses; gpu-verify must replace them. Default
tier: `resolveRainTier(detectGPUTier(adapter))`, override via option `quality`.

### 2.8 Public API

```ts
export type RainQuality = "auto" | "potato" | "low" | "medium" | "high";
export interface RainGlassFilterOptions {   // superset, old fields kept and mapped
  intensity?: number;      // 0..1 spawn rate + refraction strength (kept)
  dropletSize?: number;    // kept: scales rMin/rMax
  dropletSpeed?: number;   // kept: scales slide speed
  streakAmount?: number;   // kept: scales trail shed and wet stamp
  quality?: RainQuality;   // new, default "auto"
  fog?: number;            // 0..1 condensation
  blur?: number;           // max fog blur px
  slope?: number;          // 0..1 gravity scale
  wind?: number;           // px/s lateral
  seed?: number;           // sim RNG seed; default 1
  wiper?: Partial<WiperOptions>;
  tint?: [number, number, number];
}
class RainGlassFilter extends Filter {
  setOptions(o: RainGlassFilterOptions): void;
  setResolution(w: number, h: number): void;
  tick(dtSeconds: number): void;      // advances sim + uploads map + uTime (existing call site)
  triggerWipe(): void;                // one-shot sweep
  get wiperAngle(): number;           // radians, for a game-drawn blade
  get dropCount(): number;
  destroy(): void;                    // frees map source
}
```

Also export (via index.ts only) `RainGlassSim`, `RAIN_TIERS`,
`resolveRainTier`, types `RainGlassSimOptions`, `RainQuality`, `WiperOptions`.
`PostProcessSystem` layer options gain `quality`, `fog`, `blur`, `slope`,
`wind`, `seed`, `wiperEnabled`, `wiperPeriod`; existing four fields untouched
so saved scenes keep loading. `dist-types` must be regenerated to match index.ts.

### 2.9 Integration

No new pipeline stage. `RenderSystem._tickRainGlassFilters` already calls
`rain.tick(dt)` once per frame with wall-clock dt (line 464-478); the sim runs
inside `tick`, so gameplay time scaling (pause, slow-mo) needs a decision:
add an optional `timeScale` to tick, default 1, passed from the RenderSystem
if a game clock is available. `_applyPostProcessFilter` (RenderSystem ~623)
maps new options via `setOptions`. `setResolution` must also (re)allocate
the map when tier or aspect changes; do that lazily, not per frame.
Quality auto-pick: RenderSystem takes tier from Game's existing GPUTier value
(check where `detectGPUTier` result is stored; pass into filter construction).
One filter instance per layer means one sim per layer, which is fine.
Constraint reminder: the sim modules must not import DOM; the texture upload
uses only pixi `BufferImageSource`, not canvas. (Bebber's canvas-2D drawing is
replaced by direct typed-array rasterisation for that reason.)

## 3. Test plan

Headless (vitest, no GPU) in `__tests__/RainGlassSim.test.ts` and
`RainGlassMap.test.ts`:

- Determinism: same seed + same dt sequence gives byte-identical pool arrays
  after 600 steps; different seeds differ; save/restore RNG state resumes.
- Volume conservation on merge: sum r^3 before == after within 1e-4 (excluding evaporation).
- Merge invariants: no two live drops overlap by > 0.8 sum-radii after a step; count never exceeds capacity;
  free-list has no duplicates and `count + freeTop == capacity`.
- Trail invariants: a sliding drop's radius is monotonically non-increasing;
  stops when below `rSlide`; wet map values in [0, 255] and decay to 0.
- Spawn rate: over a long run, count of spawns within 10% of `rate * t`.
- Culling: drops leave bottom edge are freed.
- Wiper: after a full sweep with wiper enabled, no drops remain in the swept
  region and wet/mask bytes are zero there; angle stays within [min, max];
  disabled wiper is a no-op.
- Map raster: single drop of radius r produces centre B max, symmetric
  normals (mirror invariant), edge pixels flat (128,128), and mask A set.
- Tier table: every tier has monotonic capacity; `resolveRainTier` mapping for potato/low/mid/high/unknown.
- Filter unit tests (existing style): constructor builds, defaults, setOptions
  patches only given fields, `tick` advances sim and `uTime`, `destroy` idempotent,
  shader source contains `uDropMap` and no dynamic loops; mocked renderer only.
- Perf guard (loose, CI-safe): 256 drops, 1000 steps under a generous budget; no allocation
  check via steady `process.memoryUsage().heapUsed` delta bound.

Needs a real GPU (gpu-verify / real browser, add to `gpu_followup_real_browser.md`):

- Texture binding actually works (dropmap sampled non-zero; the past bug of
  uniforms reading 0 shows this is the real risk).
- Pixel asserts: a flat map returns the scene unchanged; a drop region
  is displaced vs. the scene; fog blur is monotonic in `fog`.
- Visual review screenshots per tier (also swiftshader for regression, not timing).
- Frame timing per tier on at least one integrated GPU, one discrete GPU, one
  mobile-class GPU at 1080p and 4K; upload cost of the map (`texSubImage2D` vs
  re-created source); check GC pauses from the sim.
- Wiper visual (sweep looks continuous at 30 vs 60 fps).

## 4. Ordered sweep steps (each independently committable, tests green)

| # | Commit (conventional, lowercase) | Files owned | Notes |
|---|---|---|---|
| 1 | `feat(engine): add seeded rng and rain glass drop pool` | new `systems/RainGlassSim.ts` (pool, rng, spawn, cull), new `__tests__/RainGlassSim.test.ts` | pure, no exports change yet |
| 2 | `feat(engine): rain sim slide, trails and merge` | `RainGlassSim.ts`, its test | invariants above |
| 3 | `feat(engine): rain sim wiper` | `RainGlassSim.ts`, test | wiper geometry |
| 4 | `feat(engine): rain drop map rasteriser and tier table` | new `RainGlassMap.ts`, `RainGlassTiers.ts`, tests | pure |
| 5 | `feat(engine): rewrite RainGlassFilter to sample drop map` | `RainGlassFilter.ts`, `__tests__/RainGlassFilter.test.ts` | keep old option names; keep `RAIN_GLASS_FRAGMENT` export name for gpu-verify |
| 6 | `feat(engine): wire rain quality, fog and wiper options` | `PostProcessSystem.ts`, `RenderSystem.ts`, `RenderSystem.test.ts`, `index.ts`, `dist-types` | only step touching shared systems; backwards compatible |
| 7 | `test(engine): gpu-verify rain glass pixel asserts` | `scripts/gpu-verify.harness.ts`, `docs/gpu-verify/README.md` | swiftshader correctness |
| 8 | `docs: rain glass rewrite decision and manual` | `docs/decisions/rendering-and-pipeline.md` (replace lines 71-73), `docs/manual/05-systems-reference.md`, `gpu_followup_real_browser.md` | last, once shipped |

Steps 1-4 have no shared-file conflicts and can run in parallel branches
after step 1's interface is fixed. Prototype the shader with the real
browser (step 5) before finalising tier tap counts.

## 5. Risks

1. Texture resource plumbing in pixi v8 Filter (`resources` naming, sampler
   binding) is undocumented for GL-only programs; earlier work hit exactly this. Mitigate: step 7 pixel assert early; fall back to `Filter.from` with a
   `TextureSource` in `resources` per pixi filter examples.
2. Per-frame map upload cost on mobile / integrated GPUs, and `BufferImageSource` update path may re-create textures. Mitigate: measure; cap upload to 30 Hz; consider `texSubImage2D` direct path.
3. Sim CPU cost at high with stamping; mitigate with stamp LUTs and tier caps; use `Float32Array` only.
4. Determinism vs wall-clock dt: sim uses fixed substeps; variable dt only
   changes number of substeps. Pause/timeScale semantics must be defined.
5. Blur cost at high-res/4K: per-pixel disc loop scales with pixels; prefer pre-blurred low-res RT.
6. Look quality is subjective; the map-driven look needs art iteration (normal falloff, rim, spec); budget review passes.
7. Backwards compatibility: scenes saved with old options must load; `dist-types` drift; the eslint config references the file (check rules on new files).
8. WebGPU renderer path would need a WGSL twin; currently GL-only like every other custom filter here.
9. Foveal issue: a filter on a layer sees only that layer's content; users wanting rain over UI must place it on the top container (pixi ignores filters on the render root).
10. All timing numbers here are estimates; the doc must not be quoted as measured.
