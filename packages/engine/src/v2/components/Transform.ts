import { defineComponent } from "../Component.js";

/**
 * v2 port of `../../components/Transform.ts` onto `defineComponent`. All
 * fields are plain numbers, so this needs no special storage treatment
 * (ENGINE_DESIGN.md §7/§21) — `ComponentRegistry` gives it one parallel
 * array per field automatically.
 */
export const Transform = defineComponent("Transform", () => ({
  x: 0,
  y: 0,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
}));
