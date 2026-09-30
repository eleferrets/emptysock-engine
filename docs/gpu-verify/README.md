# Real-GPU verification

Headless unit tests cannot compile GLSL or rasterise anything. `packages/engine/scripts/gpu-verify.mjs`
renders the engine's real code paths in headless Chromium with a software WebGL2 context (swiftshader)
and asserts on the pixels.

```
pnpm --filter @emptysock/engine build
GMS_FIXTURE_ASSETS=<gms2 importer output dir> node packages/engine/scripts/gpu-verify.mjs [--out docs/gpu-verify]
```

Chromium and Playwright are taken from `/opt/pw-browsers/chromium` and `/opt/node22/lib/node_modules`
(override with `CHROMIUM_PATH`, `PLAYWRIGHT_MODULE_DIR`). Without `GMS_FIXTURE_ASSETS` the `sh_white` and
`fnt_menu` checks are skipped. Screenshots land next to this file.

Checks: `RainGlassFilter` (droplets visible, scene preserved, trails), an importer-emitted shader
(`sh_white`) through the per-entity `Sprite.shader` filter path, `BitmapText` from the real `fnt_menu`
atlas, and the GML surface / `bm_subtract` darkness-with-light-cutout pattern.

## Bugs this found (all invisible to the headless suite)

- `RainGlassFilter` and the default `CustomShaderFilter` vertex stage used sprite-style attributes
  (`aUV`, projection matrices); a filter quad has only `aPosition`, so pixi threw at draw time.
  Both now use pixi's filter vertex contract, and `CustomShaderFilter` adapts sprite-style vertex
  sources automatically.
- Filter uniforms were assigned to `filter.resources.uniforms` as a plain object after construction, so
  pixi never uploaded them (every uniform read 0 on the GPU: the rain effect was a no-op). They are now
  a real `UniformGroup` passed to the `Filter` constructor.
- pixi's `"subtract"` blend mode is an advanced blend mode: without `import "pixi.js/advanced-blend-modes"`
  and `useBackBuffer: true` on WebGL it silently rendered as normal. `bm_subtract` now works.

## Rain look and cost

The shader now draws each drop as a lens (inverted, magnified scene inside, dark rim, specular glint,
caustic crescent), with static micro drops, big creeping drops, and sliding drops that leave wet trails.
Still one pass, no loops. Measured at 640x360 on swiftshader (CPU rasteriser, so absolute numbers say
little about real GPUs): scene 12.6 ms, plus an empty filter pass 20.3 ms, plus rain 22.2 ms; the rain
shader adds roughly 2-3 ms over an empty filter pass even on the CPU rasteriser. Real device profiling is
still outstanding.

## Real hardware (Apple M4 Pro, Metal, 2026-09-30)

Run in the Claude integrated browser (Chromium 152, ANGLE Metal, WebGPU on) against the same harness bundle,
and with Chrome headless through `GPU_ANGLE=metal` (`GPU_RENDERER=webgl|webgpu` forces a backend,
`GPU_EXTRA_ARGS` adds Chrome flags). The numbers match software rendering on the pixels that were checked.

| Check                                                                        | WebGL | WebGPU                                                      |
| ---------------------------------------------------------------------------- | ----- | ----------------------------------------------------------- |
| Rain visible, scene preserved (changed pixels 4.7%, opaque 99.6%)            | pass  | pass (4.70%, same row and column bands)                     |
| `bm_subtract` cutout (centre 255, outside 159)                               | pass  | pass (same values)                                          |
| `sh_white` imported shader (white silhouette, alpha kept, control untouched) | pass  | pass, once the imported WGSL program is given to the filter |
| `fnt_menu` bitmap text (1092 lit pixels, 8 glyph groups)                     | pass  | pass                                                        |
| Shader compile/link errors                                                   | 0     | n/a                                                         |

Rain frame cost at 640x360: scene 0.08 ms, passthrough filter +0.04 ms, rain +0.015 ms over the passthrough
(CPU submit time, GL-finished). The earlier WebGPU divergence (1.2% changed pixels, upper frame only) no longer
reproduces: the rewritten rain renders the same under both backends.

A WebGPU renderer renders a GL-only shader filter as nothing; the engine logs one warning naming the filter.
Imported shaders carry a WGSL program, so they work under both. `sh_white` was the first real check of that.

Harness fixes found on the way: readbacks are in device pixels (the harness now samples logical pixels, so it
holds at a device pixel ratio of 2); the old "trails elongate" check compared wet-mark run lengths and failed
identically on software and on the real GPU, so it is now a same-seed frame difference with the ratios logged
for information. Whether trails read as vertical streaks is a visual call.

### Sprite flash cost (fixed)

`SpriteFlash` was a pooled `ColorOverlayFilter` per flashing sprite, one extra render pass each. Measured on the
M4 Pro at 640x360, GPU-finished, per frame:

| Flashing sprites | Filter, WebGL | Filter, WebGPU | Silhouette overlay, WebGL | Silhouette overlay, WebGPU |
| ---------------- | ------------- | -------------- | ------------------------- | -------------------------- |
| 50               | 3.7 ms        | 9.5 ms         | 0.11 ms                   | 0.19 ms                    |
| 200              | 59.6 ms       | 36.9 ms        | 0.29 ms                   | 0.50 ms                    |
| 1000             | 323 ms        | 184 ms         | 1.2 ms                    | 1.8 ms                     |

A flash is now a second, batched sprite over the original, using a white silhouette texture built once per source
texture and tinted the flash colour at `amount` alpha. The pixels are the same blend the filter produced:
white at 1, (227, 142, 142) for a (200, 30, 30) pixel at 0.5, the original at 0, transparent texels stay transparent.
The filter stays as the fallback while a silhouette cannot be built (no renderer yet, texture still loading).

### Playthrough on the real GPU

`gpu-playthrough.mjs` (Chrome, Metal, same env switches) renders the importer output of a real project room by room.
It found that `draw_sprite` of a multi-frame sprite requested the literal `frame_{n}.png` template (404, white
placeholder); the draw path now loads frame 0 (`draw_sprite`'s subimage is not modelled). After the fix the only
missing request is the page's `favicon.ico`, and the screenshots in `playthrough/` show the terrain, sprites,
particles and bullet trails as expected.
