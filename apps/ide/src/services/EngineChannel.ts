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

/**
 * Runtime type guard for one inbound `EntitySnapshot`. The postMessage
 * boundary between the IDE and the preview iframe is untyped at runtime —
 * a malformed or stale engine build could send a payload that satisfies
 * `Array.isArray` but not the actual shape, so every field is checked here
 * rather than trusting a single `as EntitySnapshot[]` cast.
 */
function isEntitySnapshot(x: unknown): x is EntitySnapshot {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o["id"] === "string" &&
    typeof o["name"] === "string" &&
    typeof o["active"] === "boolean" &&
    Array.isArray(o["components"]) &&
    o["components"].every((c) => typeof c === "string") &&
    Array.isArray(o["tags"]) &&
    o["tags"].every((t) => typeof t === "string") &&
    typeof o["x"] === "number" &&
    typeof o["y"] === "number" &&
    typeof o["rotation"] === "number"
  );
}

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
      if (!Array.isArray(payload)) {
        console.warn(
          "EngineChannel: dropped es:entities message — payload is not an array",
        );
        return;
      }
      if (!payload.every(isEntitySnapshot)) {
        console.warn(
          "EngineChannel: dropped es:entities message — one or more entities failed shape validation",
        );
        return;
      }
      const snapshots = payload;
      for (const h of this._entitiesHandlers) h(snapshots);
    } else if (t === "es:component-fields") {
      const entityId = data["entityId"];
      const component = data["component"];
      const fields = data["fields"];
      if (
        typeof entityId !== "string" ||
        typeof component !== "string" ||
        typeof fields !== "object" ||
        fields === null ||
        Array.isArray(fields)
      ) {
        console.warn(
          "EngineChannel: dropped es:component-fields message — malformed payload",
        );
        return;
      }
      for (const h of this._fieldsHandlers) {
        h(entityId, component, fields as Record<string, unknown>);
      }
    }
  }
}

export const engineChannel = new EngineChannelService();
