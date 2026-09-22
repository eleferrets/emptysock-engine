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
 * entity's `eid` — exactly the same shape the classic `RenderPipeline` uses
 * (`Map<number, PixiSprite>` keyed by entity id; this one adds the outer `Scene`
 * key only because a `Game` can have several live scenes — main plus
 * overlays — whose `eid`s independently start from 0 and would otherwise
 * collide). If a later Track 1 system (physics collision callbacks, audio
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
  }),
  {
    schema: {
      texturePath: { kind: "string" },
      tint: { kind: "number" },
      alpha: { kind: "number" },
      anchorX: { kind: "number" },
      anchorY: { kind: "number" },
      layer: { kind: "string" },
      depth: { kind: "number" },
      visible: { kind: "boolean" },
    },
  },
);
