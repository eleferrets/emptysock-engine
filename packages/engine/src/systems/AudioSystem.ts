import { Howl, Howler } from 'howler';

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
    this._groupVolumes.set(group, Math.max(0, Math.min(1, volume)));
  }

  getGroupVolume(group: string): number {
    return this._groupVolumes.get(group) ?? 1;
  }

  load(id: string, src: string, options: SoundOptions = {}): Howl {
    const groupVol = options.group ? this.getGroupVolume(options.group) : 1;
    const howl = new Howl({
      src: [src],
      volume: (options.volume ?? 1) * groupVol,
      loop: options.loop ?? false,
    });
    this._sounds.set(id, howl);
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
  }
}
