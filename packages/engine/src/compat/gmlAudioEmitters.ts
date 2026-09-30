/**
 * GameMaker's audio emitter family. Positional audio is not modelled by the
 * engine's `AudioSystem`, so emitters are plain handles that remember their
 * settings: code that creates, moves and tunes emitters runs, and a sound
 * played on an emitter (`audio_play_sound_on`, lowered by the transpiler to
 * `audio_play_sound`) plays non-positionally.
 */

interface Emitter {
  x: number;
  y: number;
  z: number;
  gain: number;
  pitch: number;
}

const emitters = new Map<number, Emitter>();
let nextEmitter = 1;

export function audio_emitter_create(): number {
  const id = nextEmitter++;
  emitters.set(id, { x: 0, y: 0, z: 0, gain: 1, pitch: 1 });
  return id;
}

export function audio_emitter_free(emitter: number): void {
  emitters.delete(emitter);
}

export function audio_emitter_exists(emitter: number): boolean {
  return emitters.has(emitter);
}

export function audio_emitter_position(
  emitter: number,
  x: number,
  y: number,
  z: number,
): void {
  const e = emitters.get(emitter);
  if (e) Object.assign(e, { x, y, z });
}

/** Velocity only feeds Doppler, which is not modelled. */
export function audio_emitter_velocity(
  _emitter: number,
  _vx: number,
  _vy: number,
  _vz: number,
): void {}

export function audio_emitter_gain(emitter: number, gain: number): void {
  const e = emitters.get(emitter);
  if (e) e.gain = gain;
}

export function audio_emitter_pitch(emitter: number, pitch: number): void {
  const e = emitters.get(emitter);
  if (e) e.pitch = pitch;
}

/** Distance falloff is not modelled. */
export function audio_emitter_falloff(
  _emitter: number,
  _refDist: number,
  _maxDist: number,
  _factor: number,
): void {}

export function audio_emitter_get_gain(emitter: number): number {
  return emitters.get(emitter)?.gain ?? 0;
}

export function audio_emitter_get_pitch(emitter: number): number {
  return emitters.get(emitter)?.pitch ?? 0;
}
