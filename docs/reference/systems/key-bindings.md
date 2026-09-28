# KeyBindings

Remappable action-to-key bindings over `InputManager`'s frozen per-frame keyboard snapshot. Bindings are DOM `KeyboardEvent.code` values (`"KeyW"`, `"Space"`, `"ArrowLeft"`) — physical-key codes, already layout-independent, so no layout translation happens. For the config-driven, gamepad-aware layer see [InputBindings](./input-bindings.md); `KeyBindings` is the small keyboard-only table.

Import: `import { KeyBindings } from '@emptysock/engine';`

Not a `Game` service: it needs an input source and a `StorageAdapter`, so game code constructs it.

## API

| Member                                                   | Description                                                                                                    |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `new KeyBindings(input, storage?, storageKey?)`          | `input` is anything with `keyboard.isDown(code)` (`game.input`). `storage` defaults to `MemoryStorageAdapter`. |
| `bind(action, ...codes)`                                 | Add codes to an action (duplicates ignored).                                                                   |
| `unbind(action, ...codes)`                               | Remove given codes, or the whole action when none given.                                                       |
| `rebind(action, ...codes)`                               | Replace an action's codes.                                                                                     |
| `getBindings(action)`                                    | Copy of the action's codes.                                                                                    |
| `isActionDown(action)`                                   | True if any bound key is down in the frozen snapshot.                                                          |
| `update()`                                               | Compute press/release edges. Call once per frame, after the input snapshot (top of `onUpdate`).                |
| `wasActionPressed(action)` / `wasActionReleased(action)` | Edge results from the last `update()`.                                                                         |
| `save()`                                                 | Persist the table as a JSON blob under `settings/keybindings`.                                                 |
| `load()`                                                 | Replace bindings from storage; returns `false` and keeps current bindings on missing or corrupt data.          |

```typescript
const keys = new KeyBindings(ctx.game.input, storage);
await keys.load();
if (keys.getBindings("jump").length === 0) keys.bind("jump", "Space", "KeyW");
// each frame
keys.update();
if (keys.wasActionPressed("jump")) player.jump();
```
