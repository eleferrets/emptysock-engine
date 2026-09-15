# 22 — UI Widget System

The widget system is a retained-mode UI layer that renders on top of the game canvas. Widgets live in screen space — a `ButtonWidget` at `{ x: 20, y: 20 }` is always 20 px from the top-left corner of the window, unaffected by the camera.

```typescript
import {
  ButtonWidget,
  LabelWidget,
  PanelWidget,
  ProgressBarWidget,
  SliderWidget,
  CheckboxWidget,
  ImageWidget,
} from "@emptysock/engine";
```

---

## Coordinate system

Widget positions are **screen pixels from the top-left** by default. Set `anchor` to reposition relative to any edge or corner — the `x`/`y` offsets are then relative to that anchor point.

| `anchor` value                                  | Origin                         |
| ----------------------------------------------- | ------------------------------ |
| `'top-left'` (default)                          | Top-left corner                |
| `'top'`                                         | Top edge, centred horizontally |
| `'top-right'`                                   | Top-right corner               |
| `'left'` / `'right'`                            | Side edge, centred vertically  |
| `'center'`                                      | Canvas centre                  |
| `'bottom-left'` / `'bottom'` / `'bottom-right'` | Bottom edges                   |

---

## Base Widget properties

Every widget inherits these:

| Property   | Type           | Default      | Description                    |
| ---------- | -------------- | ------------ | ------------------------------ |
| `x`        | `number`       | `0`          | Horizontal offset from anchor  |
| `y`        | `number`       | `0`          | Vertical offset from anchor    |
| `width`    | `number`       | varies       | Widget width in pixels         |
| `height`   | `number`       | varies       | Widget height in pixels        |
| `anchor`   | `WidgetAnchor` | `'top-left'` | Positioning anchor             |
| `visible`  | `boolean`      | `true`       | Whether to render and hit-test |
| `alpha`    | `number`       | `1`          | Opacity 0–1                    |
| `children` | `Widget[]`     | `[]`         | Nested widgets                 |

---

## Events

All widgets emit events via `on()` / `off()`.

```typescript
btn.on("click", () => {
  /* ... */
});
btn.on("hover", () => {
  /* ... */
});
btn.on("hoverOut", () => {
  /* ... */
});
btn.on("change", (value) => {
  /* SliderWidget, CheckboxWidget */
});
btn.on("animEnd", () => {
  /* animation finished */
});
```

---

## Animations

```typescript
widget.animate("fadeIn"); // fades alpha 0→1
widget.animate("fadeOut"); // fades alpha 1→0, then sets visible=false
widget.animate("slideIn", { direction: "left" }); // slides in from 80px away
widget.animate("slideOut", { direction: "down", duration: 300 }); // slides out, hides
widget.animate("pop"); // quick scale bump
widget.animate("shake"); // horizontal shake
```

| Option      | Type                                                   | Default      | Description                      |
| ----------- | ------------------------------------------------------ | ------------ | -------------------------------- |
| `duration`  | `number` (ms)                                          | `200`        | Animation length in milliseconds |
| `easing`    | `'linear' \| 'ease-in' \| 'ease-out' \| 'ease-in-out'` | `'ease-out'` | Easing curve                     |
| `direction` | `'left' \| 'right' \| 'up' \| 'down'`                  | `'left'`     | Direction for slide animations   |

---

## Widget Reference

### ButtonWidget

A labelled clickable button.

```typescript
const btn = new ButtonWidget({
  label: "Start Game",
  x: 0,
  y: 0,
  anchor: "center",
  width: 160,
  height: 44,
});
btn.on("click", () =>
  SceneManagerInstance.transition("game", { effect: "fade" }),
);
```

