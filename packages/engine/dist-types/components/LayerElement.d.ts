/**
 * Marks an entity as a room-layer *element*: a static sprite or a
 * sequence placed directly on a room layer in the room editor, as opposed to
 * an object instance. The room import emits one
 * `SceneDocument.entities` entry per element carrying this component next to its
 * `Transform` and `Sprite`/sequence state, and `layer_sprite_get_id`/
 * `layer_sequence_get_instance` look elements up by
 * `name` (the element's own name in the room editor) and `layer` (the room
 * layer it was placed on).
 *
 * Deliberately not `Meta.name`: `Meta.name` is the object-type identity
 * `place_meeting`/`onCollideWith<Type>` match on, and an element is not an
 * object instance.
 */
export declare const LayerElement: import("../Component.js").ComponentDef<{
  name: string;
  layer: string;
  kind: "sprite" | "sequence";
}>;
