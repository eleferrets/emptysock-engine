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
  pause(id: string): void;
  unload(id: string): void;
  unloadAll(): void;
  update(_dt: number): void;
  destroy(): void;
}
