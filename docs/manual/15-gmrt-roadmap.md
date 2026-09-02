# 15. GMRT Compatibility Roadmap

This document tracks the most-requested GMS2 Runtime (GMRT) compatibility features and the planned EmptySock equivalents. Each section covers what the GML API does, what EmptySock provides today, and the implementation plan for the compatibility shim or replacement feature.

Migration effort is rated **Low**, **Medium**, or **High** relative to an experienced TypeScript developer with no prior EmptySock knowledge.

---

## 15.1 ds_map / ds_list / ds_grid shims

### What GML does

GML ships three built-in data structure types:

| GML type  | Closest JS equivalent     | Notes                                                       |
| --------- | ------------------------- | ----------------------------------------------------------- |
| `ds_map`  | `Map<string, unknown>`    | String-keyed, unordered, serialisable by GML save/load      |
| `ds_list` | `Array<unknown>`          | Ordered list; exposes `ds_list_add`, `ds_list_delete`, etc. |
| `ds_grid` | `Float64Array` (2-D view) | Fixed-size numeric grid; supports region operations         |

GMS2 code uses these everywhere: inventory systems, quest flags, pathfinding scratch space, grid-based levels.

### EmptySock equivalent today

Plain TypeScript `Map`, `Array`, and typed 2-D arrays cover all three semantics natively. The engine does not ship GML-named wrapper APIs.

### Plan

Provide thin TypeScript wrappers under a new optional package `@emptysock/compat-gml` (not part of engine core):

```ts
// ds_map drop-in
export class DsMap<V> {
  private m = new Map<string, V>();
  ds_map_add(key: string, val: V): void {
    this.m.set(key, val);
  }
  ds_map_find_value(key: string): V | undefined {
    return this.m.get(key);
  }
  ds_map_exists(key: string): boolean {
    return this.m.has(key);
  }
  ds_map_delete(key: string): void {
    this.m.delete(key);
  }
  ds_map_size(): number {
    return this.m.size;
  }
}

// ds_list drop-in
export class DsList<T> {
  private a: T[] = [];
  ds_list_add(...items: T[]): void {
    this.a.push(...items);
  }
  ds_list_find_value(index: number): T | undefined {
    return this.a[index];
  }
  ds_list_size(): number {
    return this.a.length;
  }
  ds_list_delete(index: number): void {
    this.a.splice(index, 1);
  }
}
```

`ds_grid` follows the same pattern with a backing `Float64Array` and row/column accessors.

The wrappers are deliberately not serialisation-compatible with GMS2 save files — the goal is API familiarity during porting, not binary compatibility.

**Migration effort:** Low. The GML functions map one-to-one to array/map operations; porting is mechanical.

---

## 15.2 draw\_\* layer system

### What GML does

GML's `draw_*` family (e.g. `draw_sprite`, `draw_rectangle`, `draw_text`, `draw_set_colour`) is called from an object's **Draw event**, which runs once per frame after physics. GML composites everything into the active surface for the current room layer.

### EmptySock equivalent today

EmptySock uses **PixiJS Graphics** for immediate-mode 2-D drawing. The equivalent of the Draw event is `onUpdate(dt)` — add drawing calls there using a `PixiGraphicsComponent` or by writing directly to a PixiJS `Graphics` object attached to an entity.

### Plan

Provide a GML-flavoured draw API under `@emptysock/compat-gml` that delegates to PixiJS:

| GML function                          | EmptySock equivalent                     | Notes                                                                   |
| ------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------- |
| `draw_rectangle(x1,y1,x2,y2,outline)` | `graphics.drawRect(x, y, w, h)`          | Translate corner coords to position+size                                |
| `draw_circle(x,y,r,outline)`          | `graphics.drawCircle(x, y, r)`           | Outline flag maps to `graphics.stroke()`                                |
| `draw_sprite(spr,img,x,y)`            | `Sprite.from(texture).position.set(x,y)` | Sprite must be pre-loaded via AssetBrowser                              |
| `draw_set_colour(c)`                  | `graphics.beginFill(c)`                  | GML colour int is `0xBBGGRR`; PixiJS is `0xRRGGBB` — byte-swap required |
| `draw_text(x,y,str)`                  | `new PIXI.Text(str, style)`              | Style (font, size) must be set beforehand                               |
| `draw_set_alpha(a)`                   | `container.alpha = a`                    | Applied to the active container                                         |

The compat layer will maintain a per-frame "active draw context" so `draw_set_colour` / `draw_set_alpha` behave statelessly as in GML.

**Migration effort:** Medium. The function signatures translate mechanically, but colour channel order, coordinate system differences (GML y-down vs PixiJS y-down — both same, no flip needed), and layer ordering require per-call review.

---

## 15.3 Shader editor

### What GML does

GMS2 ships a GLSL ES shader editor inside the IDE. Shaders are `.vsh` / `.fsh` file pairs. At runtime, `shader_set(shd_myShader)` binds the shader and `shader_set_uniform_f(uni, val)` uploads uniforms.

### EmptySock equivalent today

No in-IDE shader editor exists. Developers can write raw GLSL and apply it via PixiJS `Filter`, but there is no tooling for it.

### Plan

Add a **Shader Editor** IDE panel (`ShaderEditor.tsx`) with:

- Split-pane GLSL snippet editor (vertex / fragment) using the existing `CodeEditor` component
- Live recompile on `Ctrl+S` via PixiJS `Filter` hot-swap
- Uniforms inspector: auto-parsed from GLSL `uniform` declarations, rendered as sliders / colour pickers
- Preview pane: a small PixiJS canvas with a test sprite and the shader applied

API sketch (engine side):

```ts
import { ShaderComponent } from "@emptysock/engine";

entity.addComponent(ShaderComponent, {
  vertexSrc: "...glsl...",
  fragmentSrc: "...glsl...",
  uniforms: { uTime: 0, uColor: [1, 0, 0, 1] },
});
```

**Migration effort:** High. Requires new IDE panel, PixiJS `Filter` integration, GLSL uniform reflection, and a preview harness.

---

## 15.4 surface\_\* system

### What GML does

GML surfaces are off-screen render targets. `surface_create(w, h)` allocates one; `surface_set_target(surf)` redirects all `draw_*` calls into it; `draw_surface(surf, x, y)` blits it back. Used for shadow maps, blur passes, minimap rendering, and custom transitions.

### EmptySock equivalent today

PixiJS `RenderTexture` is the direct equivalent. There is no engine-level wrapper.

### Plan

Provide a `RenderSurface` class in the engine:

```ts
import { RenderSurface } from "@emptysock/engine";

const surf = new RenderSurface(512, 512);
surf.beginCapture(); // redirect rendering
scene.render(surf.target); // render into texture
surf.endCapture();
entity.addComponent(SpriteComponent, { texture: surf.texture });
```

GML mapping:

| GML function               | EmptySock equivalent                      |
| -------------------------- | ----------------------------------------- |
| `surface_create(w, h)`     | `new RenderSurface(w, h)`                 |
| `surface_set_target(surf)` | `surf.beginCapture()`                     |
| `surface_reset_target()`   | `surf.endCapture()`                       |
| `draw_surface(surf, x, y)` | Add `surf.texture` to a `SpriteComponent` |
| `surface_free(surf)`       | `surf.destroy()`                          |

**Migration effort:** Medium. `RenderTexture` is well-supported in PixiJS; the main work is the engine wrapper and ensuring `beginCapture` / `endCapture` interact correctly with the frame loop.
