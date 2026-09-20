# ViewportSystem

`ViewportSystem` owns automatic viewport handling: scaling a fixed design resolution to fit whatever size the browser window, IDE preview iframe, or Tauri WebView actually gives you, listening for resize and orientation-change events, and exposing safe-area insets for notches. It replaces manually calling `RenderPipeline.resize()`/`RenderSystem.resize()` and `CameraSystem.setViewSize()` by hand.

Import: `import { ViewportSystem } from '@emptysock/engine';`

---

## Quick reference

```typescript
import {
  RenderPipeline,
  CameraSystem,
  ViewportSystem,
} from "@emptysock/engine";

const renderPipeline = new RenderPipeline();
await renderPipeline.init({ width: 1280, height: 720 });

const camera = new CameraSystem();
camera.attach(renderPipeline.stage);

const viewport = new ViewportSystem();
viewport.init(
  { designWidth: 1280, designHeight: 720, scaleMode: "fit" },
  { renderTarget: renderPipeline, cameraSystem: camera },
);

// Later, e.g. when the player changes a settings screen:
viewport.setScaleMode("fill");

// Safe-area insets (notches, home indicators) for UI padding:
const insets = viewport.getSafeAreaInsets();
```

For the full method list see the [Viewport reference page](../viewport.md).

---

## Scale modes

| Mode        | Behaviour                                                                                         |
| ----------- | ------------------------------------------------------------------------------------------------- |
| `"fit"`     | Letterboxes — scales the design resolution to fit inside the container without cropping. Default. |
| `"fill"`    | Cover-crops — scales up to fill the container completely, cropping the overflow.                  |
| `"stretch"` | Stretches to fill the container exactly, ignoring aspect ratio.                                   |

`"fit"` is the default because it never crops content the game explicitly authored, which is the safest choice for a batteries-included engine.

---

## `init(config, systems?)`

Wires the systems to keep in sync and starts listening for resize/orientation-change. Call once during game setup, after `RenderPipeline.init()`.

| Config field   | Type                           | Default | Description                                            |
| -------------- | ------------------------------ | ------- | ------------------------------------------------------ |
| `designWidth`  | `number`                       | `1280`  | Logical width the game is authored against             |
| `designHeight` | `number`                       | `720`   | Logical height the game is authored against            |
| `scaleMode`    | `"fit" \| "fill" \| "stretch"` | `"fit"` | How the design resolution maps to the actual container |
| `container`    | `HTMLElement`                  | —       | Element to observe; falls back to `window` dimensions  |

| Systems field  | Type                             | Description                                                          |
| -------------- | -------------------------------- | -------------------------------------------------------------------- |
| `renderTarget` | `RenderPipeline \| RenderSystem` | Receives `resize(width, height)` calls on every recompute            |
| `cameraSystem` | `CameraSystem`                   | Receives `setViewSize(designWidth, designHeight)` on every recompute |

## `recompute(): ViewportSize`

Recomputes the letterboxed size against the current container/window size and pushes it to the wired render target and camera. Called automatically on resize/orientation-change; call it directly after changing layout in a way the browser doesn't fire an event for.

## `getSafeAreaInsets(): SafeAreaInsets`

Returns `{ top, right, bottom, left }` in CSS pixels, read via the standard `env(safe-area-inset-*)` CSS custom-property probe. Returns all-zero insets in Node/Vitest or on platforms without notch support.

## `setScaleMode(mode)` / `setDesignResolution(width, height)`

Change the scale mode or design resolution at runtime and recompute immediately.

## `destroy()`

Removes all listeners (`ResizeObserver` or `window` resize/orientationchange). Call when tearing down the game.

---

## GPU-tier-aware render defaults

`gpuTierRenderDefaults(tier, devicePixelRatio)` — a standalone function also exported from `@emptysock/engine` — maps a `GPUTier` (from `detectGPUTier()`) to safe `RenderSystemOptions` defaults: `antialias` is disabled and `resolution` is capped at 1 below `"mid"` tier, protecting frame time on weak GPUs. `RenderSystem.init()` and `RenderPipeline.init()` accept a `gpuTier` option that applies these defaults automatically when `antialias`/`resolution` aren't explicitly set:

```typescript
import { detectGPUTier, RenderPipeline } from "@emptysock/engine";
import { hostAdapter } from "./host-adapter"; // your HostAdapter implementation

const renderPipeline = new RenderPipeline();
await renderPipeline.init({
  width: 1280,
  height: 720,
  gpuTier: detectGPUTier(hostAdapter),
});
```

---

## Node/Vitest and IDE-iframe safety

Every DOM access (`window`, `document`, `ResizeObserver`) is guarded at the call site, the same pattern `RenderSystem` uses for `window.devicePixelRatio` and `WindowSystem` uses for Tauri detection (see CLAUDE.md's "Engine environment boundary" and "Tauri detection at runtime"). `ViewportSystem.init()` and `recompute()` are safe no-ops in Node/Vitest.
