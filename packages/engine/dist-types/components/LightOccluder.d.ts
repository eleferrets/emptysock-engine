/**
 * Marks an entity as a real light-blocker — a wall/pillar/crate a
 * `LightSource` casts a shadow behind, computed by
 * `LightingSystem.collectLights()`/`LightOcclusion.ts`'s visibility-polygon
 * pass and rendered as a real masked region in `RenderSystem.syncLighting()`.
 *
 * **Why this is a dedicated component rather than reusing `Meta.solid`.**
 * `Meta.solid` (see that file's doc comment) is GameMaker's per-object
 * "Solid" checkbox — a plain collision-query flag with no geometry of its
 * own; `place_meeting`/`place_free` derive their AABB from
 * `spriteHalfExtents()` instead. Light occlusion needs real, purpose-fit
 * geometry (a width/height box a wall segment actually casts a shadow
 * from), which `Meta` has nowhere to carry — so a second component is
 * required either way. Once a dedicated component exists for the geometry,
 * folding "does this block light" into it rather than piggybacking on
 * `Meta.solid` also keeps the two concerns honestly independent: "blocks
 * movement" and "blocks light" are correlated for an ordinary wall but not
 * identical in general (a locked iron gate can be solid for collision and
 * still let light through the bars; a magic ward or a painted-on shadow
 * trigger can block light with nothing solid to collide with) — this
 * mirrors the same "don't collapse two genuinely different concerns into
 * one flag just because they usually agree" judgement call `SaveSystem`'s
 * `StorageAdapter` split and `@emptysock/network`'s own field-marking side-
 * map already make elsewhere in this codebase. A wall that should do both
 * carries `PhysicsBody`/`Meta.solid` *and* `LightOccluder` — two components,
 * same entity, exactly the ordinary "compose components" ECS answer.
 *
 * **Deliberately axis-aligned, no rotation field.** Real GameMaker/2D
 * top-down/platformer level geometry is overwhelmingly axis-aligned tile
 * walls; a rotated occluder is a real, separate feature (rotating the box's
 * four corners before building its edge segments) with no verified caller
 * today, the same "don't build the general case before something needs it"
 * restraint `PhysicsBody.shape` being left at its `"box"` default already
 * documents. `LightOcclusion.ts`'s `boxOccluderSegments()` is the one place
 * that would need to change if this grows a `rotation` field later.
 */
export declare const LightOccluder: import("../Component.js").ComponentDef<{
  /** Occluder box size, world units (px). Centred on the entity's Transform + offset, like `LightSource`'s own offset fields. */
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
  /** A disabled occluder is skipped entirely by `LightingSystem.collectLights()` — a broken door or a destroyed wall segment stops casting a shadow without removing/re-adding the component. Mirrors `LightSource.enabled`. */
  enabled: boolean;
}>;
//# sourceMappingURL=LightOccluder.d.ts.map
