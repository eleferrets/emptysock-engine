// EngineChannel — IDE-side transport for the live Inspector bridge.
//
// Talks a request/response protocol (`es:query` / `es:query-result`) to the
// preview iframe's own bootstrap script (`PlayRunner.ts`'s `buildIframeHtml`),
// which relays each query to a `QueryChannel` (`@emptysock/engine`)
// attached to whatever `Game`/`Scene` the user's own game code created — see
// `QueryChannel.ts`'s doc comment for the full design. This replaces the
// classic `IDEBridge`'s fire-and-forget `es:entities`/`es:set-component`
// broadcast, which had no real caller anywhere in `apps/ide` to begin with
// (nothing ever called `ideBridge.install()`).

import type {
  EngineQuery,
  EngineQueryResult,
  EntitySummary,
} from "@emptysock/engine";

export type { EntitySummary };

export interface EntitySnapshot {
  id: string;
  name: string;
  active: boolean;
  components: string[];
  tags: string[];
  x: number;
  y: number;
  rotation: number;
}

/** `EntitySummary`'s optional, "absent means a sane default" fields become real defaults at this boundary — `apps/ide`'s panels read plain, always-present values. */
export function summaryToSnapshot(summary: EntitySummary): EntitySnapshot {
  return {
    id: String(summary.entityId),
    name: summary.name ?? `Entity ${summary.entityId}`,
    active: summary.active ?? true,
    components: summary.components,
    tags: summary.tags !== undefined ? [...summary.tags] : [],
    x: summary.x ?? 0,
    y: summary.y ?? 0,
    rotation: summary.rotation ?? 0,
  };
}

interface PendingQuery {
  resolve: (result: EngineQueryResult<unknown>) => void;
  timeoutHandle: ReturnType<typeof setTimeout>;
}

/** How long a query waits for a reply before resolving as `no-live-instance` — the preview iframe may not have loaded a Game yet, which is a normal state, not an error to surface as a hang. */
const QUERY_TIMEOUT_MS = 2000;

let _nextQueryId = 0;

class EngineChannelService {
  private _iframe: HTMLIFrameElement | null = null;
  private readonly _pending = new Map<string, PendingQuery>();

  setIframe(iframe: HTMLIFrameElement | null): void {
    this._iframe = iframe;
    // A new iframe means every in-flight query's answer can never arrive.
    for (const [id, pending] of this._pending) {
      clearTimeout(pending.timeoutHandle);
      pending.resolve({
        ok: false,
        error: {
          code: "no-live-instance",
          message: "Preview iframe changed before this query returned.",
        },
      });
      this._pending.delete(id);
    }
  }

  /**
   * Send one query to the live preview and resolve with its real answer, or
   * a `no-live-instance` result if nothing replies in time (no game loaded
   * yet, or the preview isn't running at all) — never a thrown/rejected
   * promise for that ordinary case.
   */
  query<T>(q: EngineQuery): Promise<EngineQueryResult<T>> {
    const contentWindow = this._iframe?.contentWindow;
    if (contentWindow === null || contentWindow === undefined) {
      return Promise.resolve({
        ok: false,
        error: {
          code: "no-live-instance",
          message: "No preview iframe is running.",
        },
      });
    }

    const id = `q${String(_nextQueryId++)}`;
    return new Promise((resolve) => {
      const timeoutHandle = setTimeout(() => {
        this._pending.delete(id);
        resolve({
          ok: false,
          error: {
            code: "no-live-instance",
            message: "No live game answered this query.",
          },
        });
      }, QUERY_TIMEOUT_MS);
      this._pending.set(id, {
        resolve: resolve as (result: EngineQueryResult<unknown>) => void,
        timeoutHandle,
      });
      contentWindow.postMessage({ type: "es:query", id, query: q }, "*");
    });
  }

  handleMessage(event: MessageEvent): void {
    const data = event.data as Record<string, unknown> | null;
    if (typeof data !== "object" || data === null) return;
    if (data["type"] !== "es:query-result") return;

    const id = data["id"];
    const result = data["result"];
    if (
      typeof id !== "string" ||
      typeof result !== "object" ||
      result === null
    ) {
      return;
    }
    const pending = this._pending.get(id);
    if (pending === undefined) return; // Already timed out, or an id from a stale iframe.
    clearTimeout(pending.timeoutHandle);
    this._pending.delete(id);
    pending.resolve(result as EngineQueryResult<unknown>);
  }
}

export const engineChannel = new EngineChannelService();
