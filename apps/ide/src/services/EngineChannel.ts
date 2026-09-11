// EngineChannel — IDE-side listener for postMessage events from the engine iframe.
// Validates the "es:" prefix and dispatches to registered handlers.

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

export type OutboundMsg =
  | { type: "es:select-entity"; id: string }
  | {
      type: "es:set-component";
      id: string;
      component: string;
      patch: Record<string, unknown>;
    };

type EntitiesHandler = (entities: EntitySnapshot[]) => void;
type FieldsHandler = (
  entityId: string,
  component: string,
  fields: Record<string, unknown>,
) => void;

class EngineChannelService {
  private readonly _entitiesHandlers = new Set<EntitiesHandler>();
  private readonly _fieldsHandlers = new Set<FieldsHandler>();
  private _iframe: HTMLIFrameElement | null = null;

  setIframe(iframe: HTMLIFrameElement | null): void {
    this._iframe = iframe;
  }

  postToEngine(msg: OutboundMsg): void {
    this._iframe?.contentWindow?.postMessage(msg, "*");
  }

  onEntities(handler: EntitiesHandler): () => void {
    this._entitiesHandlers.add(handler);
    return () => this._entitiesHandlers.delete(handler);
  }

  onComponentFields(handler: FieldsHandler): () => void {
    this._fieldsHandlers.add(handler);
    return () => this._fieldsHandlers.delete(handler);
  }

  handleMessage(event: MessageEvent): void {
    const data = event.data as Record<string, unknown> | null;
    if (typeof data !== "object" || data === null) return;
    const t = data["type"];
    if (typeof t !== "string" || !t.startsWith("es:")) return;

    if (t === "es:entities") {
      const payload = data["payload"];
      if (Array.isArray(payload)) {
        const snapshots = payload as EntitySnapshot[];
        for (const h of this._entitiesHandlers) h(snapshots);
      }
    } else if (t === "es:component-fields") {
      const entityId = data["entityId"];
      const component = data["component"];
      const fields = data["fields"];
      if (
        typeof entityId === "string" &&
        typeof component === "string" &&
        typeof fields === "object" &&
        fields !== null
      ) {
        for (const h of this._fieldsHandlers) {
          h(entityId, component, fields as Record<string, unknown>);
        }
      }
    }
  }

  sendToEngine(iframe: HTMLIFrameElement, msg: OutboundMsg): void {
    iframe.contentWindow?.postMessage(msg, "*");
  }
}

export const engineChannel = new EngineChannelService();
