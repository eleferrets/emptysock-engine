import type { Scene } from "../Scene.js";
import type { GmlActionContext } from "../compat/gmlActions.js";
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
export declare class TimelineSystem {
  /**
   * Advances every `TimelineState` entity's playhead by one step (call this
   * once per Step, the same cadence `GmlBehaviorSystem.update()` and
   * `gmlActionsStep` already assume) and dispatches any moment the playhead
   * crosses this call.
   */
  update(scene: Scene, ctx: GmlActionContext): void;
  /**
   * Fires every moment whose `step` lies in `(from, to]` (ascending speed)
   * or `[to, from)` (negative speed), in step order — the "several moments
   * in the same step" case `timeline_speed`'s own docs call out.
   */
  private fireCrossedMoments;
}
//# sourceMappingURL=TimelineSystem.d.ts.map
