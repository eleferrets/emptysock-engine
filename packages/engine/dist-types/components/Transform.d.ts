/**
 * ECS-core equivalent of `../../components/Transform.ts`, built on `defineComponent`. All
 * fields are plain numbers, so this needs no special storage treatment
 * (ENGINE_DESIGN.md §7/§21) — `ComponentRegistry` gives it one parallel
 * array per field automatically.
 */
export declare const Transform: import("../Component.js").ComponentDef<{
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}>;
