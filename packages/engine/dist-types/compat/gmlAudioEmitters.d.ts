/**
 * GameMaker's audio emitter family. Positional audio is not modelled by the
 * engine's `AudioSystem`, so emitters are plain handles that remember their
 * settings: code that creates, moves and tunes emitters runs, and a sound
 * played on an emitter (`audio_play_sound_on`, lowered by the transpiler to
 * `audio_play_sound`) plays non-positionally.
 */
export declare function audio_emitter_create(): number;
export declare function audio_emitter_free(emitter: number): void;
export declare function audio_emitter_exists(emitter: number): boolean;
export declare function audio_emitter_position(
  emitter: number,
  x: number,
  y: number,
  z: number,
): void;
/** Velocity only feeds Doppler, which is not modelled. */
export declare function audio_emitter_velocity(
  _emitter: number,
  _vx: number,
  _vy: number,
  _vz: number,
): void;
export declare function audio_emitter_gain(emitter: number, gain: number): void;
export declare function audio_emitter_pitch(
  emitter: number,
  pitch: number,
): void;
/** Distance falloff is not modelled. */
export declare function audio_emitter_falloff(
  _emitter: number,
  _refDist: number,
  _maxDist: number,
  _factor: number,
): void;
export declare function audio_emitter_get_gain(emitter: number): number;
export declare function audio_emitter_get_pitch(emitter: number): number;
