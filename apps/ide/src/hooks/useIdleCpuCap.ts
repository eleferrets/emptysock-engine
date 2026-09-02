import { useEffect } from "react";
import { useIDEStore } from "../store/ideStore";
import { playRunner } from "../services/PlayRunner";
import { loadSettings } from "../services/SettingsService";

/**
 * Wires two frame-rate throttle behaviours into the game preview iframe:
 *
 * 1. Power-mode saver: whenever the preview enters the playing state while
 *    powerMode is 'saver', caps the iframe RAF loop to 30 fps.
 *
 * 2. Idle CPU cap: when the browser tab becomes hidden while the game is
 *    playing, posts the idleCpuCap setting as the frame-rate ceiling.  When
 *    the tab becomes visible again the cap is restored to the power-mode value
 *    (30 fps for 'saver') or removed entirely (0 = uncapped).
 */
export function useIdleCpuCap(): void {
  const playState = useIDEStore((s) => s.playState);

  // Apply power-mode cap whenever playState transitions to 'playing'.
  useEffect(() => {
    if (playState !== "playing") return;
    const { powerMode } = loadSettings();
    playRunner.postFpsCap(powerMode === "saver" ? 30 : 0);
  }, [playState]);

  // Apply the idle-cpu cap on visibility change, independent of play state
  // transitions.
  useEffect(() => {
    const handleVisibilityChange = (): void => {
      const { playState: currentPlayState } = useIDEStore.getState();
      const settings = loadSettings();

      if (document.hidden && currentPlayState === "playing") {
        playRunner.postFpsCap(settings.idleCpuCap);
      } else if (!document.hidden) {
        // Restore to the power-mode cap (or uncapped if not in saver mode).
        playRunner.postFpsCap(settings.powerMode === "saver" ? 30 : 0);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);
}
