# From GameMaker

This guide is for developers who have an existing **GameMaker Studio 2 (GMS2)** project and want to move it to EmptySock Engine.

Read this guide if you have a `.yyp` GMS2 project file and want to bring it over, you want to understand how GML maps to TypeScript, or you want to know what is automated versus what needs manual work.

If you are starting a new project from scratch, go to [Your First Game](./your-first-game.md) instead.

---

## What is automated

The toolchain reads your `.yyp` project and generates TypeScript stub files — one per GML object and one per GML script. Your project will compile immediately (with type errors to fix). Object names and variable declarations are preserved.

## What is not automated

The actual GML logic inside events. GML-to-TypeScript transpilation is not automated; the migration report identifies every line that needs manual attention.

---

## Step 1: Export from GMS2

No special export step is required. Point the importer directly at your existing GMS2 project file.

Locate your project's `.yyp` file — it sits at the root of the GMS2 project folder alongside the `objects/`, `scripts/`, and `rooms/` subdirectories.

---

## Step 2: Run the importer

```bash
emptysock-toolchain import --from gms2 --project path/to/game.yyp --out ./my-game/
```

The importer will:

1. Parse the `.yyp` resource manifest.
2. Read each GML object and script source file.
3. Write TypeScript stub files under `./my-game/src/`.
4. Write `migration-report.md` at the project root.

Add `--dry-run` to print what would be generated without writing files.

---

## Step 3: Review migration-report.md

The report contains:

- **Asset inventory** — every GMS2 asset type found, with counts and names.
- **Unresolved GML calls** — every GML built-in with no direct equivalent in EmptySock, listed by file and line number.
- **Suggested mappings** — where a 1:1 or near-1:1 mapping exists, the report shows the EmptySock equivalent.
- **Room layout notes** — room dimensions and layer structure, for manual reconstruction.
- **Shader files** — `.glsl` files extracted from shader assets; they require manual porting to the `PostProcessSystem` API.

Work through the report top-to-bottom; fix the highest-confidence mappings first.

---

## GML to TypeScript mapping

| GML                                       | TypeScript / EmptySock                                               | Notes                                           |
| ----------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------- |
| `instance_create_layer(x, y, layer, obj)` | `scene.createEntity()` + `addComponent`                              | Objects become entities with components         |
| `instance_destroy()`                      | `entity.destroy()`                                                   | Same concept, different name                    |
| `object_index`                            | Entity constructor reference / `getComponent`                        | Use component type as identity                  |
| `alarm[0] = 60`                           | `entity.startCoroutine(function*() { yield waitFrames(60); fn(); })` | Coroutines replace alarms                       |
| `hspeed` / `vspeed`                       | Physics body velocity via `PhysicsBody`                              | Set velocity on the physics component           |
| `sprite_index` / `image_index`            | `Sprite` component + `Animator`                                      | Sprites are components, not built-ins           |
| `global.variable`                         | Module-level `let` / `const`                                         | Module scope is process-global                  |
| `with (obj_enemy) { ... }`                | `scene.query(EnemyComponent).forEach(...)`                           | Query by component type                         |
| `room_goto(rm_next)`                      | `SceneManager.load('SceneName')`                                     | Rooms are Scenes                                |
| `draw_sprite(spr, img, x, y)`             | `Sprite` component (declarative, drawn by engine)                    | No immediate-mode drawing API                   |
| `audio_play_sound(snd, priority, loop)`   | `Audio.play('sound-name', { loop })`                                 | Name must match asset filename                  |
| `instance_number(obj)`                    | `scene.query(MyComponent).length`                                    | Count entities with a component                 |
| `place_meeting(x, y, obj)`                | Overlap query via `PhysicsBody` sensors                              | Physics handles collision detection             |
| `path_start(path, speed, ...)`            | `NavMeshSystem` + waypoint coroutine                                 | See [Navigation guide](../guides/navigation.md) |
| `draw_text(x, y, string)`                 | `UISystem` label widget                                              | UI is component-based                           |
| `game_restart()`                          | `SceneManager.load(currentSceneName)`                                | Reload the scene                                |
| `irandom(n)`                              | `Math.floor(Math.random() * (n + 1))`                                | 0..n inclusive                                  |
| `point_direction(x1, y1, x2, y2)`         | `Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI)`                     | Returns degrees                                 |

