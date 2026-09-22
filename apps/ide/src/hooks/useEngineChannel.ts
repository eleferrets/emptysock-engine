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
  const setLiveComponentFields = useIDEStore((s) => s.setLiveComponentFields);

  // Keep the singleton's iframe ref in sync so postToEngine() works without
  // passing the iframe explicitly from SceneInspector / EntityProperties.
  useEffect(() => {
    engineChannel.setIframe(iframeRef.current);
    return () => engineChannel.setIframe(null);
  }, [iframeRef]);

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

  useEffect(() => {
    return engineChannel.onComponentFields((entityId, component, fields) => {
      const selectedId = useIDEStore.getState().selectedEntity?.id;
      if (entityId !== selectedId) return;
      const prev = useIDEStore.getState().liveComponentFields;
      setLiveComponentFields({ ...(prev ?? {}), [component]: fields });
    });
  }, [setLiveComponentFields]);

  const sendToEngine = useCallback((msg: OutboundMsg): void => {
    // engineChannel's iframe ref is kept in sync above, so postToEngine()
    // (the one real implementation — see EngineChannel.ts) already knows
    // which iframe to post to without it being passed here again.
    engineChannel.postToEngine(msg);
  }, []);

  return { sendToEngine };
}
