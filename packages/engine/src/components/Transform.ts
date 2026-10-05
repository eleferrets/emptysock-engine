import { defineComponent } from "../Component.js";

/**
 * ECS-core equivalent of `../../components/Transform.ts`, built on `defineComponent`. All
 * fields are plain numbers, so this needs no special storage treatment
 * — `ComponentRegistry` gives it one parallel
 * array per field automatically.
 */
export const Transform = defineComponent(
  "Transform",
  () => ({
    x: 0,
    y: 0,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
  }),
  {
    schema: {
      x: { kind: "number" },
      y: { kind: "number" },
      rotation: { kind: "number" },
      scaleX: { kind: "number" },
      scaleY: { kind: "number" },
    },
  },
);
