# 11 — GameMaker Studio 2 Migration Guide

## Overview

The EmptySock toolchain includes a GMS2 importer that reads a `.yyp` project file and generates TypeScript stub files — one per GML object and one per GML script. The stubs preserve object names, variable declarations, and event signatures so your project compiles immediately (with type errors to fix). GML → TypeScript transpilation is not automated; the migration report identifies every site that needs manual attention.

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

Common GML patterns and their EmptySock equivalents:

| GML | TypeScript / EmptySock |
|-----|------------------------|
| `instance_create_layer(x, y, layer, obj)` | `scene.createEntity()` + `addComponent` |
| `instance_destroy()` | `entity.destroy()` |
| `object_index` | Entity constructor reference / `getComponent` |
| `alarm[0] = 60` | `entity.startCoroutine(waitFrames(60, fn))` |
| `hspeed` / `vspeed` | Physics body velocity via `PhysicsBody` |
| `sprite_index` / `image_index` | `Sprite` component + `Animator` |
| `global.variable` | Module-level `let` / `const` |
| `with (obj_enemy) { ... }` | `scene.query(EnemyComponent).forEach(...)` |
| `room_goto(rm_next)` | `SceneManager.load('SceneName')` |
| `draw_sprite(spr, img, x, y)` | `Sprite` component (declarative, drawn by engine) |
| `audio_play_sound(snd, priority, loop)` | `AudioSystem.play('sound-name', { loop })` |
| `draw_set_color(c_red)` | Draw via `UISystem` or a custom `PostProcessSystem` pass |
| `instance_number(obj)` | `scene.query(MyComponent).length` |
| `place_meeting(x, y, obj)` | Overlap query via `PhysicsBody` sensors |
| `path_start(path, speed, ...)` | `NavMeshSystem` + waypoint coroutine |
| `draw_text(x, y, string)` | `UISystem.createLabel(...)` |
| `game_restart()` | `SceneManager.load(currentSceneName)` |
| `irandom(n)` | `Math.floor(Math.random() * (n + 1))` |
| `choose(a, b, c)` | `[a, b, c][Math.floor(Math.random() * 3)]` |
| `point_direction(x1, y1, x2, y2)` | `Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI)` |
| `lengthdir_x(len, dir)` | `Math.cos(dir * Math.PI / 180) * len` |

---

## Step 5: GML compat shim

During migration, use the `@emptysock/engine/compat` shim to avoid rewriting low-risk utility calls immediately:

```typescript
import * as GML from '@emptysock/engine/compat';

// These work identically to their GML equivalents:
GML.lerp(a, b, t);         // linear interpolate
GML.clamp(v, lo, hi);      // clamp
GML.irandom(n);            // integer in 0..n inclusive
GML.string(v);             // coerce to string
GML.string_length(s);      // s.length
GML.string_pos(sub, s);    // s.indexOf(sub) + 1 (1-based, 0 = not found)
GML.ds_map_create();       // returns a Map<string, unknown>
GML.ds_map_set(m, k, v);
GML.ds_map_find_value(m, k);
GML.ds_map_destroy(m);     // no-op; GC handles it, but safe to call
GML.ds_list_create();      // returns an Array<unknown>
GML.ds_list_add(l, v);
GML.ds_list_find_value(l, i);
GML.ds_list_size(l);
GML.ds_list_destroy(l);    // no-op
```

> **Plan:** The compat shim is a migration aid, not a production dependency. Replace shim calls with idiomatic TypeScript as you stabilise each object.

---

## Asset migration table

| GMS2 asset type | Status | Notes |
|-----------------|--------|-------|
| Objects → Components | Auto-stub | Manual GML migration required |
| Scripts → TS modules | Auto-stub | Manual GML migration required |
| Rooms → Scenes | Not automated | Recreate manually; see room notes in migration-report.md |
| Sprites | Not automated | Copy PNG/PNG-strip files, import via Asset Browser |
| Sounds | Not automated | Copy audio files, reference via `AudioSystem.play` |
| Tilesets / Tilemaps | Not automated | Recreate in TilemapEditor panel (section 7.6) |
| Sequences | Not automated | Recreate in Sequence Editor panel (section 7.15) |
| Paths | Not automated | Use `NavMeshSystem` or a waypoint coroutine |
| Shaders | Not automated | Port `.glsl` to `PostProcessSystem` custom effect (section 5.13) |
| Fonts | Not automated | Use Google Fonts or inline a `@font-face` via UISystem |
| Extensions | Not automated | Evaluate per extension; most map to a Plugin (section 5.8) |

---

## Known limitations

- **Dynamic typing:** GML is dynamically typed. Migrated stubs compile, but adding real TypeScript types will surface implicit `any` chains throughout object variables and event arguments — fix these file by file.
- **Built-in room system:** GMS2's room editor, layers, and depth system differ substantially from EmptySock's `LayerSystem` (section 5.16). Rooms must be recreated manually.
- **`ds_grid`, `ds_priority`, `ds_stack`:** No direct equivalents exist. Use TypeScript arrays and `Map` — the compat shim does not cover these.
- **GML event order:** GMS2 fires Create → Step Begin → Step → Step End → Draw events in a fixed order per instance. EmptySock's `onUpdate` is a single synchronous callback; split logic that depended on event order into separate coroutines or actor messages.
- **`persistent` objects:** GMS2 persistent objects survive room transitions automatically. In EmptySock, use a module-level singleton or pass state through `SceneManager.load()` options.
- **`async` events (HTTP, dialog):** GMS2's DS async events have no equivalent. Use `fetch` directly in TypeScript; wrap the result in an actor message to re-enter game logic synchronously.
