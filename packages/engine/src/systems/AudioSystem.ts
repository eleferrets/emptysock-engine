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

  update(_dt: number): void {}

  destroy(): void {
    this.unloadAll();
  }
}
