# Real-GPU verification

Headless unit tests cannot compile GLSL or rasterise anything. `packages/engine/scripts/gpu-verify.mjs`
renders the engine's real code paths in headless Chromium with a software WebGL2 context (swiftshader)
and asserts on the pixels.

```
pnpm --filter @emptysock/engine build
FREEDOM_ASSETS=<gms2 importer output dir> node packages/engine/scripts/gpu-verify.mjs [--out docs/gpu-verify]
```

Chromium and Playwright are taken from `/opt/pw-browsers/chromium` and `/opt/node22/lib/node_modules`
(override with `CHROMIUM_PATH`, `PLAYWRIGHT_MODULE_DIR`). Without `FREEDOM_ASSETS` the `sh_white` and
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
