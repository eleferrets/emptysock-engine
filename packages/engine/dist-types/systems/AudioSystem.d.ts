import { Howl } from "howler";
export interface SoundOptions {
  volume?: number;
  loop?: boolean;
  group?: string;
}
export declare class AudioSystem {
  private readonly _sounds;
  private readonly _groupVolumes;
  private _masterVolume;
  get masterVolume(): number;
  set masterVolume(v: number);
  setGroupVolume(group: string, volume: number): void;
  getGroupVolume(group: string): number;
  setBusVolume(busId: string, volume: number): void;
  getBusVolume(busId: string): number;
  /** Maps sound id → the group it belongs to, for live volume updates. */
  private readonly _soundGroups;
  readonly defaultBuses: readonly [
    "master",
    "music",
    "sfx",
    "voice",
    "ambient",
  ];
  load(id: string, src: string, options?: SoundOptions): Howl;
  play(id: string): number | null;
  stop(id: string): void;
  /**
   * Sets a loaded sound's playback rate (1 = unchanged, 0.5 = half speed/an
   * octave down, 2 = double speed/an octave up) — Howler's own real,
   * documented `Howl.rate()` API. This is the engine-side answer to
   * GameMaker's `audio_sound_pitch(index, pitch)`, which is a real, common
   * idiom for cheap sound variety (a slightly different pitch each time the
   * same gunshot/footstep sample plays, rather than needing several
   * near-identical audio files) — see `compat/gmlActions.ts`'s
   * `audio_sound_pitch`. Applies to every currently-playing (and future)
   * instance of this loaded sound id, matching GameMaker's own per-sound
   * (not per-play-instance) pitch semantic. A `id` that was never `load()`ed
   * is a safe, honest no-op — the same "warn, don't throw" shape `play()`
   * already uses for a missing sound.
   */
  setPitch(id: string, rate: number): void;
  pause(id: string): void;
  unload(id: string): void;
  unloadAll(): void;
  /** Per-bus base volume set by the game (before ducking is applied). */
  private readonly _baseVolumes;
  private readonly _ducks;
  /**
   * Temporarily lower `bus`'s volume to `bus base volume * (1 - amount)`,
   * fading over `fadeTime` seconds, for as long as the duck is active.
   * Call `endDuck(bus)` to fade back to the base volume. Re-ducking a bus
   * that is already ducked replaces the previous duck.
   */
  duck(bus: string, amount: number, fadeTime?: number): void;
  /** Fade a ducked bus back to its pre-duck base volume. */
  endDuck(bus: string, fadeTime?: number): void;
  isDucked(bus: string): boolean;
  private readonly _snapshots;
  private _snapshotTransition;
  /** Register a named volume preset across buses (missing buses are left unchanged). */
  defineSnapshot(name: string, busVolumes: Record<string, number>): void;
  /** Transition every bus in the snapshot to its stored volume over `duration` seconds. */
  transitionToSnapshot(name: string, duration?: number): void;
  get activeSnapshotTransitioning(): boolean;
  update(dt: number): void;
  destroy(): void;
}
