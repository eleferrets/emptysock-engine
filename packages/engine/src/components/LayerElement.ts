import { defineComponent } from "../Component.js";

/**
 * Marks an entity as a GameMaker room-layer *element*: a static sprite or a
 * sequence placed directly on a room layer in the room editor, as opposed to
 * an object instance. The GMS2 room import (`gms2-room-import.ts`) emits one
 * `SceneFile.entities` entry per element carrying this component next to its
 * `Transform` and `Sprite`/`GmlSequenceState`, and `layer_sprite_get_id`/
 * `layer_sequence_get_instance` (`compat/gmlLayer.ts`) look elements up by
 * `name` (the element's own name in the room editor) and `layer` (the room
 * layer it was placed on).
 *
 * Deliberately not `Meta.name`: `Meta.name` is the object-type identity
 * `place_meeting`/`onCollideWith<Type>` match on, and an element is not an
 * object instance.
 */
export const LayerElement = defineComponent(
  "LayerElement",
  () => ({
    name: "",
    layer: "",
    kind: "sprite" as "sprite" | "sequence",
  }),
  {
    schema: {
      name: { kind: "string" },
      layer: { kind: "string" },
      kind: { kind: "enum", options: ["sprite", "sequence"] },
    },
  },
);
