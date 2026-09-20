import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock howler before importing AudioSystem
vi.mock("howler", () => {
  const Howl = vi.fn().mockImplementation(function () {
    return {
      play: vi.fn().mockReturnValue(1),
      stop: vi.fn(),
      pause: vi.fn(),
      unload: vi.fn(),
    };
  });
  const Howler = { volume: vi.fn() };
  return { Howl, Howler };
});

import { AudioSystem } from "../systems/AudioSystem.js";

describe("AudioSystem mixer (ducking + snapshots)", () => {
  let audio: AudioSystem;

  beforeEach(() => {
    audio = new AudioSystem();
  });

  it("duck() fades a bus toward the ducked volume over time", () => {
    audio.setBusVolume("music", 1);
    audio.duck("music", 0.5, 1); // duck to 50% over 1s
    expect(audio.isDucked("music")).toBe(true);

    audio.update(0.5); // halfway through the fade
    expect(audio.getBusVolume("music")).toBeGreaterThan(0.5);
    expect(audio.getBusVolume("music")).toBeLessThan(1);

    audio.update(0.5); // fade complete
    expect(audio.getBusVolume("music")).toBeCloseTo(0.5, 2);
  });

  it("endDuck() fades a ducked bus back to its base volume", () => {
    audio.setBusVolume("music", 0.8);
    audio.duck("music", 1, 0.1); // fully duck (to 0) over 0.1s
    audio.update(0.1);
    expect(audio.getBusVolume("music")).toBeCloseTo(0, 2);
    expect(audio.isDucked("music")).toBe(true);

    audio.endDuck("music", 0.1);
    audio.update(0.1);
    expect(audio.getBusVolume("music")).toBeCloseTo(0.8, 2);
    expect(audio.isDucked("music")).toBe(false);
  });

  it("defineSnapshot + transitionToSnapshot moves multiple buses over time", () => {
    audio.setBusVolume("music", 1);
    audio.setBusVolume("sfx", 1);
    audio.defineSnapshot("underwater", { music: 0.2, sfx: 0.3 });

    audio.transitionToSnapshot("underwater", 1);
    expect(audio.activeSnapshotTransitioning).toBe(true);

    audio.update(1); // complete the transition
    expect(audio.getBusVolume("music")).toBeCloseTo(0.2, 2);
    expect(audio.getBusVolume("sfx")).toBeCloseTo(0.3, 2);
    expect(audio.activeSnapshotTransitioning).toBe(false);
  });

  it("transitionToSnapshot warns and no-ops for an undefined snapshot", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    audio.transitionToSnapshot("nonexistent");
    expect(audio.activeSnapshotTransitioning).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("destroy() clears mixer state", () => {
    audio.duck("music", 0.5, 1);
    audio.defineSnapshot("calm", { music: 0.5 });
    audio.destroy();
    expect(audio.isDucked("music")).toBe(false);
  });
});
