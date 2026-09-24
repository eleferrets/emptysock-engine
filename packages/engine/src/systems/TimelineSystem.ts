import type { Scene } from "../Scene.js";
import type { GmlActionContext } from "../compat/gmlActions.js";
import {
  TimelineState,
  getGmlTimeline,
  type TimelineModule,
} from "../components/GmlTimeline.js";

/**
 * Real, automatic playback for GMS2-imported `.timeline.ts` modules — the
 * `TimelineState` component only ever holds the playhead itself
 * (`position`/`speed`/`running`/`loop`); this system is what actually
 * advances it and fires moments, the same "component holds state, a system
 * drives it" split `GmlBehaviorSystem` already establishes for GML behavior
 * modules.
 *
 * GameMaker's real per-step timeline semantics (manual.gamemaker.io's
 * `timeline_speed`/`timeline_loop` reference pages, confirmed live for this
 * pass): "in each step the position in the time line is increased by 1" by
 * default, and "if the value is larger than one, several moments can happen
 * within the same time step (they will all be performed in the same order
 * as defined for the time line, so no actions will be skipped)". This is
 * why `update()` walks every moment whose `step` falls within the half-open
 * `(prevPosition, newPosition]` range on this call, in ascending step order,
 * rather than only checking the single nearest integer step — a `speed` of
 * `2.4` genuinely can cross more than one moment in one call.
 */
export class TimelineSystem {
  /**
   * Advances every `TimelineState` entity's playhead by one step (call this
   * once per Step, the same cadence `GmlBehaviorSystem.update()` and
   * `gmlActionsStep` already assume) and dispatches any moment the playhead
   * crosses this call.
   */
  update(scene: Scene, ctx: GmlActionContext): void {
    scene.each(TimelineState, (state, entity) => {
      if (!state.running) return;
      const module = getGmlTimeline(state.timelineId);
      if (module === undefined || module.moments.length === 0) return;

      const prevPosition = state.position;
      let nextPosition = prevPosition + state.speed;

      const lastStep = module.moments[module.moments.length - 1]?.step ?? 0;
      const firstStep = module.moments[0]?.step ?? 0;

      this.fireCrossedMoments(module, prevPosition, nextPosition, entity, ctx);

      if (state.speed >= 0) {
        if (nextPosition > lastStep) {
          nextPosition = state.loop ? nextPosition - (lastStep + 1) : lastStep;
          if (!state.loop) {
            // Real GameMaker behaviour: a non-looping timeline simply stops
            // advancing once it's exhausted every moment — timeline_running
            // is not automatically cleared, but position holds at the end.
            state.position = lastStep;
            return;
          }
        }
      } else if (nextPosition < firstStep) {
        nextPosition = state.loop
          ? nextPosition + (lastStep - firstStep + 1)
          : firstStep;
        if (!state.loop) {
          state.position = firstStep;
          return;
        }
      }

      state.position = nextPosition;
    });
  }

  /**
   * Fires every moment whose `step` lies in `(from, to]` (ascending speed)
   * or `[to, from)` (negative speed), in step order — the "several moments
   * in the same step" case `timeline_speed`'s own docs call out.
   */
  private fireCrossedMoments(
    module: TimelineModule,
    from: number,
    to: number,
    entity: Parameters<TimelineModule["moments"][number]["run"]>[0],
    ctx: GmlActionContext,
  ): void {
    if (to >= from) {
      for (const moment of module.moments) {
        if (moment.step > from && moment.step <= to) moment.run(entity, ctx);
      }
    } else {
      for (let i = module.moments.length - 1; i >= 0; i--) {
        const moment = module.moments[i];
        if (moment !== undefined && moment.step < from && moment.step >= to) {
          moment.run(entity, ctx);
        }
      }
    }
  }
}
