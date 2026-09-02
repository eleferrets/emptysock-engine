# 11 — GameMaker Studio 2 Migration Guide

---

## Is this guide for me?

This guide is for developers who have an existing **GameMaker Studio 2 (GMS2)** project and want to move it to EmptySock Engine.

You should read this guide if:

- You have a `.yyp` GMS2 project file and want to bring it over
- You want to understand how GML code maps to TypeScript
- You are wondering what will be automated vs. what you'll need to do manually

You do not need this guide if you are starting a new project from scratch. Go to Section 2 — Getting Started instead.

**What is automated:** The toolchain reads your `.yyp` project and generates TypeScript stub files — one per GML object and one per GML script. Your project will compile immediately (with type errors to fix). Object names and variable declarations are preserved.

**What is not automated:** The actual GML logic inside events. GML → TypeScript transpilation is not automated; the migration report identifies every line that needs manual attention.

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

Add the `--dry-run` flag to print what would be generated without writing files.

---

## Step 3: Review migration-report.md

The report is generated alongside your stubs. It contains:

- **Asset inventory** — every GMS2 asset type found, with counts and names.
- **Unresolved GML calls** — every GML built-in function that has no direct equivalent in EmptySock, listed by file and line number.
- **Suggested mappings** — where a 1:1 or near-1:1 mapping exists, the report shows the EmptySock equivalent.
- **Room layout notes** — room dimensions and layer structure, for manual reconstruction.
- **Shader files** — `.glsl` files extracted from shader assets; they require manual porting to the `PostProcessSystem` API (section 5.13).

Work through the report top-to-bottom; fix the highest-confidence mappings first.

---

## Step 4: GML → TypeScript mapping

| GML                                       | TypeScript / EmptySock                                               | Notes                                   |
| ----------------------------------------- | -------------------------------------------------------------------- | --------------------------------------- |
| `instance_create_layer(x, y, layer, obj)` | `scene.createEntity()` + `addComponent`                              | Objects become entities with components |
| `instance_destroy()`                      | `entity.destroy()`                                                   | Same concept, different name            |
| `object_index`                            | Entity constructor reference / `getComponent`                        | Use component type as identity          |
| `alarm[0] = 60`                           | `entity.startCoroutine(function*() { yield waitFrames(60); fn(); })` | Coroutines replace alarms               |
| `hspeed` / `vspeed`                       | Physics body velocity via `PhysicsBody`                              | Set velocity on the physics component   |
| `sprite_index` / `image_index`            | `Sprite` component + `Animator`                                      | Sprites are components, not built-ins   |
| `global.variable`                         | Module-level `let` / `const`                                         | Module scope is process-global          |
| `with (obj_enemy) { ... }`                | `scene.query(EnemyComponent).forEach(...)`                           | Query by component type                 |
| `room_goto(rm_next)`                      | `SceneManager.load('SceneName')`                                     | Rooms are Scenes                        |
| `draw_sprite(spr, img, x, y)`             | `Sprite` component (declarative, drawn by engine)                    | You don't call draw explicitly          |
| `audio_play_sound(snd, priority, loop)`   | `AudioSystem.play('sound-name', { loop })`                           | Name must match asset filename          |
| `draw_set_color(c_red)`                   | Draw via `UISystem` or a custom `PostProcessSystem` pass             | No immediate-mode drawing API           |
| `instance_number(obj)`                    | `scene.query(MyComponent).length`                                    | Count entities with a component         |
| `place_meeting(x, y, obj)`                | Overlap query via `PhysicsBody` sensors                              | Physics handles collision detection     |
| `path_start(path, speed, ...)`            | `NavMeshSystem` + waypoint coroutine                                 | See Section 5.7                         |
| `draw_text(x, y, string)`                 | `UISystem.createLabel(...)`                                          | UI is component-based                   |
| `game_restart()`                          | `SceneManager.load(currentSceneName)`                                | Reload the scene                        |
| `irandom(n)`                              | `Math.floor(Math.random() * (n + 1))`                                | 0..n inclusive                          |
| `choose(a, b, c)`                         | `[a, b, c][Math.floor(Math.random() * 3)]`                           | Random array element                    |
| `point_direction(x1, y1, x2, y2)`         | `Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI)`                     | Returns degrees                         |
| `lengthdir_x(len, dir)`                   | `Math.cos(dir * Math.PI / 180) * len`                                | Degrees → radians conversion required   |

---

## Step 5: GML compat shim

During migration, use the `@emptysock/engine/compat` shim to avoid rewriting low-risk utility calls immediately:

