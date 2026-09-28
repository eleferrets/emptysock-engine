import type { Entity } from "../Entity.js";
import type { GmlActionContext } from "../compat/gmlActions.js";
/**
 * Per-entity marker: which generated GMS2 `.timeline.ts` module this entity
 * is currently running, plus the transient playback state GameMaker's real
 * `timeline_index`/`timeline_position`/`timeline_speed`/`timeline_running`/
 * `timeline_loop` instance variables cover. Mirrors `GmlBehaviorState`'s
 * shape exactly (see that component's own doc comment for the full
 * rationale) — the timeline's actual moment data is shared, immutable data
 * keyed by id in a module-level registry, never duplicated per entity; only
 * the playhead itself is genuinely per-entity, mutable state, so it's the
 * only thing that lives on the component.
 *
 * GameMaker's real semantics (manual.gamemaker.io's Timelines reference,
 * confirmed for this pass): a timeline does *not* auto-play just because
 * `timeline_index` is set — `timeline_running` (here: `running`) has to be
 * true for `position` to advance at all. Each step `position` advances by
 * `speed` (default `1`; a non-integer speed can fire zero or several
 * moments in the same step, GameMaker's own documented behaviour — see
 * `TimelineSystem.update()`). When `position` passes the last defined
 * moment's step and `loop` is false, the timeline stops advancing (mirrors
 * GameMaker: it does not reset `running` to false on its own, but further
 * steps are no-ops since there's nothing left to reach); when `loop` is
 * true, `position` wraps back to `0` (or, for a negative `speed`, to the
 * last defined moment — GameMaker's own documented negative-speed looping
 * behaviour).
 */
export declare const TimelineState: import("../Component.js").ComponentDef<{
  timelineId: string;
  position: number;
  speed: number;
  running: boolean;
  loop: boolean;
}>;
/** One GMS2 timeline "moment" — a specific step, and the compiled GML that runs when the playhead reaches it. */
export interface TimelineMoment {
  readonly step: number;
  run(entity: Entity, ctx: GmlActionContext): void;
}
/**
 * The shape a generated `.timeline.ts` module's default export actually
 * takes (`gms2-timeline-import.ts`'s `buildTimelineModule()`). `moments` is
 * expected sorted ascending by `step` — `TimelineSystem` does not re-sort it
 * on every dispatch, since a generated module can build it in step order
 * once, at module-eval time.
 */
export interface TimelineModule {
  readonly moments: readonly TimelineMoment[];
}
export declare function registerGmlTimeline(
  timelineId: string,
  module: TimelineModule,
): void;
export declare function getGmlTimeline(
  timelineId: string,
): TimelineModule | undefined;
export declare function unregisterGmlTimeline(timelineId: string): void;
