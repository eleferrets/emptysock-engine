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
export declare const GmlBehaviorState: import("../Component.js").ComponentDef<{
  behaviorId: string;
}>;
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
export declare function getGmlBehaviorHandler(
  module: GmlBehaviorModule,
  name: string,
): ((entity: Entity, ...rest: readonly unknown[]) => void) | undefined;
export declare function registerGmlBehavior(
  behaviorId: string,
  moduleExports: GmlBehaviorModule,
): void;
export declare function getGmlBehavior(
  behaviorId: string,
): GmlBehaviorModule | undefined;
export declare function unregisterGmlBehavior(behaviorId: string): void;
//# sourceMappingURL=GmlBehavior.d.ts.map
