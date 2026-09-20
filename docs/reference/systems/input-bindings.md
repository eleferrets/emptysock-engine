# InputBindings

`InputBindings` maps named actions (`"jump"`, `"moveLeft"`) to physical inputs (keys, mouse buttons, gamepad buttons/axes) so game code queries `isActionActive("jump")` instead of a raw key code. Players can rebind at runtime, and the resulting map persists through `SaveSystem`.

Import: `import { InputBindings, createBindingsSaveSystem } from '@emptysock/engine';`

---

## `new InputBindings(input: InputSystem, defaults: ActionMap, gamepad?: GamepadSystem)`

`defaults` maps an action name to an array of `Binding`s (any one being active makes the action active).

```typescript
import { InputBindings, InputSystem } from "@emptysock/engine";

const input = new InputSystem();
input.attach();

const bindings = new InputBindings(input, {
  jump: [{ kind: "key", code: "Space" }],
  moveLeft: [
    { kind: "key", code: "ArrowLeft" },
    { kind: "key", code: "KeyA" },
  ],
});
```

## `isActionActive(action): boolean` / `isActionPressed(action): boolean`

```typescript
if (bindings.isActionActive("jump")) player.jump();
```

## `rebind(action, bindings)` / `addBinding(action, binding)` / `resetToDefaults()`

```typescript
// Player remaps jump to W in a settings menu:
bindings.rebind("jump", [{ kind: "key", code: "KeyW" }]);
```

## `save(save: SaveSystem<BindingsSaveSlot>)` / `load(save)`

Bindings persist through a `SaveSystem` configured with the `BindingsSaveSlot` schema — use `createBindingsSaveSystem()` rather than the default `GameSaveSlot`-shaped `SaveSystem`.

```typescript
import { createBindingsSaveSystem } from "@emptysock/engine";

const bindingsSave = createBindingsSaveSystem();
bindings.save(bindingsSave); // persist a rebind
bindings.load(bindingsSave); // on next launch
```

## Binding kinds

- `{ kind: "key", code: string }` — a `KeyboardEvent.code`.
- `{ kind: "mouseButton", button: number }`.
- `{ kind: "gamepadButton", index: number, padIndex?: number }`.
- `{ kind: "gamepadAxis", axis: number, threshold: number, padIndex?: number }` — active when the axis crosses `threshold` (sign matters: negative threshold checks `<=`).
