import { defineComponent } from "../Component.js";

/**
 * RELEASE_PASS.md Track 0's deferred "unify `IDEBridge` into `QueryChannel`"
 * item named the real blocker precisely: `QueryChannel`'s `EntitySummary`
 * has no `name`/`tags`/`active` fields the IDE's live Inspector needs,
 * because bitECS entities have no built-in name/tag/active-flag notion —
 * inventing that shape needed a real design decision, not a hasty
 * placeholder. This is that decision: an optional `Meta` component, the
 * same "optional, absent means a sane default" pattern `WidgetAppearance`
 * already uses for `visible`/`alpha`. An entity with no `Meta` component is
 * simply unnamed/untagged/active — the common case for a purely code-spawned
 * entity that never needs to show up named in an editor.
 *
 * `tags` is a real string array (`Serializable` allows `readonly
 * Serializable[]`), not a comma-joined string — there's no reason to pay a
 * join/split serialization tax for something bitECS/`ComponentRegistry`
 * already stores as a plain field.
 *
 * `solid` mirrors GameMaker's own per-object "Solid" checkbox
 * (`compat/gmlCollisionQueries.ts`'s `place_free`/`position_free` read it),
 * independent of whether the entity also has a `PhysicsBody` — GameMaker's
 * classic non-physics DnD/GML games use "solid" as a plain instance flag,
 * not a physics-engine concept, and `Meta` is already the one component
 * `gms2-codegen.ts`'s generated prefabs carry for exactly this kind of
 * per-instance, editor-visible flag.
 */
export const Meta = defineComponent(
  "Meta",
  () => ({
    name: "",
    tags: [] as string[],
    active: true as boolean,
    solid: false as boolean,
  }),
  {
    schema: {
      name: { kind: "string" },
      active: { kind: "boolean" },
      solid: { kind: "boolean" },
    },
  },
);

export type MetaShape = ReturnType<typeof Meta.createDefaults>;
