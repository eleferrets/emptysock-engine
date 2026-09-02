/**
 * AudioMixerService — singleton that backs the AudioMixer panel with a real Web Audio graph.
 *
 * The AudioContext is created lazily on the first call to any mutating method so that
 * the browser's autoplay policy is not violated before the user interacts with the page.
 */

interface BusState {
  gain: GainNode;
  /** Volume in the 0–1 range as last set by setVolume. */
  volume: number;
  muted: boolean;
  solo: boolean;
}

class AudioMixerService {
  private _ctx: AudioContext | null = null;
  private readonly _buses: Map<string, BusState> = new Map();

  private _getContext(): AudioContext {
    if (this._ctx === null) {
      this._ctx = new AudioContext();
    }
    return this._ctx;
  }

  private _getBus(busId: string): BusState {
    const existing = this._buses.get(busId);
    if (existing !== undefined) return existing;

    const ctx = this._getContext();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.value = 1;

    const state: BusState = { gain, volume: 1, muted: false, solo: false };
    this._buses.set(busId, state);
    return state;
  }

  /** Apply the effective gain to every registered bus, accounting for solo. */
  private _flush(): void {
    const hasSolo = Array.from(this._buses.values()).some((b) => b.solo);
    for (const [, bus] of this._buses) {
      const silenced = bus.muted || (hasSolo && !bus.solo);
      bus.gain.gain.value = silenced ? 0 : bus.volume;
    }
  }

  /** Set a bus volume. `value` must be in the 0–1 range. */
  setVolume(busId: string, value: number): void {
    const bus = this._getBus(busId);
    bus.volume = Math.max(0, Math.min(1, value));
    this._flush();
  }

  /** Mute or unmute a bus. */
  setMute(busId: string, muted: boolean): void {
    const bus = this._getBus(busId);
    bus.muted = muted;
    this._flush();
  }

  /** Solo or unsolo a bus. When any bus is soloed, all other buses are silenced. */
  setSolo(busId: string, solo: boolean): void {
    const bus = this._getBus(busId);
    bus.solo = solo;
    this._flush();
  }
}

export const audioMixerService = new AudioMixerService();