| Option              | Type      | Default        | Description                                  |
| ------------------- | --------- | -------------- | -------------------------------------------- |
| `label`             | `string`  | `'Button'`     | Button text                                  |
| `icon`              | `string`  | —              | Emoji or single character shown before label |
| `color`             | `string`  | `'#ffffff'`    | Text colour                                  |
| `background`        | `string`  | `'#3a3a5c'`    | Normal background                            |
| `hoverBackground`   | `string`  | `'#4a4a7c'`    | Background on hover                          |
| `pressedBackground` | `string`  | `'#2a2a4c'`    | Background when pressed                      |
| `borderRadius`      | `number`  | `4`            | Corner radius in pixels                      |
| `fontSize`          | `number`  | `14`           | Font size in pixels                          |
| `font`              | `string`  | `'sans-serif'` | CSS font family                              |
| `disabled`          | `boolean` | `false`        | Prevents clicks and dims the button          |
| `animateOnHover`    | `boolean` | `true`         | Plays a `'pop'` animation on hover           |

**Read-only property:** `state` — `'normal' | 'hover' | 'pressed' | 'disabled'`

---

### LabelWidget

A non-interactive text element.

```typescript
const title = new LabelWidget({
  text: "High Scores",
  anchor: "top",
  x: 0,
  y: 40,
  fontSize: 28,
  color: "#ffffff",
});
```

| Option     | Type                            | Default        | Description         |
| ---------- | ------------------------------- | -------------- | ------------------- |
| `text`     | `string`                        | `''`           | Display text        |
| `color`    | `string`                        | `'#ffffff'`    | Text colour         |
| `fontSize` | `number`                        | `16`           | Font size in pixels |
| `font`     | `string`                        | `'sans-serif'` | CSS font family     |
| `align`    | `'left' \| 'center' \| 'right'` | `'left'`       | Text alignment      |

---

### PanelWidget

A rectangular background container. Add child widgets to `panel.children`.

```typescript
const panel = new PanelWidget({
  anchor: "center",
  width: 320,
  height: 240,
  background: "rgba(20,20,40,0.9)",
  borderRadius: 8,
  border: "#555577",
});

const heading = new LabelWidget({
  text: "Paused",
  anchor: "top",
  x: 0,
  y: 24,
  fontSize: 22,
});
panel.children.push(heading);
```

| Option         | Type     | Default     | Description                        |
| -------------- | -------- | ----------- | ---------------------------------- |
| `background`   | `string` | `'#1e1e2e'` | Fill colour or CSS colour string   |
| `border`       | `string` | —           | Stroke colour. Omit for no border. |
| `borderWidth`  | `number` | `1`         | Stroke width in pixels             |
| `borderRadius` | `number` | `0`         | Corner radius                      |

---

### ProgressBarWidget

Horizontal or vertical fill bar — health bars, loading indicators.

```typescript
const healthBar = new ProgressBarWidget({
  x: 16,
  y: 16,
  width: 200,
  height: 14,
  value: 0.75, // 0–1 by default, or use min/max
  fillColor: "#4caf50",
  trackColor: "#333333",
});

// Update each frame:
healthBar.value = player.hp / player.maxHp;
```

| Option       | Type         | Default     | Description             |
| ------------ | ------------ | ----------- | ----------------------- |
| `value`      | `number`     | `0`         | Current value           |
| `min`        | `number`     | `0`         | Minimum value           |
| `max`        | `number`     | `1`         | Maximum value           |
| `fillColor`  | `string`     | `'#4caf50'` | Fill colour             |
| `trackColor` | `string`     | `'#333333'` | Background track colour |
| `direction`  | `'h' \| 'v'` | `'h'`       | Fill direction          |

---

### SliderWidget

A draggable value picker.

```typescript
const volumeSlider = new SliderWidget({
  x: 20,
  y: 120,
  width: 200,
  value: 0.8,
  min: 0,
  max: 1,
  step: 0.05,
});
volumeSlider.on("change", (v) => {
  audio.masterVolume = v as number;
});
```

| Option       | Type     | Default     | Description                 |
| ------------ | -------- | ----------- | --------------------------- |
| `value`      | `number` | `0`         | Initial value               |
| `min`        | `number` | `0`         | Minimum                     |
| `max`        | `number` | `1`         | Maximum                     |
| `step`       | `number` | `0`         | Snap step. `0` = continuous |
| `trackColor` | `string` | `'#555555'` | Track colour                |
| `thumbColor` | `string` | `'#818cf8'` | Thumb colour                |

