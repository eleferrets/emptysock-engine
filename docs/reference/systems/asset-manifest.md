# AssetManifest

A declarative list of assets (textures, audio, JSON, fonts) with progress reporting and per-asset failure handling, so a game can build its own loading screen. The engine intentionally never owns a loading screen or splash screen (see the "No loading screen, no splash screen" decision in the root `CLAUDE.md`) — `AssetManifest` is the primitive that makes a developer-built one possible: it reports "X of Y assets loaded" so a scene can render its own progress bar.

Import: `import { AssetManifest } from '@emptysock/engine';`

---

## Constructor

```typescript
new AssetManifest(options?: AssetManifestOptions)
```

| Option            | Type                                                                 | Default               | Description                                                                                                                                                                                                 |
| ----------------- | -------------------------------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `textureLoader`   | `TextureLoader` (same type as `RenderPipelineOptions.textureLoader`) | pixi.js `Assets.load` | How "texture" assets are loaded. Sharing `RenderPipeline`'s loader (or leaving both at their shared default) means a preloaded texture is already warm in the same cache `RenderPipeline` resolves through. |
| `audioSystem`     | `AudioSystem`                                                        | none                  | Required to load "audio" assets — they are registered via `audioSystem.load(id, path)`, so `audioSystem.play(id)` reuses the same `Howl` instead of loading a fresh one.                                    |
| `fetchImpl`       | `typeof fetch`                                                       | global `fetch`        | Used to load "json" assets. Inject a stub in tests or headless hosts.                                                                                                                                       |
| `continueOnError` | `boolean`                                                            | `true`                | When `true`, a failed asset is recorded and loading continues. When `false`, `load()` rejects with the first `AssetLoadFailure`.                                                                            |

---

## Building the manifest

### `add(descriptor: AssetDescriptor): this`

### `addAll(descriptors: AssetDescriptor[]): this`

```typescript
interface AssetDescriptor {
  id: string; // lookup key, and the AudioSystem sound id for "audio" assets
  path: string; // path or URL to load from
  type: "texture" | "audio" | "json" | "font";
}
```

### `total: number`

Number of registered descriptors.

---

## Loading

### `load(): Promise<AssetLoadResult>`

Loads every registered asset in order.

```typescript
interface AssetLoadResult {
  loaded: string[]; // ids that loaded successfully
  failed: AssetLoadFailure[]; // ids that failed, with cause
}

interface AssetLoadFailure {
  id: string;
  path: string;
  type: AssetType;
  error: unknown;
}
```

With the default `continueOnError: true`, a failing asset does not stop the rest of the batch — check `result.failed` (or `manifest.failures` afterwards) to decide whether to retry, substitute a placeholder, or abort. With `continueOnError: false`, `load()` rejects with the `AssetLoadFailure` for the first asset that fails.

### `onProgress(listener: (loaded: number, total: number, current: AssetDescriptor) => void): () => void`

Registers a progress listener, called once per asset as it settles (success or failure), in registration order. Returns an unsubscribe function.

### `has(id: string): boolean` / `get(id: string): unknown | undefined`

Read back an already-loaded asset synchronously — a texture (pixi.js `Texture`), a `Howl` (audio), parsed JSON, or a `FontFace`.

### `failures: readonly AssetLoadFailure[]`

The failures from the most recent `load()` call.

---

## Example: a loading-screen scene

```typescript
import { AssetManifest, AudioSystem } from "@emptysock/engine";

class LoadingScene extends Scene {
  async onLoad(): Promise<void> {
    const audio = new AudioSystem();
    const manifest = new AssetManifest({ audioSystem: audio });

    manifest.addAll([
      { id: "hero", path: "assets/hero.png", type: "texture" },
      { id: "jump", path: "assets/jump.ogg", type: "audio" },
      { id: "level1", path: "assets/level1.json", type: "json" },
    ]);

    const bar =
      this.requireEntity("ProgressBar").requireComponent(ProgressBarWidget);
    manifest.onProgress((loaded, total) => {
      bar.value = loaded / total;
    });

    const result = await manifest.load();
    for (const failure of result.failed) {
      console.warn(`Asset "${failure.id}" failed to load:`, failure.error);
    }

    sceneManager.change("Level1");
  }
}
```

Per CLAUDE.md, this loading screen is developer-authored game code (typically the `startScene` or a scene navigated to before gameplay) — the engine does not insert one automatically.

## Font assets

Font loading uses the browser `FontFace` API and registers the loaded font on `document.fonts` when a `document` is present. In a headless host (e.g. Node/Vitest) with no `FontFace` global, loading a "font" asset fails per-asset (recorded in `failures`) rather than throwing — code that doesn't touch `document` still runs.
