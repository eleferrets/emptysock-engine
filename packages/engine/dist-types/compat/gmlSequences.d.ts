import type { Entity } from "../Entity.js";
import type { GmlActionContext } from "./gmlActions.js";
/**
 * `layer_sequence_create(layer, x, y, sequence)` — spawns a bare entity at
 * `(x, y)` and attaches a real, playing `GmlSequenceState` bound to
 * `sequence` (a GMS2-imported Sequence id, registered via
 * `registerGmlSequence` — see `gms2-sequence-import.ts`).
 *
 * The `layer` argument (a room layer *name*, e.g. `"Effects"`) is honestly
 * not applied to the spawned entity, for the exact same reason
 * `instance_create_layer`'s own doc comment gives: this engine's
 * `Scene.spawn()` has no per-layer spawn-target concept — a spawned
 * entity's actual render layer comes from its own component data via
 * `LayerSystem`, set independently of where it was created.
 *
 * `speed`/`loop` on the returned entity's `GmlSequenceState` are left at
 * `GmlSequenceState`'s own component defaults (30fps, non-looping) —
 * `GmlSequenceData` (the registered sequence's converted shape) carries only
 * `length`/`tracks`; a Sequence's real playback speed/loop settings are
 * project-level `.yy` fields this importer does not currently thread onto
 * the per-instance data (see `gms2-sequence-import.ts`'s own doc comment),
 * so a caller who needs a specific speed/loop still sets `state.speed`/
 * `state.loop` on the returned entity explicitly, the same way any other
 * `GmlSequenceState` field is set.
 *
 * Returns `undefined` (a safe no-op, console warning) if `sequence` isn't a
 * registered sequence id — the same "honest error over a fabricated
 * result" shape `action_create_object`'s missing-prefab case already uses.
 */
export declare function layer_sequence_create(
  ctx: GmlActionContext,
  _layer: string,
  x: number,
  y: number,
  sequence: string,
): Entity | undefined;
