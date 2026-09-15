# Hot Reload

This page explains how the IDE's reload pipeline works, what true Hot Module Replacement (HMR) would require, and the recommended approach for fast iteration.

---

## Current state

Pressing `Ctrl+S` in the Code Editor triggers a full rebuild-and-refresh cycle:

1. `GameBuildService.buildNow()` runs esbuild-wasm over the virtual file system.
2. The resulting bundle is written to a Blob URL.
3. The preview iframe's `src` is replaced with the new Blob URL.
4. The iframe reloads from scratch: the game's `onLoad` runs, physics worlds are created, the first frame renders.

Round-trip time is typically 200–800 ms on a mid-range laptop, dominated by esbuild's initial parse. For small incremental changes this is usable. For large projects, the full reload can take several seconds.

---

## What HMR would require

Hot Module Replacement would preserve game state across code changes and reload only the changed module. A full HMR implementation needs:

**A dependency graph.** esbuild-wasm does not expose a native watch API in browser contexts. Incremental rebuilds would require maintaining a lightweight dependency graph in `GameBuildService` by parsing `import` statements from the virtual file set on each keystroke.

**postMessage to iframe.** The IDE cannot access the iframe's JS globals directly. Communication must go through `window.postMessage`. The iframe would need to expose an HMR message handler that accepts a new module's source.

**Module re-evaluation.** ES modules are cached by the browser's module registry keyed on URL. There is no public API to evict a URL from the module cache. The only reliable workaround is a cache-busting query parameter:

```typescript
const { default: GameScene } = await import(`./game.js?v=${Date.now()}`);
```

Each cache-busting import creates a new module namespace object. Old top-level side effects (event listener registrations, singleton mutations) are not automatically undone. This is the core unsolved problem of browser HMR.

---

## The module cache constraint

There is no `moduleRegistry.evict(url)` API in any browser. The ES specification deliberately does not expose this. Cache-busting query parameters work only for the top-level dynamic import — static sub-imports are resolved against their original URLs and hit the cache.

This means full module-graph HMR is not achievable with static imports. The workaround is to make the game bundle a **single bundle** (no code-splitting), so the cache-busting import is sufficient to get fresh code for the entire game. This is what esbuild already produces by default.

---

## Recommended approach: scene-level hot swap

For fast iteration, the recommended strategy is scene-level hot swap using a single bundle and cache-busting dynamic import.

**Inside the preview iframe:**

```typescript
let currentScene: Scene | null = null;

window.addEventListener("message", async (ev: MessageEvent) => {
  if (ev.data?.type !== "__es_hmr_update__") return;
  const { bundleUrl } = ev.data as { bundleUrl: string };

  // Cache-busting: append timestamp to force a fresh module evaluation
  const { createScene } = await import(`${bundleUrl}?v=${Date.now()}`);

  if (currentScene) {
    // Tear down the current scene without destroying the physics world
    currentScene.onDestroy({ keepPhysics: true });
  }

  currentScene = createScene();
  await currentScene.onLoad();
});
```

**Inside `GameBuildService`, after a successful build:**

```typescript
const blobUrl = URL.createObjectURL(
  new Blob([bundle], { type: "text/javascript" }),
);
previewIframe.contentWindow?.postMessage(
  { type: "__es_hmr_update__", bundleUrl: blobUrl },
  "*",
);
```

### What this preserves

- Physics world bodies remain in memory; their positions carry over.
- The iframe document is not reloaded; DOM elements and canvas contexts survive.
- Audio context is not re-created; no audio glitch on hot swap.

### What this does not preserve

- Module-level side effects in the new bundle run fresh.
- Component state stored in local closures (not in the `Entity` / `Scene` data model) is lost.
- If the new bundle's `createScene()` changes the entity schema, existing physics bodies will be orphaned.

---

## Hot-reloading Rust/WASM is not supported

WASM modules are binary blobs; the browser does not support incremental WASM compilation or hot-swap of WASM instances. Any change to Tauri plugin code, Rapier3D bindings, or the Tauri `lib.rs` entry point requires:

1. `cargo build` (full Rust compile — tens of seconds to minutes).
2. Re-linking the Tauri binary.
3. Restarting the Tauri process.

This is an OS-level constraint, not an EmptySock limitation.
