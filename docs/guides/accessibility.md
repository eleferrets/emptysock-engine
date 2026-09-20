# Accessibility

The engine ships three primitives. None of them make a game accessible by themselves — they exist so you can build the accessible parts of your settings menu without hand-rolling the plumbing.

## Control remapping (`InputBindings`)

This is the single highest-value accessibility feature you can ship — most "accessibility" requests from players are really "let me remap my controls." Query actions instead of raw key codes:

```typescript
import { InputBindings, createBindingsSaveSystem } from "@emptysock/engine";

const bindings = new InputBindings(input, {
  jump: [{ kind: "key", code: "Space" }],
  moveLeft: [{ kind: "key", code: "ArrowLeft" }],
});

if (bindings.isActionActive("jump")) player.jump();
```

Let players rebind from a settings screen and persist the result:

```typescript
bindings.rebind("jump", [{ kind: "key", code: "KeyW" }]);
const save = createBindingsSaveSystem();
bindings.save(save);
// next launch:
bindings.load(save);
```

See the [InputBindings reference](../reference/systems/input-bindings.md) for the full `Binding` union (keys, mouse buttons, gamepad buttons and axes).

## Colourblind filter (`PostProcessSystem`)

`PostProcessSystem` exposes a `"colourblind"` layer filter with `mode: "protanopia" | "deuteranopia" | "tritanopia"`.

**Be clear about what this is.** The shipped matrices (`COLOURBLIND_MATRICES`) are the standard Brettel/Viénot/Machado _simulation_ matrices — the same ones browser devtools use to show a non-colourblind developer what a colourblind player sees. They are a design/QA tool for checking your palette, not a daltonisation/correction filter that increases discriminability for a colourblind player. A real correction algorithm needs per-scene palette analysis and is out of scope here. If you want your game genuinely accessible to colourblind players, the reliable fix is still palette choice — never rely on red vs. green as the only signal (add shape, pattern, or a border), and check your palette under this filter during development.

```typescript
import { colourblindFilterDefsSVG } from "@emptysock/engine";

// Once, at startup: inject the filter defs so url(#es-cvd-<mode>) resolves.
document.body.insertAdjacentHTML("beforeend", colourblindFilterDefsSVG());

postProcess.setLayerFilter("ui", { type: "colourblind", mode: "protanopia" });
```

## Text scale (`accessibilitySettings`)

A single global multiplier every `LabelWidget` reads when it renders:

```typescript
import { accessibilitySettings } from "@emptysock/engine";

// Wire to a settings-menu slider (0.5–3):
accessibilitySettings.textScale = 1.5;
```

There is no per-widget override in this pass — every label scales together, which covers the common "make all the UI text bigger" request without threading a prop through every panel.
