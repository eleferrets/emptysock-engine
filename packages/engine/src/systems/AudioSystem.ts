import { Howl, Howler } from "howler";

export interface SoundOptions {
  volume?: number;
  loop?: boolean;
  group?: string;
}

export class AudioSystem {
  private readonly _sounds: Map<string, Howl> = new Map();
  private readonly _groupVolumes: Map<string, number> = new Map();
  private _masterVolume: number = 1;

  get masterVolume(): number {
    return this._masterVolume;
  }

  set masterVolume(v: number) {
    this._masterVolume = Math.max(0, Math.min(1, v));
    Howler.volume(this._masterVolume);
  }

  setGroupVolume(group: string, volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    this._groupVolumes.set(group, clamped);
    // Apply to all already-loaded sounds in this group
    for (const [id, g] of this._soundGroups) {
      if (g === group) {
        this._sounds.get(id)?.volume(clamped);
      }
    }
  }

  getGroupVolume(group: string): number {
    return this._groupVolumes.get(group) ?? 1;
  }

  setBusVolume(busId: string, volume: number): void {
    this.setGroupVolume(busId, volume);
  }

  getBusVolume(busId: string): number {
    return this.getGroupVolume(busId);
  }

  /** Maps sound id → the group it belongs to, for live volume updates. */
  private readonly _soundGroups: Map<string, string> = new Map();

  readonly defaultBuses = [
    "master",
    "music",
    "sfx",
    "voice",
    "ambient",
  ] as const;

  load(id: string, src: string, options: SoundOptions = {}): Howl {
    const groupVol = options.group ? this.getGroupVolume(options.group) : 1;
    const howl = new Howl({
      src: [src],
      volume: (options.volume ?? 1) * groupVol,
      loop: options.loop ?? false,
    });
    this._sounds.set(id, howl);
    if (options.group !== undefined) {
      this._soundGroups.set(id, options.group);
    }
    return howl;
  }

  play(id: string): number | null {
    const sound = this._sounds.get(id);
    if (sound === undefined) {
      console.warn(`AudioSystem: sound "${id}" not loaded`);
      return null;
    }
    return sound.play();
  }

  stop(id: string): void {
    this._sounds.get(id)?.stop();
  }

  /**
   * Sets a loaded sound's playback rate (1 = unchanged, 0.5 = half speed/an
   * octave down, 2 = double speed/an octave up) — Howler's own real,
   * documented `Howl.rate()` API. This is the engine-side answer to
   * `audio_sound_pitch(index, pitch)`, which is a real, common
   * idiom for cheap sound variety (a slightly different pitch each time the
   * same gunshot/footstep sample plays, rather than needing several
   * near-identical audio files) — see the compat layer's
   * `audio_sound_pitch`. Applies to every currently-playing (and future)
   * instance of this loaded sound id, matching the per-sound
   * (not per-play-instance) pitch semantic. A `id` that was never `load()`ed
   * is a safe, honest no-op — the same "warn, don't throw" shape `play()`
   * already uses for a missing sound.
   */
  setPitch(id: string, rate: number): void {
    const sound = this._sounds.get(id);
    if (sound === undefined) {
      console.warn(`AudioSystem: sound "${id}" not loaded`);
      return;
    }
    sound.rate(rate);
  }

  pause(id: string): void {
    this._sounds.get(id)?.pause();
  }

  unload(id: string): void {
    const sound = this._sounds.get(id);
    if (sound !== undefined) {
      sound.unload();
      this._sounds.delete(id);
    }
  }

  unloadAll(): void {
    for (const sound of this._sounds.values()) {
      sound.unload();
    }
    this._sounds.clear();
    this._soundGroups.clear();
  }

  // ─── Mixer: ducking ───────────────────────────────────────────────────

  /** Per-bus base volume set by the game (before ducking is applied). */
  private readonly _baseVolumes: Map<string, number> = new Map();
  private readonly _ducks: Map<string, DuckState> = new Map();

