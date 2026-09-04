# UI Widget System

Status: planned. No widget primitives exist yet. UISystem is an empty Canvas 2D overlay layer with an ImageLoader interface — nothing is rendered through it until this feature is built.

Reference: GameMaker's Flex Panel / UI layer. The goal is the same object model for code and the visual editor — anything you drag together you can script, and anything you script shows up in the editor.

---

## ImageLoader gap (prerequisite)

UISystem currently requires an `ImageLoader` to be injected at construction to render images. This is unnecessary boilerplate — `createImageBitmap` + `fetch` are Web API globals that work in browser, Tauri WebView, and Node 18+ (Vitest), so there is no reason to push this onto every developer.

**Fix before building widgets:** UISystem should construct a default loader internally:

```ts
const defaultImageLoader: ImageLoader = {
  async load(src: string): Promise<ImageBitmap> {
    const res = await fetch(src);
    const blob = await res.blob();
    return createImageBitmap(blob);
  },
};
```

The `imageLoader` constructor parameter becomes optional — only needed when a developer wants to override (custom CDN, auth headers, mocked source in tests). Zero boilerplate for the 99% case.

---

## Widget primitives

All widgets live in `packages/engine/src/ui/` and export from `packages/engine/src/index.ts`.

| Widget | Properties |
|--------|------------|
| `LabelWidget` | `text`, `font`, `fontSize`, `color`, `align` |
| `ButtonWidget` | `label`, `icon?`, state machine (normal / hover / pressed / disabled) |
| `ImageWidget` | `src`, `scaleMode` (fit / fill / stretch / none), `tint?` |
| `PanelWidget` | `background`, `border`, `cornerRadius`, `children: Widget[]` |
| `ProgressBarWidget` | `value`, `min`, `max`, `fillColor`, `direction` (h / v) |
| `SliderWidget` | `value`, `min`, `max`, `step`, `onChange` |
| `CheckboxWidget` | `checked`, `label`, `onChange` |

All widgets share a base `Widget` class:

```ts
abstract class Widget {
  x: number;       // pixels or 0–1 normalised, resolved by layout pass
  y: number;
  width: number;
  height: number;
  anchor: Anchor;  // 'top-left' | 'top' | 'top-right' | 'left' | 'center' | 'right' | 'bottom-left' | 'bottom' | 'bottom-right'
  visible: boolean;
  alpha: number;
  animate(name: AnimationName, opts?: AnimationOpts): void;
  on(event: WidgetEvent, handler: () => void): void;
  off(event: WidgetEvent, handler: () => void): void;
}
```

UISystem owns a widget tree (not entities). Widgets are added/removed via `uiSystem.add(widget)` / `uiSystem.remove(widget)`. Parent/child z-ordering and anchor math is cleaner in a dedicated tree than in the ECS entity model.

---

## Layout

Anchor-based, not flexbox. Each widget declares an anchor point on the screen and an offset from it in pixels. This covers the common game UI cases (top-left HUD, bottom-center health bar, center-screen menu) without the complexity of a full layout engine.

Normalised coordinates (0–1) are also accepted — `x: 0.5, y: 0.8` means 50% across, 80% down. The layout pass resolves these to pixels each frame using the canvas dimensions, so UIs are automatically responsive to screen resize.

No nested flex containers. If a developer needs a scrollable list inside a panel, that is a custom widget that extends `PanelWidget`.

---

## Animations

Built-in named transitions, triggered by `widget.animate(name)` or wired automatically to widget state changes.

| Name | Description |
|------|-------------|
| `fadeIn` | alpha 0 → 1 |
| `fadeOut` | alpha 1 → 0 |
| `slideIn(direction)` | translate from off-screen edge |
| `slideOut(direction)` | translate to off-screen edge |
| `pop` | scale punch (1 → 1.15 → 1), used for button hover/press feedback |
| `shake` | horizontal jitter, used for error feedback |

All animations accept optional `duration` (ms, default 200) and `easing` (`'linear'` | `'ease-in'` | `'ease-out'` | `'ease-in-out'`). Implemented as lightweight tweens inside UISystem's update loop — no external tween library.

Button hover and press states automatically trigger `pop` unless overridden with `animateOnHover: false`.

---

## Code API

```ts
import { ButtonWidget, LabelWidget, PanelWidget } from '@emptysock/engine';

// In a Scene's onLoad:
const panel = new PanelWidget({ anchor: 'center', width: 300, height: 200 });

const title = new LabelWidget({ text: 'Paused', fontSize: 24, anchor: 'top', y: 16 });

const resumeBtn = new ButtonWidget({
  label: 'Resume',
  anchor: 'center',
  y: 20,
});
resumeBtn.on('click', () => this.setPaused(false));

const quitBtn = new ButtonWidget({
  label: 'Quit',
  anchor: 'center',
  y: 70,
});
quitBtn.on('click', () => scene.loadScene('MainMenu'));

panel.children.push(title, resumeBtn, quitBtn);
uiSystem.add(panel);
panel.animate('fadeIn');
```

---

## IDE — visual editor

A new **UI Editor** panel (or a mode inside the existing CanvasPreview panel) shows a scaled preview of the game screen with widget overlays:

- **Widget palette** — drag LabelWidget, ButtonWidget, etc. onto the canvas
- **Selection** — click to select, drag to reposition, resize handles on edges
- **Anchor picker** — 9-point anchor grid in the property panel, updates `anchor` + offset
- **Property panel** — edits all widget fields; changes are reflected in code and vice versa
- **Widget tree** — hierarchy view for panels with children, drag to reorder
- **Animation preview** — play button next to each animation name, previews in the canvas

The editor generates no separate file — it writes directly to the scene's `onLoad` method in the open script, or maintains a widget tree JSON sidecar if the scene has no user script yet.

Undo/redo is mandatory (useHistory, 50-step cap). CSS variables only. Empty state: "No widgets yet — drag one from the palette."

---

## Implementation order

1. Fix UISystem default ImageLoader (no boilerplate for developers)
2. Base `Widget` class + layout pass in UISystem
3. `LabelWidget` + `ImageWidget` (rendering only, no interaction)
4. `ButtonWidget` with state machine + click/hover events + `pop` animation
5. `PanelWidget` with children + `fadeIn`/`fadeOut`
6. Remaining primitives (ProgressBar, Slider, Checkbox)
7. Remaining animations
8. IDE visual editor
9. Docs — new section in `docs/manual/05-systems-reference.md` under UISystem
10. API entries in `ai/api-reference.json` in emptysock-ai-skills
