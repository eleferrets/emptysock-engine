import { defineComponent } from "../Component.js";
import type { Entity } from "../Entity.js";
import type { GmlActionContext } from "../compat/gmlActions.js";

/**
 * Per-entity marker: which generated GMS2 `.behavior.ts` module this entity
 * runs. Mirrors `VisualScriptState`'s shape exactly (see
 * `components/VisualScript.ts`'s doc comment for the full rationale this
 * borrows) — the graph/module itself is shared, immutable data keyed by id,
 * never duplicated per entity, so the component stays a single `string`
 * field and stays trivially `Serializable`.
 */
export const GmlBehaviorState = defineComponent(
  "GmlBehaviorState",
  () => ({
    behaviorId: "",
  }),
  {
    schema: {
      behaviorId: { kind: "string" },
    },
  },
);

/**
 * The shape a generated `.behavior.ts` module's exports actually take
 * (`gms2-codegen.ts`'s `buildObjectBehavior()`). Every event is optional
 * because a real object only exports the events its GML source actually
 * declared — `onStepBegin`/`onStepEnd` in particular are absent far more
 * often than present, since GMS2's own default event for "Step" logic is
 * plain Step, not Begin/End Step.
 */
export interface GmlBehaviorModule {
  onCreate?(entity: Entity, ctx: GmlActionContext): void;
  onStepBegin?(entity: Entity, ctx: GmlActionContext): void;
  /** The plain "Step" event — kept as `onUpdate` for continuity with the pre-dispatch-system generated shape (`gms2-codegen.ts`'s original single Step handler name). */
  onUpdate?(entity: Entity, dt: number, ctx: GmlActionContext): void;
  onStepEnd?(entity: Entity, ctx: GmlActionContext): void;
  onDraw?(entity: Entity, ctx: GmlActionContext): void;
  onDrawGui?(entity: Entity, ctx: GmlActionContext): void;
  onDestroy?(entity: Entity, ctx: GmlActionContext): void;
}

/**
 * A generated behavior module also exports GameMaker's per-other-object
 * collision handlers (`onCollideWith<Other>`) and per-key handlers
 * (`onKeyPress<Name>`/`onKeyRelease<Name>`) — names that can't be typed as
 * fixed fields on `GmlBehaviorModule` since they're generated per-project.
 * `getGmlBehaviorHandler` looks one up dynamically by name on an already-
 * resolved module, the one place this cast lives rather than spreading an
 * index signature (and its looser typing) across the whole module shape.
 */
export function getGmlBehaviorHandler(
  module: GmlBehaviorModule,
  name: string,
): ((entity: Entity, ...rest: readonly unknown[]) => void) | undefined {
  const handler = (module as Record<string, unknown>)[name];
  return typeof handler === "function"
    ? (handler as (entity: Entity, ...rest: readonly unknown[]) => void)
    : undefined;
}

/**
 * Module-level registry mapping `behaviorId` -> the real compiled
 * `.behavior.ts` module exports. The same "shared static data keyed by id"
 * pattern `VisualScriptState`'s `graphRegistry` and `@emptysock/network`'s
 * `NetworkedFields` side-map both already use — a generated behavior module
 * is real, static, imported code (not authorable at runtime the way a
 * `VisualScriptGraph` is), so the game registers it once at startup with the
 * id it wants live entities to reference.
 */
const behaviorRegistry = new Map<string, GmlBehaviorModule>();

export function registerGmlBehavior(
  behaviorId: string,
  moduleExports: GmlBehaviorModule,
): void {
  behaviorRegistry.set(behaviorId, moduleExports);
}

export function getGmlBehavior(
  behaviorId: string,
): GmlBehaviorModule | undefined {
  return behaviorRegistry.get(behaviorId);
}

export function unregisterGmlBehavior(behaviorId: string): void {
  behaviorRegistry.delete(behaviorId);
}