  /**
   * Temporarily lower `bus`'s volume to `bus base volume * (1 - amount)`,
   * fading over `fadeTime` seconds, for as long as the duck is active.
   * Call `endDuck(bus)` to fade back to the base volume. Re-ducking a bus
   * that is already ducked replaces the previous duck.
   */
  duck(bus: string, amount: number, fadeTime: number = 0.15): void {
    const base = this._baseVolumes.get(bus) ?? this.getBusVolume(bus);
    this._baseVolumes.set(bus, base);
    this._ducks.set(bus, {
      fromVolume: this.getBusVolume(bus),
      toVolume: base * Math.max(0, 1 - Math.max(0, Math.min(1, amount))),
      elapsed: 0,
      duration: Math.max(0, fadeTime),
    });
  }

  /** Fade a ducked bus back to its pre-duck base volume. */
  endDuck(bus: string, fadeTime: number = 0.15): void {
    const base = this._baseVolumes.get(bus) ?? this.getBusVolume(bus);
    this._ducks.set(bus, {
      fromVolume: this.getBusVolume(bus),
      toVolume: base,
      elapsed: 0,
      duration: Math.max(0, fadeTime),
    });
    this._baseVolumes.delete(bus);
  }

  isDucked(bus: string): boolean {
    return this._baseVolumes.has(bus);
  }

  // ─── Mixer: snapshots ─────────────────────────────────────────────────

  private readonly _snapshots: Map<string, Record<string, number>> = new Map();
  private _snapshotTransition: SnapshotTransition | null = null;

  /** Register a named volume preset across buses (missing buses are left unchanged). */
  defineSnapshot(name: string, busVolumes: Record<string, number>): void {
    this._snapshots.set(name, { ...busVolumes });
  }

  /** Transition every bus in the snapshot to its stored volume over `duration` seconds. */
  transitionToSnapshot(name: string, duration: number = 0.5): void {
    const target = this._snapshots.get(name);
    if (target === undefined) {
      console.warn(`AudioSystem: snapshot "${name}" not defined`);
      return;
    }
    const from: Record<string, number> = {};
    for (const bus of Object.keys(target)) {
      from[bus] = this.getBusVolume(bus);
    }
    this._snapshotTransition = {
      from,
      to: target,
      elapsed: 0,
      duration: Math.max(0, duration),
    };
  }

  get activeSnapshotTransitioning(): boolean {
    return this._snapshotTransition !== null;
  }

  update(dt: number): void {
    // Advance ducking fades
    for (const [bus, duck] of this._ducks) {
      duck.elapsed += dt;
      const t =
        duck.duration <= 0 ? 1 : Math.min(1, duck.elapsed / duck.duration);
      const v = duck.fromVolume + (duck.toVolume - duck.fromVolume) * t;
      this.setBusVolume(bus, v);
      if (t >= 1) this._ducks.delete(bus);
    }

    // Advance snapshot transition
    const snap = this._snapshotTransition;
    if (snap !== null) {
      snap.elapsed += dt;
      const t =
        snap.duration <= 0 ? 1 : Math.min(1, snap.elapsed / snap.duration);
      for (const bus of Object.keys(snap.to)) {
        const from = snap.from[bus] ?? this.getBusVolume(bus);
        const to = snap.to[bus] ?? from;
        this.setBusVolume(bus, from + (to - from) * t);
      }
      if (t >= 1) this._snapshotTransition = null;
    }
  }

  destroy(): void {
    this.unloadAll();
    this._ducks.clear();
    this._baseVolumes.clear();
    this._snapshots.clear();
    this._snapshotTransition = null;
  }
}

interface DuckState {
  fromVolume: number;
  toVolume: number;
  elapsed: number;
  duration: number;
}

interface SnapshotTransition {
  from: Record<string, number>;
  to: Record<string, number>;
  elapsed: number;
  duration: number;
}
