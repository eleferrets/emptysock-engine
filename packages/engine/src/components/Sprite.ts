import { defineComponent } from "../Component.js";

/**
 * ECS-core equivalent of `../../components/Sprite.ts`. Attaching `Sprite` alongside
 * `Transform` is the entire contract for "this entity shows up on screen" —
 * `RenderPipeline.renderFrame()` finds every `Transform`+`Sprite` entity each
 * frame and keeps a PixiJS sprite in sync with it.
 *
 * **Non-numeric fields and component storage (read this before adding another
 * render component):** `texturePath` is a `string`, and `layer` is a
 * `string` — both satisfy `Serializable` (`ecs/Serializable.ts`) just fine,
 * and `ComponentRegistry.ensure()` backs every field with a plain
 * `unknown[]` array, not a typed array (see `ComponentRegistry.ts`), so a
 * string field costs nothing extra here. There is no bitECS "SoA numbers
 * only" constraint to work around for *this* component.
 *
 * What genuinely cannot live in a component's field bag is the **PixiJS
 * `Sprite` display-object instance itself** — it holds methods, a WebGL
 * texture reference, and a scene-graph parent pointer, none of which are
 * `Serializable`, and it also isn't game data any component should expose
 * (game code never needs to reach into Pixi internals). `RenderPipeline`
 * keeps that association in its *own* side table instead —
 * `Map<Scene, Map<number, PixiSprite>>` keyed by the owning `Scene` and the
 * entity's `eid` — the outer `Scene` key exists because a `Game` can have
 * several live scenes — main plus overlays — whose `eid`s independently
 * start from 0 and would otherwise collide. If a later Track 1 system
 * (physics collision callbacks, audio
 * playback handles) needs to associate a non-serializable runtime object
 * with an entity, follow this same pattern: a plain component holding only
 * `Serializable` fields, plus an external `Map`/`WeakMap` owned by the
 * system that actually needs the non-serializable handle — never smuggle it
 * into the component's field bag.
 */
