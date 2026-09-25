// gmlSequences.ts — GameMaker Studio 2.3+ layer_sequence_create() compat.
//
// Sibling to `gmlActions.ts`/`gmlCamera.ts`/`gmlParticles.ts` — same
// directory, same "engine defines the context shape, game code wires the
// live pieces" pattern. No DOM/Tauri/apps-ide imports (engine-environment
// boundary).
//
// Per CLAUDE.md's "GmsProjectRuntime" entry: `sequence_index` was
// researched and found not to exist as a per-instance GML variable — real
// GameMaker Sequences are asset/layer-scoped, created imperatively via
// `layer_sequence_create(layer, x, y, sequence)` (manual.gamemaker.io's
// Sequences reference, confirmed live for this pass). That function is the
// one real GML source shape a Sequence-driven entity actually comes from,
// and this file implements it for real.
//
// `layer_sequence_create`'s real GameMaker return value is a
// `sequenceElementIndex` (an opaque per-layer handle used with
// `sequence_get_*`/`layer_sequence_x` follow-up calls) — this compat layer
// has no per-layer sequence-instance registry to hand out a matching
// numeric handle from, so it returns the spawned `Entity` instead, the same
// "return the real, checkable thing this engine actually has" choice
// `action_create_object`/`instance_create` already make for their own
// GameMaker-numeric-handle return values.

import type { Entity } from "../Entity.js";
import type { GmlActionContext } from "./gmlActions.js";
import { Transform } from "../components/Transform.js";
import { GmlSequenceState, getGmlSequence } from "../components/GmlSequence.js";

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
export function layer_sequence_create(
  ctx: GmlActionContext,
  _layer: string,
  x: number,
  y: number,
  sequence: string,
): Entity | undefined {
  if (getGmlSequence(sequence) === undefined) {
    console.warn(
      `[gmlSequences] layer_sequence_create('${_layer}', ${x}, ${y}, '${sequence}') called with no sequence registered under that id — nothing was created.`,
    );
    return undefined;
  }
  const entity = ctx.scene.spawn();
  entity.add(Transform, { x, y });
  entity.add(GmlSequenceState, {
    sequenceId: sequence,
    position: 0,
    playing: true,
  });
  return entity;
}