```typescript
import * as GML from "@emptysock/engine/compat";

// These work identically to their GML equivalents:
GML.lerp(a, b, t); // linear interpolate
GML.clamp(v, lo, hi); // clamp a value
GML.irandom(n); // integer in 0..n inclusive
GML.string(v); // coerce any value to string
GML.string_length(s); // s.length
GML.string_pos(sub, s); // s.indexOf(sub) + 1 (1-based, 0 = not found)
GML.ds_map_create(); // returns a Map<string, unknown>
GML.ds_map_set(m, k, v);
GML.ds_map_find_value(m, k);
GML.ds_map_destroy(m); // no-op; GC handles it, but safe to call
GML.ds_list_create(); // returns an Array<unknown>
GML.ds_list_add(l, v);
GML.ds_list_find_value(l, i);
GML.ds_list_size(l);
GML.ds_list_destroy(l); // no-op
```

> **Plan:** The compat shim is a migration aid, not a production dependency. Replace shim calls with idiomatic TypeScript as you stabilise each object.

---

## Asset migration table

| GMS2 asset type      | Status        | Notes                                                            |
| -------------------- | ------------- | ---------------------------------------------------------------- |
| Objects → Components | Auto-stub     | Manual GML migration required                                    |
| Scripts → TS modules | Auto-stub     | Manual GML migration required                                    |
| Rooms → Scenes       | Not automated | Recreate manually; see room notes in migration-report.md         |
| Sprites              | Not automated | Copy PNG/PNG-strip files, import via Asset Browser               |
| Sounds               | Not automated | Copy audio files, reference via `AudioSystem.play`               |
| Tilesets / Tilemaps  | Not automated | Recreate in TilemapEditor panel (section 7.6)                    |
| Sequences            | Not automated | Recreate in Sequence Editor panel (section 7.15)                 |
| Paths                | Not automated | Use `NavMeshSystem` or a waypoint coroutine                      |
| Shaders              | Not automated | Port `.glsl` to `PostProcessSystem` custom effect (section 5.13) |
| Fonts                | Not automated | Use Google Fonts or inline a `@font-face` via UISystem           |
| Extensions           | Not automated | Evaluate per extension; most map to a Plugin (section 5.8)       |

---

## Common migration errors

These are the errors you are most likely to see after running the importer, with fixes.

---

**Error:** `Property 'x' does not exist on type 'Entity'`

**Cause:** In GML, `x` and `y` are built-in instance variables. In EmptySock, position is on the `Transform` component.

**Fix:**

```typescript
// Before (GML style):
// x = 100;

// After (EmptySock):
const t = entity.requireComponent(Transform);
t.x = 100;

// Or use the shorthand:
entity.position = { x: 100, y: entity.position.y };
```

---

**Error:** `Cannot find module '../entities/Player'` (import fails silently during play)

**Cause:** The file exists on disk but is not open in the IDE's Files panel. The in-browser build only sees files in the open-files map.

**Fix:** Open the file in the IDE's Files panel. It will then be included in the virtual filesystem at build time.

---

**Error:** `ComponentNotFoundError: Health not found on entity 'Enemy'`

**Cause:** You called `entity.requireComponent(Health)` but the entity was created without `addComponent(Health, ...)`.

**Fix:** Add the component in `onLoad()`:

```typescript
enemy.addComponent(Health, 100); // must be added before requireComponent
```

---

**Error:** `[Timer] callback fired after scene destroyed`

**Cause:** You forgot to cancel a `Timer` handle in `onDestroy()`.

**Fix:**

```typescript
override onDestroy(): void {
  this.spawnTimer.cancel(); // always cancel in onDestroy
}
```

---

## Known limitations

- **Dynamic typing:** GML is dynamically typed. Migrated stubs compile, but adding real TypeScript types will surface implicit `any` chains throughout object variables and event arguments — fix these file by file.
- **Built-in room system:** GMS2's room editor, layers, and depth system differ substantially from EmptySock's `LayerSystem` (section 5.16). Rooms must be recreated manually.
- **`ds_grid`, `ds_priority`, `ds_stack`:** No direct equivalents exist. Use TypeScript arrays and `Map` — the compat shim does not cover these.
- **GML event order:** GMS2 fires Create → Step Begin → Step → Step End → Draw events in a fixed order per instance. EmptySock's `onUpdate` is a single synchronous callback; split logic that depended on event order into separate coroutines or actor messages.
- **`persistent` objects:** GMS2 persistent objects survive room transitions automatically. In EmptySock, use a module-level singleton or pass state through `SceneManager.load()` options.
- **`async` events (HTTP, dialog):** GMS2's DS async events have no equivalent. Use `fetch` directly in TypeScript; wrap the result in an actor message to re-enter game logic synchronously.