export const Sprite = defineComponent(
  "Sprite",
  () => ({
    texturePath: "",
    tint: 0xffffff,
    alpha: 1,
    anchorX: 0.5,
    anchorY: 0.5,
    /** Named render layer (see the shared `LayerSystem`, unchanged here). */
    layer: "default",
    /** Draw order within `layer` — lower draws first (behind). */
    depth: 0,
    visible: true,
    /**
     * How many frames this sprite has. `1` (the default) is an ordinary
     * static sprite — `SpriteAnimationSystem` skips any entity whose
     * `frameCount` is `<= 1`, and `RenderPipeline` resolves `texturePath`
     * literally, exactly as it always has. `> 1` means `texturePath` is a
     * *template* containing the literal substring `"{n}"`, which
     * `RenderPipeline` replaces with the current frame index (the asset pipeline's
     * The convention: `./assets/sprites/<name>/frame_{n}.png`, matching the
     * `frame_0.png`/`frame_1.png`/… files `buildSpriteAsset` actually
     * writes to disk).
     */
    frameCount: 1,
    /**
     * The currently-displayed frame, `0`-based. `SpriteAnimationSystem`
     * advances this every tick by `frameSpeed`; game code may also assign it directly — a direct
     * assignment simply overrides this tick's displayed frame, since the
     * system re-advances from wherever it's left on the next tick anyway.
     * Not an integer in general — `SpriteAnimationSystem` keeps the
     * fractional part between ticks so a fractional `frameSpeed`
     * accumulates correctly; `RenderPipeline` floors it before indexing.
     */
    currentFrame: 0,
    /**
     * Frames advanced per engine tick — `image_speed`. Can be
     * fractional (e.g. `0.5` to halve playback rate).
     * `0` means static (the "image_speed 0" convention) —
     * `SpriteAnimationSystem` never advances `currentFrame` in that case,
     * even if `frameCount > 1`. Defaults to `1`, matching a freshly-created
     * instance's default `image_speed`.
     */
    frameSpeed: 1,
    /**
     * `true` (the default for `image_speed > 0`): `currentFrame`
     * wraps via modulo against `frameCount` once it reaches the end.
     * `false`: playback clamps at the last frame (`frameCount - 1`) and
     * stops advancing — there is no `image_speed`-level way to express this
     * in a plain speed value, but it's a real, common authoring need (a one-shot
     * death/hit animation), so it's exposed here as a plain field rather
     * than left unmodelled.
     */
    loop: true as boolean,
    /**
     * Real per-sprite pixel dimensions, `0` when genuinely unknown (a
     * hand-authored entity with no sprite data). The asset pipeline
     * populates these from the
     * sprite resource's own `width`/`height` fields at build
     * time. Collision queries read
     * these when present (real, per-sprite collision extents) and falls
     * back to a fixed 32x32 box only when both are `0` — see the collision-query layer's
     * The doc comment.
     */
    width: 0,
    height: 0,
    /**
     * How `width`/`height` are filled from the texture: `0` (default) plain
     * sprite, `1` nine-slice (corners fixed at the `slice*` guide sizes,
     * edges/centre stretched), `2` tiled (texture repeated, clipped to
     * `width` x `height`). Sliced/tiled modes need `width`/`height > 0` to
     * have any effect. Set by the asset pipeline (`nineSlice.enabled`, a
     * `GMRBackgroundLayer`'s `htiled`/`vtiled`) or marked by hand in the
     * IDE Room Editor; `RenderPipeline._syncSliced()` renders modes 1/2 (see CLAUDE.md).
     */
    sliceMode: 0,
    /** Nine-slice guide sizes in source-texture pixels (`nineSlice.left/right/top/bottom`). */
    sliceLeft: 0,
    sliceRight: 0,
    sliceTop: 0,
    sliceBottom: 0,
    /**
     * Registered shader id (`ShaderRegistry`, e.g. `sh_white`) to
     * render this sprite through, `""` for none. `RenderPipeline._syncOne()`
     * sets the tracked pixi sprite's `.filters` to the one shared Filter for
     * that id (never one per entity) and clears it when this is empty. The
     * `shader_set`/`shader_reset` write it outside a Draw event.
     */
    shader: "",
    /**
     * Collision-mask box as offsets from the sprite origin (`bbox_*`,
     * right/bottom exclusive). All `0` means "no mask data": collision then
     * uses the whole `width` x `height` image positioned by the anchor.
     */
    bboxLeft: 0,
    bboxTop: 0,
    bboxRight: 0,
    bboxBottom: 0,
  }),
  {
    schema: {
      texturePath: { kind: "string" },
      tint: { kind: "number" },
      alpha: { kind: "number" },
      anchorX: { kind: "number" },
      anchorY: { kind: "number" },
      bboxLeft: { kind: "number" },
      bboxTop: { kind: "number" },
      bboxRight: { kind: "number" },
      bboxBottom: { kind: "number" },
      layer: { kind: "string" },
      depth: { kind: "number" },
      visible: { kind: "boolean" },
      frameCount: { kind: "number" },
      currentFrame: { kind: "number" },
      frameSpeed: { kind: "number" },
      loop: { kind: "boolean" },
      width: { kind: "number" },
      height: { kind: "number" },
      sliceMode: { kind: "number" },
      sliceLeft: { kind: "number" },
      sliceRight: { kind: "number" },
      sliceTop: { kind: "number" },
      sliceBottom: { kind: "number" },
      shader: { kind: "string" },
    },
  },
);

/**
 * Resolves `Sprite.texturePath`/`currentFrame`/`frameCount` into the actual
 * path to load/display this tick. A `frameCount <= 1` sprite (the common,
 * pre-animation case) returns `texturePath` unchanged — no `"{n}"` template
 * to resolve, byte-for-byte identical behaviour to before this field
 * existed. A multi-frame sprite replaces the literal `"{n}"` substring with
 * the floored, wrapped-or-clamped frame index. Shared by `RenderPipeline`
 * (actual rendering) and `SpriteAnimationSystem`'s own tests (asserting the
 * resolved path advances) so the two can never disagree on the convention.
 */
export function resolveSpriteFramePath(sprite: {
  texturePath: string;
  frameCount: number;
  currentFrame: number;
}): string {
  if (sprite.frameCount <= 1) return sprite.texturePath;
  const frame =
    ((Math.floor(sprite.currentFrame) % sprite.frameCount) +
      sprite.frameCount) %
    sprite.frameCount;
  return sprite.texturePath.replace("{n}", String(frame));
}
