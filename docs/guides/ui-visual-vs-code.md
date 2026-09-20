# Building UI: visual vs code

You can build a `Widget`/`UISystem` layout two ways — drag it together in the
**UI Placement Panel**, or construct `Widget` instances by hand in a scene's
`onLoad`. Both paths produce the same data. Neither is a "real" one with the
other as a lossy export.

For widget option reference, see [UISystem reference](../reference/systems/ui-system.md).

---

## One data shape, two ways to write it

The panel's saved layout is a list of `{ id, type, opts }` entries, where
`opts` **is** the constructor-options object for that widget's class —
`ButtonWidgetOpts`, `LabelWidgetOpts`, and so on. Nothing about the panel's
format is IDE-specific. There is no translation step that can lose
information, because there is nothing to translate: the panel edits the same
fields the constructor takes, and stores them under the same names.

`apps/ide/src/components/panels/ui-placement/layout.ts` exports
`layoutToWidgets()`, which turns a saved layout into real `Widget` instances:

```typescript
function layoutToWidgets(layout: PlacedWidget[]): Widget[] {
  return layout.map((w) => new CTOR[w.type](w.opts));
  // (abbreviated — see the source for the actual per-type switch)
}
```

A developer who never opens the panel writes the equivalent by hand:

```typescript
import { ButtonWidget, LabelWidget, type UISystem } from "@emptysock/engine";

export function buildHud(uiSystem: UISystem): void {
  const title = new LabelWidget({
    text: "Score: 0",
    anchor: "top-left",
    x: 12,
    y: 12,
    fontSize: 18,
  });
  uiSystem.add(title);

  const pauseBtn = new ButtonWidget({
    label: "Pause",
    anchor: "top-right",
    x: 12,
    y: 12,
    width: 100,
    height: 32,
  });
  pauseBtn.on("click", () => {
    /* pause the scene */
  });
  uiSystem.add(pauseBtn);
}
```

Placing the same two widgets in the panel and clicking **Insert all** emits
exactly this construction — same class names, same option keys, same values.
That's the round-trip: pick either starting point, and the other is one call
(`layoutToWidgets`, or hand-writing `new Widget(opts)`) away.

---

## When to use which

**Visual (panel):** fast iteration on layout — positions, anchors, sizing,
colours — with a live preview rendered through the real `UISystem`, not a
mockup. Good for HUDs and menus where you're eyeballing placement.

**Code:** anything with logic — `onChange` callbacks, conditional visibility,
widgets created at runtime (a dynamically-sized inventory grid), or animation
sequences chained with `widget.animate(...)`. The panel can't author a
callback, since a saved layout is data, not a script; wire callbacks after
construction, whichever path built the widget.

**Both, in the same layout:** place the static chrome (a `PanelWidget`
background, `LabelWidget` title) in the panel, click **Insert**, then extend
the generated code by hand to add the dynamic parts. Because the panel emits
real constructor calls and not a proprietary format, this mixing costs
nothing.

---

## Anchors and animation

The panel's anchor grid sets `WidgetAnchor` (the 9-way `top-left` … `bottom-right`
system from `ui/widgets/base.ts`) exactly as the constructor option does.
Animations (`AnimationName` — `fadeIn`, `fadeOut`, `slideIn`, `slideOut`,
`pop`, `shake`) are triggered by calling `widget.animate(name, opts)` at
runtime; they're not part of a widget's static constructor options, so they
belong in code regardless of which path built the widget — call `animate()`
on a panel-built widget the same way you would on a hand-built one.
