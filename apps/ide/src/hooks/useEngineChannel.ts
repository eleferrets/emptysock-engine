// useEngineChannel — attaches the IDE-side engine channel listener.
// Mount this once near the root of the app (or in CanvasPreview).
// Returns a sendToEngine() helper for outbound messages.

import { useEffect, useCallback } from "react";
import { useIDEStore } from "../store/ideStore";
import { engineChannel } from "../services/EngineChannel";
import type { OutboundMsg } from "../services/EngineChannel";

export function useEngineChannel(
  iframeRef: React.RefObject<HTMLIFrameElement | null>,
): {
  sendToEngine: (msg: OutboundMsg) => void;
} {
  const setLiveEntities = useIDEStore((s) => s.setLiveEntities);

  useEffect(() => {
    function onMessage(event: MessageEvent): void {
      engineChannel.handleMessage(event);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    return engineChannel.onEntities((entities) => {
      setLiveEntities(entities);
    });
  }, [setLiveEntities]);

  const sendToEngine = useCallback(
    (msg: OutboundMsg): void => {
      const iframe = iframeRef.current;
      if (iframe === null) return;
      engineChannel.sendToEngine(iframe, msg);
    },
    [iframeRef],
  );

  return { sendToEngine };
}