---

## GML compat shim

During migration, use the `@emptysock/engine/compat` shim to avoid rewriting low-risk utility calls immediately:

```typescript
import * as GML from "@emptysock/engine/compat";

// These work identically to their GML equivalents:
GML.lerp(a, b, t);
GML.clamp(v, lo, hi);
GML.irandom(n);
GML.string(v);
GML.string_length(s);
GML.string_pos(sub, s);
GML.ds_map_create();
GML.ds_map_set(m, k, v);
GML.ds_map_find_value(m, k);
GML.ds_map_destroy(m);
GML.ds_list_create();
GML.ds_list_add(l, v);
GML.ds_list_find_value(l, i);
GML.ds_list_size(l);
GML.ds_list_destroy(l);
```

> The compat shim is a migration aid, not a production dependency. Replace shim calls with idiomatic TypeScript as you stabilise each object.

---

## Asset migration table

| GMS2 asset type      | Status        | Notes                                                            |
| -------------------- | ------------- | ---------------------------------------------------------------- |
| Objects → Components | Auto-stub     | Manual GML migration required                                    |
| Scripts → TS modules | Auto-stub     | Manual GML migration required                                    |
| Rooms → Scenes       | Not automated | Recreate manually                                                |
| Sprites              | Not automated | Copy PNG files, import via Asset Browser                         |
| Sounds               | Not automated | Copy audio files, reference via `Audio.play`                     |
| Tilesets / Tilemaps  | Not automated | Recreate in Tilemap Editor panel                                 |
| Sequences            | Not automated | Recreate in Sequence Editor panel                                |
| Paths                | Not automated | Use `NavMeshSystem` or a waypoint coroutine                      |
| Shaders              | Not automated | Port `.glsl` to `PostProcessSystem` custom effect                |
| Fonts                | Not automated | Use Google Fonts or inline a `@font-face` via UISystem           |
| Extensions           | Not automated | Most map to a Plugin — see [Plugins guide](../guides/plugins.md) |

---

## Common migration errors

**`Property 'x' does not exist on type 'Entity'`**

In GML, `x` and `y` are built-in instance variables. In EmptySock, position is on the `Transform` component.

```typescript
// After (EmptySock):
const t = entity.requireComponent(Transform);
t.x = 100;

// Or use the shorthand:
entity.position = { x: 100, y: entity.position.y };
```

---

**`Cannot find module '../entities/Player'` (import fails silently during play)**

The file exists on disk but is not open in the IDE's Files panel. The in-browser build only sees files in the open-files map.

**Fix:** Open the file in the IDE's Files panel so it is included in the virtual filesystem at build time.

---

**`ComponentNotFoundError: Health not found on entity 'Enemy'`**

You called `entity.requireComponent(Health)` but the entity was created without `addComponent(Health, ...)`.

```typescript
enemy.addComponent(Health, 100); // must be added before requireComponent
```

---

**`[Timer] callback fired after scene destroyed`**

You forgot to cancel a `Timer` handle in `onDestroy()`.

```typescript
override onDestroy(): void {
  this.spawnTimer.cancel(); // always cancel in onDestroy
}
```

---

## Known limitations

- **Dynamic typing:** GML is dynamically typed. Migrated stubs compile, but adding real TypeScript types will surface implicit `any` chains — fix these file by file.
- **Built-in room system:** GMS2's room editor, layers, and depth system differ substantially from EmptySock's `LayerSystem`. Rooms must be recreated manually.
- **`ds_grid`, `ds_priority`, `ds_stack`:** No direct equivalents. Use TypeScript arrays and `Map`.
- **GML event order:** GMS2 fires Create → Step Begin → Step → Step End → Draw events in a fixed order. EmptySock's `onUpdate` is a single synchronous callback; split logic that depended on event order into separate coroutines or actor messages.
- **`persistent` objects:** GMS2 persistent objects survive room transitions automatically. In EmptySock, use a module-level singleton or pass state through `SceneManager.load()` options.
- **`async` events (HTTP, dialog):** Use `fetch` directly in TypeScript; wrap the result in an actor message to re-enter game logic synchronously.
