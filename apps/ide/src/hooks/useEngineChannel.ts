// useEngineChannel — polls the live preview's QueryChannel bridge for the
// currently-loaded scene's entities and the selected entity's live
// component fields, and exposes a setComponent() helper for live edits.
// Mount this once near the root of the app (or in CanvasPreview).

import { useEffect, useCallback } from "react";
import { useIDEStore } from "../store/ideStore";
import { engineChannel, summaryToSnapshot } from "../services/EngineChannel";
import type { EntitySummary } from "../services/EngineChannel";

/** How often to re-poll the live scene while the preview is running. Fast enough to feel live, cheap enough not to flood a query round trip every frame. */
const POLL_INTERVAL_MS = 300;

export function useEngineChannel(
  iframeRef: React.RefObject<HTMLIFrameElement | null>,
): {
  setComponent: (
    entityId: string,
    component: string,
    patch: Record<string, unknown>,
  ) => Promise<boolean>;
} {
  const setLiveEntities = useIDEStore((s) => s.setLiveEntities);
  const setLiveComponentFields = useIDEStore((s) => s.setLiveComponentFields);

  // Keep the singleton's iframe ref in sync so query() works without passing
  // the iframe explicitly from SceneInspector / EntityProperties.
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
    let cancelled = false;

    async function poll(): Promise<void> {
      const list = await engineChannel.query<EntitySummary[]>({
        kind: "listEntities",
      });
      if (cancelled) return;
      // "no-live-instance" just means the preview isn't running a game yet
      // (or not one with a Scene loaded) — an empty live list, not an error
      // to surface, since liveEntities.length === 0 already falls back to
      // the editor-authored entity list elsewhere in the store.
      setLiveEntities(list.ok ? list.data.map(summaryToSnapshot) : []);

      const selected = useIDEStore.getState().selectedEntity;
      if (selected !== null) {
        const entityId = Number(selected.id);
        if (Number.isFinite(entityId)) {
          const fields: Record<string, Record<string, unknown>> = {};
          for (const component of selected.components) {
            const result = await engineChannel.query<Record<string, unknown>>({
              kind: "getComponent",
              entityId,
              component: component.type,
            });
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- `cancelled` is reassigned by this effect's cleanup after this `await` suspends; ESLint's flow analysis can't see that closure mutation.
            if (cancelled) return;
            if (result.ok) fields[component.type] = result.data;
          }
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- same as above.
          if (!cancelled) {
            setLiveComponentFields(
              Object.keys(fields).length > 0 ? fields : null,
            );
          }
        }
      } else {
        setLiveComponentFields(null);
      }
    }

    const interval = setInterval(() => {
      void poll();
    }, POLL_INTERVAL_MS);
    void poll();

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [setLiveEntities, setLiveComponentFields]);

  const setComponent = useCallback(
    async (
      entityId: string,
      component: string,
      patch: Record<string, unknown>,
    ): Promise<boolean> => {
      const numericId = Number(entityId);
      if (!Number.isFinite(numericId)) return false;
      const result = await engineChannel.query({
        kind: "setComponent",
        entityId: numericId,
        component,
        patch,
      });
      return result.ok;
    },
    [],
  );

  return { setComponent };
}
