// IDEBridge — postMessage channel between the engine running in an iframe
// and the EmptySock IDE parent window.
//
// Usage in game code:
//   import { ideBridge } from '@emptysock/engine';
//   ideBridge.install(() => myScene.getEntities().values().map(toSnapshot));
//
// The bridge is a no-op when not running inside an iframe.

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

export type ComponentPatchHandler = (
  entityId: string,
  component: string,
  patch: Record<string, unknown>,
) => void;

export type SelectHandler = (entityId: string) => void;

type SnapshotProvider = () => EntitySnapshot[];

class IDEBridgeService {
  private _active = false;
  private _tickHandle: ReturnType<typeof setInterval> | null = null;
  private _provider: SnapshotProvider | null = null;
  private _onPatch: ComponentPatchHandler | null = null;
  private _onSelect: SelectHandler | null = null;

  install(
    getSnapshot: SnapshotProvider,
    opts?: {
      onPatch?: ComponentPatchHandler;
      onSelect?: SelectHandler;
      tickMs?: number;
    },
  ): void {
    if (typeof window === "undefined" || window.parent === window) return;
    this.destroy();
    this._active = true;
    this._provider = getSnapshot;
    this._onPatch = opts?.onPatch ?? null;
    this._onSelect = opts?.onSelect ?? null;
    window.addEventListener("message", this._onMessage);
    this._tickHandle = setInterval(() => {
      this._broadcast();
    }, opts?.tickMs ?? 100);
  }

  // Auto-install: hooks into window.EmptySockEngine.Engine.prototype.start so
  // the bridge activates as soon as any Engine instance starts, without
  // requiring the user to call install() explicitly. Called from PlayRunner's
  // iframe template after the engine bundle loads.
  autoInstall(): void {
    if (typeof window === "undefined" || window.parent === window) return;
    this._active = true;
    window.addEventListener("message", this._onMessage);

    const esEngine = (window as unknown as Record<string, unknown>)[
      "EmptySockEngine"
    ] as Record<string, unknown> | undefined;
    const EngineClass = esEngine?.["Engine"] as
      | { prototype: Record<string, unknown> }
      | undefined;
    if (EngineClass === undefined) return;

    const bridge = this;
    const proto = EngineClass.prototype;
    const origStart = proto["start"] as
      | ((...args: unknown[]) => unknown)
      | undefined;
    const origStop = proto["stop"] as (() => void) | undefined;
    if (origStart === undefined) return;

    proto["start"] = function (
      this: Record<string, unknown>,
      ...args: unknown[]
    ): unknown {
      const result = origStart.apply(this, args);
      bridge._hookEngine(this);
      return result;
    };
    if (origStop !== undefined) {
      proto["stop"] = function (this: Record<string, unknown>): void {
        bridge.destroy();
        origStop.apply(this);
      };
    }
  }

  send(
    entityId: string,
    component: string,
    fields: Record<string, unknown>,
  ): void {
    if (!this._active || typeof window === "undefined") return;
    window.parent.postMessage(
      { type: "es:component-fields", entityId, component, fields },
      "*",
    );
  }

  destroy(): void {
    if (!this._active) return;
    if (this._tickHandle !== null) {
      clearInterval(this._tickHandle);
      this._tickHandle = null;
    }
    if (typeof window !== "undefined") {
      window.removeEventListener("message", this._onMessage);
    }
    this._active = false;
    this._provider = null;
  }

  private _hookEngine(engine: Record<string, unknown>): void {
    const bridge = this;
    const provider: SnapshotProvider = () => {
      const scene =
        (engine["_currentScene"] as Record<string, unknown> | undefined) ??
        (engine["currentScene"] as Record<string, unknown> | undefined);
      if (scene === undefined) return [];
      const getEntities = scene["getEntities"] as
        | (() => Map<string, Record<string, unknown>>)
        | undefined;
      if (getEntities === undefined) return [];
      const snapshots: EntitySnapshot[] = [];
      for (const [, e] of getEntities()) {
        const id = String(e["id"] ?? "");
        const name = String(e["name"] ?? id);
        const active = Boolean(e["active"] ?? true);
        const components = e["_components"] as Map<string, unknown> | undefined;
        const tags = e["_tags"] as Set<string> | undefined;
        // Extract Transform position if present
        let x = 0;
        let y = 0;
        let rotation = 0;
        const transform = components?.get("Transform") as
          | Record<string, unknown>
          | undefined;
        if (transform !== undefined) {
          x = Number(transform["x"] ?? 0);
          y = Number(transform["y"] ?? 0);
          rotation = Number(transform["rotation"] ?? 0);
        }
        snapshots.push({
          id,
          name,
          active,
          components: components !== undefined ? [...components.keys()] : [],
          tags: tags !== undefined ? [...tags] : [],
          x,
          y,
          rotation,
        });
      }
      return snapshots;
    };
    bridge._provider = provider;
    if (bridge._tickHandle === null) {
      bridge._tickHandle = setInterval(() => bridge._broadcast(), 100);
    }
  }

  private _broadcast(): void {
    if (this._provider === null || !this._active || typeof window === "undefined") return;
    const payload = this._provider();
    window.parent.postMessage({ type: "es:entities", payload }, "*");
  }

  private _onMessage = (event: MessageEvent): void => {
    const data = event.data as Record<string, unknown> | null;
    if (typeof data !== "object" || data === null) return;
    const t = data["type"];
    if (t === "es:select-entity" && typeof data["id"] === "string") {
      this._onSelect?.(data["id"]);
      if (typeof window !== "undefined") {
        window.parent.postMessage(
          { type: "es:entity-selected", id: data["id"] },
          "*",
        );
      }
    } else if (t === "es:set-component") {
      const id = data["id"];
      const component = data["component"];
      const patch = data["patch"];
      if (
        typeof id === "string" &&
        typeof component === "string" &&
        typeof patch === "object" &&
        patch !== null
      ) {
        this._onPatch?.(id, component, patch as Record<string, unknown>);
      }
    }
  };
}

export const ideBridge = new IDEBridgeService();
