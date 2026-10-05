# Input bindings

`InputManager` (`game.input`) is the one remappable-input system: named actions map to `Binding`s (keyboard `code`, gamepad button, gamepad axis with signed threshold). Any active binding makes the action active. There is no separate `KeyBindings` or `InputBindings` class.

Import: `import { InputManager, INPUT_BINDINGS_STORAGE_KEY } from '@emptysock/engine';`

| Member                                                        | Description                                                                                                                                                                                                                           |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `new InputManager(actions?)`                                  | Default `ActionMap`; kept for `resetToDefaults()`. `Game` constructs one as `game.input`.                                                                                                                                             |
| `isDown(action)`                                              | Any binding active in this frame's frozen snapshot.                                                                                                                                                                                   |
| `wasPressed(action)` / `wasReleased(action)`                  | Edge results, computed automatically by `snapshot()` (run first by `Game.update()`); no separate `update()` call.                                                                                                                     |
| `bindAction(action, bindings)` / `rebind(action, bindings)`   | Replace an action's bindings.                                                                                                                                                                                                         |
| `addBinding(action, binding)`                                 | Append (duplicates ignored).                                                                                                                                                                                                          |
| `unbind(action, binding?)`                                    | Remove one binding, or the whole action.                                                                                                                                                                                              |
| `setActions(map)` / `getBindings(action)` / `actions`         | Bulk replace / read.                                                                                                                                                                                                                  |
| `resetToDefaults()`                                           | Restore constructor bindings.                                                                                                                                                                                                         |
| `saveBindings(adapter, key?)` / `loadBindings(adapter, key?)` | Persist via any `StorageAdapter` (default `MemoryStorageAdapter`-compatible); default key `emptysock_input_bindings`. `loadBindings` validates the shape and returns `false`, leaving bindings untouched, on missing or corrupt data. |
| `keyboard.isDown(code)` / `gamepad(i)`                        | Raw frozen-snapshot escape hatches.                                                                                                                                                                                                   |

```typescript
const input = ctx.game.input;
await input.loadBindings(storage);
input.addBinding("jump", { kind: "key", code: "Space" });
input.addBinding("left", { kind: "gamepadAxis", axis: 0, threshold: -0.5 });
// in onUpdate
if (input.wasPressed("jump")) player.jump();
input.rebind("jump", [{ kind: "key", code: "KeyW" }]); // settings menu
await input.saveBindings(storage);
```

## Keyboard layouts

Key bindings use `KeyboardEvent.code` (physical position: `"KeyW"`, `"Space"`, `"ArrowLeft"`), which is layout-independent: the key labelled Z on AZERTY still reports the QWERTY-`KeyW` position. WASD-style movement therefore stays ergonomic on AZERTY/Dvorak, but a settings UI showing "W" would be wrong on AZERTY; label keys with `navigator.keyboard.getLayoutMap()` where available. `KeyboardEvent.key` (the produced character) is not used for bindings.
