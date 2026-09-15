# UISystem / Widget System

The Widget system is a retained-mode UI layer that renders on top of the game canvas in screen space. All widgets live in `packages/engine/src/ui/` and are exported from `@emptysock/engine`.

For a complete guide with widget-by-widget examples see [`docs/manual/22-ui-widgets.md`](../../manual/22-ui-widgets.md).

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

## Adding widgets to a scene

```typescript
class HUDScene extends Scene {
  override async onLoad(): Promise<void> {
    const bar = new ProgressBarWidget({ x: 16, y: 16, width: 200, height: 14 });
    this.uiSystem.add(bar);
  }
  override onDestroy(): void {
    this.uiSystem.clear(); // widgets are not removed automatically
  }
}
```

`this.uiSystem` is available on every `Scene`.

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

**`WidgetAnchor` values:** `'top-left'` · `'top'` · `'top-right'` · `'left'` · `'center'` · `'right'` · `'bottom-left'` · `'bottom'` · `'bottom-right'`

---

## Widget events

```typescript
widget.on("click", () => {
  /* ... */
}); // ButtonWidget
widget.on("hover", () => {
  /* ... */
});
widget.on("hoverOut", () => {
  /* ... */
});
widget.on("change", (value) => {
  /* ... */
}); // SliderWidget, CheckboxWidget
widget.on("animEnd", () => {
  /* ... */
}); // animation finished
```

---

## Animations

```typescript
widget.animate("fadeIn");
widget.animate("fadeOut");
widget.animate("slideIn", { direction: "left" });
widget.animate("slideOut", { direction: "down", duration: 300 });
widget.animate("pop");
widget.animate("shake");
```

| Option      | Type                                                   | Default      |
| ----------- | ------------------------------------------------------ | ------------ |
| `duration`  | `number` (ms)                                          | `200`        |
| `easing`    | `'linear' \| 'ease-in' \| 'ease-out' \| 'ease-in-out'` | `'ease-out'` |
| `direction` | `'left' \| 'right' \| 'up' \| 'down'`                  | `'left'`     |

---

## Widget types

| Widget              | Key options                                                      |
| ------------------- | ---------------------------------------------------------------- |
| `ButtonWidget`      | `label`, `icon`, `disabled`, `animateOnHover`; read-only `state` |
| `LabelWidget`       | `text`, `fontSize`, `color`, `align`                             |
| `PanelWidget`       | `background`, `border`, `borderRadius`, `children`               |
| `ProgressBarWidget` | `value`, `min`, `max`, `fillColor`, `trackColor`, `direction`    |
| `SliderWidget`      | `value`, `min`, `max`, `step`; read-only `normalised`            |
| `CheckboxWidget`    | `checked`, `label`                                               |
| `ImageWidget`       | `src`, `fit` (`'fill' \| 'contain' \| 'cover'`)                  |