`normalised` — read-only, returns `value` mapped to 0–1 regardless of min/max.

---

### CheckboxWidget

A toggleable checkbox.

```typescript
const sfxToggle = new CheckboxWidget({
  x: 20,
  y: 160,
  checked: true,
  label: "Sound Effects",
});
sfxToggle.on("change", (v) => {
  sfxEnabled = v as boolean;
});
```

| Option     | Type      | Default     | Description               |
| ---------- | --------- | ----------- | ------------------------- |
| `checked`  | `boolean` | `false`     | Initial state             |
| `label`    | `string`  | `''`        | Text shown beside the box |
| `color`    | `string`  | `'#818cf8'` | Check colour              |
| `boxColor` | `string`  | `'#333355'` | Box background            |
| `fontSize` | `number`  | `13`        | Label font size           |

---

### ImageWidget

Renders a loaded image or sprite sheet frame.

```typescript
const icon = new ImageWidget({
  src: "assets/icon.png",
  x: 8,
  y: 8,
  width: 48,
  height: 48,
});
```

| Option | Type                             | Default  | Description                           |
| ------ | -------------------------------- | -------- | ------------------------------------- |
| `src`  | `string`                         | —        | Image path                            |
| `fit`  | `'fill' \| 'contain' \| 'cover'` | `'fill'` | How the image fills the widget bounds |

---

## Adding widgets to a scene

Add widgets to `this.uiSystem` inside `onLoad`. The `uiSystem` property is available on every `Scene`.

```typescript
class HUDScene extends Scene {
  private _healthBar!: ProgressBarWidget;

  override async onLoad(): Promise<void> {
    this._healthBar = new ProgressBarWidget({
      x: 16,
      y: 16,
      width: 200,
      height: 14,
    });
    this.uiSystem.add(this._healthBar);
  }

  override onUpdate(_dt: number): void {
    this._healthBar.value = player.hp / player.maxHp;
  }

  override onDestroy(): void {
    this.uiSystem.clear();
  }
}
```

> Call `this.uiSystem.clear()` in `onDestroy` to remove all widgets when the scene unloads. Widgets are not automatically removed.

---

## Nesting widgets

Set `children` to group widgets. Child coordinates are absolute screen positions, not relative to the parent. The parent is drawn first; children are drawn on top in array order.

```typescript
const panel = new PanelWidget({ anchor: "center", width: 300, height: 180 });
const label = new LabelWidget({
  text: "Choose difficulty",
  anchor: "top",
  x: 0,
  y: 32,
});
const easyBtn = new ButtonWidget({
  label: "Easy",
  x: 80,
  y: 100,
  anchor: "top",
  width: 120,
  height: 36,
});
panel.children.push(label, easyBtn);
this.uiSystem.add(panel);
```

---

## Using widgets for pause menus (push / pop)

```typescript
class PauseScene extends Scene {
  override async onLoad(): Promise<void> {
    const panel = new PanelWidget({
      anchor: "center",
      width: 260,
      height: 200,
      background: "rgba(10,10,20,0.92)",
    });
    const resume = new ButtonWidget({
      label: "Resume",
      anchor: "center",
      y: -30,
      width: 160,
      height: 40,
    });
    const quit = new ButtonWidget({
      label: "Quit to Menu",
      anchor: "center",
      y: 30,
      width: 160,
      height: 40,
    });

    resume.on("click", () => SceneManagerInstance.popScene());
    quit.on("click", () => SceneManagerInstance.load("title"));

    panel.children.push(resume, quit);
    this.uiSystem.add(panel);
    panel.animate("fadeIn", { duration: 150 });
  }
}

// In the game scene's onUpdate, when Escape is pressed:
if (input.wasPressed("Escape")) {
  SceneManagerInstance.pushScene(new PauseScene());
}
```
