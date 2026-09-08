# 16. Hot-Reload Research and Implementation Plan

This document covers the current state of the in-IDE reload pipeline, what true HMR would require, known browser limitations, and the recommended incremental approach.

---

## 16.1 Current state

Pressing `Ctrl+S` in the Code Editor triggers a full rebuild-and-refresh cycle:

1. `GameBuildService.buildNow()` runs esbuild-wasm over the virtual file system.
2. The resulting bundle is written to a Blob URL.
3. The preview iframe's `src` is replaced with the new Blob URL.
4. The iframe reloads from scratch: the game's `onLoad` runs, physics worlds are created, the first frame renders.

Round-trip time is typically 200–800 ms on a mid-range laptop, dominated by esbuild's initial parse. For small incremental changes (one function body) this is perceptibly slow but usable. For large projects (many modules, heavy assets), the full reload can take several seconds.

---

## 16.2 What HMR would require

Hot Module Replacement (HMR) would preserve game state across code changes and reload only the changed module. A full HMR implementation would need:

### a. esbuild watch mode

esbuild-wasm does not expose a native watch API in browser contexts. The `transform` API can be called incrementally, but dependency graph tracking (knowing which modules import the changed file) would need to be reimplemented in the IDE. This is non-trivial: esbuild's graph is internal and not exposed via the WASM API.

**Alternative:** maintain a lightweight dependency graph in `GameBuildService` by parsing `import` statements from the virtual file set on each keystroke. On save, walk the reverse-dependency graph to identify the minimal rebuild boundary.

### b. postMessage to iframe

The IDE cannot access the iframe's JS globals directly (same-origin policy applies even for Blob URLs loaded from the same origin in some browser configurations). Communication must go through `window.postMessage`. The iframe would need to expose a `__es_hmr__` message handler that accepts a new module's source and hot-swaps it.

### c. Module re-evaluation without full reload

ES modules are cached by the browser's module registry keyed on URL. Once a URL is loaded, `import('./game.js')` always returns the cached module — there is no public API to evict a URL from the module cache.

The only reliable workaround is a cache-busting query parameter:

```ts
// Inside the iframe's HMR handler
const { default: GameScene } = await import(`./game.js?v=${Date.now()}`);
```

Each cache-busting import creates a new module namespace object. The old module's top-level side effects (event listener registrations, singleton mutations) are not automatically undone. This is the core unsolved problem of browser HMR.

---

## 16.3 Browser limitation: module cache is immutable

There is no `moduleRegistry.evict(url)` API in any browser. The ES specification deliberately does not expose this. Cache-busting query parameters work only for the top-level dynamic import — if the re-imported module itself statically imports other modules, those sub-imports are resolved against their original URLs (without the query param) and will hit the cache.

This means full module-graph HMR is not achievable with static imports. The workaround is to make the game bundle a **single bundle** (no code-splitting), so the cache-busting import is sufficient to get fresh code for the entire game.

---

## 16.4 Recommended approach

For the near term, the recommended HMR strategy is **scene-level hot swap** using a single bundle and cache-busting dynamic import:

### Iframe-side receiver

```ts
// Inside the preview iframe's bootstrap script
let currentScene: Scene | null = null;

window.addEventListener("message", async (ev: MessageEvent) => {
  if (ev.data?.type !== "__es_hmr_update__") return;
  const { bundleUrl } = ev.data as { bundleUrl: string };

  // Cache-busting: append timestamp to force a fresh module evaluation
  const { createScene } = await import(`${bundleUrl}?v=${Date.now()}`);

  if (currentScene) {
    // Tear down the current scene without destroying the physics world
    // Physics world is kept alive so body positions / velocities persist
    currentScene.onDestroy({ keepPhysics: true });
  }

  currentScene = createScene();
  await currentScene.onLoad();
});
```

### IDE-side sender

```ts
// In GameBuildService, after a successful build
const blobUrl = URL.createObjectURL(
  new Blob([bundle], { type: "text/javascript" }),
);
previewIframe.contentWindow?.postMessage(
  { type: "__es_hmr_update__", bundleUrl: blobUrl },
  "*",
);
```

### What this preserves

- Physics world (`PhysicsSystem2D` / `PhysicsSystem3D`) bodies remain in memory; their positions carry over.
- The iframe document is not reloaded; DOM elements and canvas contexts survive.
- Audio context is not re-created; no audio glitch on hot swap.

### What this does not preserve

- Module-level side effects in the new bundle run fresh (singleton constructors, `pluginSystem.register()` calls).
- Any component state stored in local closures (not in the `Entity` / `Scene` data model) is lost.
- If the new bundle's `createScene()` changes the entity schema, existing physics bodies will be orphaned.

---

## 16.5 Estimated complexity

**Medium.** The iframe receiver, postMessage handshake, and cache-busting dynamic import are each straightforward. The difficulty lies in:

- Defining a stable `createScene` export contract that all games must implement.
- Handling the case where the new bundle fails to parse or throws during `onLoad` (the old scene should remain running).
- Deciding which state is "hot-swappable" vs. which changes require a full reload (e.g. asset list changes, physics world schema changes).

A prototype could be built in a single sprint. A production-ready implementation (error recovery, partial-hot-swap for asset-only changes, developer UI to force full reload) would take two to three sprints.

---

## 16.6 Non-goals

**Hot-reloading Rust/WASM is not supported and will not be.** WASM modules are binary blobs; the browser does not support incremental WASM compilation or hot-swap of WASM instances. Any change to Tauri plugin code, Rapier3D bindings, or the Tauri `lib.rs` entry point requires:

1. `cargo build` (full Rust compile — tens of seconds to minutes).
2. Re-linking the Tauri binary.
3. Restarting the Tauri process.

This is an OS-level constraint, not an EmptySock limitation. There is no plan to work around it.
