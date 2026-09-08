# 17. Spine Animation Support Plan

This document describes the plan for integrating Esoteric Software's Spine 2D skeletal animation format into EmptySock as an optional add-on package.

---

## 17.1 Overview

[Spine 2D](http://esotericsoftware.com) is the industry-standard skeletal animation tool for 2-D games. It exports JSON (`.json`) or binary (`.skel`) skeleton data alongside a texture atlas (`.atlas` + texture sheet). At runtime, a Spine runtime library reads this data and poses the skeleton each frame, blending between named animations.

EmptySock does not include Spine support in the engine core. It will be distributed as a separate optional package (`@emptysock/spine`) to keep the base bundle size small for games that do not use skeletal animation.

---

## 17.2 Runtime library

The integration will use [`@pixi-spine/runtime-4.1`](https://github.com/pixijs/spine) — the official PixiJS Spine plugin, which wraps Esoteric Software's Spine 4.1 runtime for the browser. It is the only Spine runtime with active PixiJS v8 support.

The `@emptysock/spine` package will:

1. Wrap `@pixi-spine/runtime-4.1` in an engine-compatible component API.
2. Export `SpineAnimator` (the entity component) and `SpineLoader` (the asset pipeline helper).
3. Not re-export any PixiJS or `@pixi-spine` types directly — callers import only from `@emptysock/spine`.

---

## 17.3 API sketch

### SpineAnimator component

```ts
import { SpineAnimator } from "@emptysock/spine";

// Attach to an entity; the skeleton file is pre-loaded via SpineLoader
entity.addComponent(SpineAnimator, {
  skeletonPath: "assets/characters/hero.skel",
  atlasPath: "assets/characters/hero.atlas",
});

const anim = entity.getComponent(SpineAnimator);
```

### Playback control

```ts
// Play a named animation on track 0, looping
anim.setAnimation("run", { loop: true });

// Queue an animation to play after the current one finishes
anim.addAnimation("idle", { loop: true, delay: 0 });

// Cross-fade between two animations
anim.mix("run", "jump", 0.2); // 200 ms blend

// Stop all tracks
anim.clearTracks();

// Read current animation name
const current: string = anim.currentAnimation;

// Listen for animation events (Spine event keys)
anim.onEvent((key: string, _intValue: number, _floatValue: number) => {
  if (key === "footstep") audioSystem.play("sfx_step");
});
```

### Skin switching

```ts
// Swap skin (e.g. character colour variant)
anim.setSkin("blue-variant");
anim.setSlotsToSetupPose(); // reset slot attachments to the new skin
```

---

## 17.4 Asset pipeline

Spine assets must be pre-processed before they can be loaded at runtime:

1. **Export from Spine editor:** export as JSON or binary (`.skel`) + atlas. Set "Premultiplied alpha" on the atlas if the texture packer supports it — PixiJS renders PMA textures correctly without artefacts.
2. **Import via AssetBrowser:** drag the `.skel` (or `.json`), `.atlas`, and texture sheet (PNG) into the AssetBrowser together. The engine recognises the `.skel` + `.atlas` pair and registers them as a single logical asset.
3. **Reference in code:** use the `.skel` path as `skeletonPath` in `SpineAnimator`. The atlas and texture sheet are located automatically from the same directory.

Atlas texture sheets must be square power-of-two for maximum GPU compatibility (`256×256`, `512×512`, `1024×1024`, `2048×2048`). Non-power-of-two sheets work on most devices but are not recommended.

---

## 17.5 License

Esoteric Software's Spine runtime is governed by the [Spine Runtime License](http://esotericsoftware.com/spine-runtimes-license). Key points:

- You may use the Spine runtime for free if the game was created with a licensed copy of the Spine editor.
- You may not redistribute the runtime source as part of a competing animation tool.
- The `@pixi-spine/runtime-4.1` npm package redistributes the runtime under the same license; adding it to your project's `package.json` constitutes acceptance.

The `@emptysock/spine` package documentation will include a prominent license notice. The engine core (`@emptysock/engine`) carries no Spine runtime code and is not affected by this license.

---

## 17.6 Estimated complexity

**High.** The integration touches multiple layers:

| Work item                                                       | Effort |
| --------------------------------------------------------------- | ------ |
| New `packages/spine/` package scaffold, tsconfig, build         | Low    |
| `SpineLoader` — asset pipeline wiring with AssetBrowser         | Medium |
| `SpineAnimator` component — wrapping `@pixi-spine` playback API | Medium |
| `mix()` / track management / event forwarding                   | Medium |
| IDE: AssetBrowser recognises `.skel` + `.atlas` pairs           | Medium |
| IDE: preview of skeleton animations in AssetBrowser             | High   |
| Skin inspector panel                                            | High   |
| Docs, skill file, api-reference.json entry                      | Low    |

Total estimated effort: **3–5 sprints** for a production-ready implementation. A minimal `SpineAnimator` with `setAnimation` and `mix` could ship in one sprint as an alpha.

The implementation will not be part of the engine core. Games that do not use Spine pay zero bundle cost.
