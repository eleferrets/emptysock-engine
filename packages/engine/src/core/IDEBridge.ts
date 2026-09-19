// IDEBridge — postMessage channel between the engine running in an iframe
// and the EmptySock IDE parent window.
//
// Usage in game code:
//   import { ideBridge } from '@emptysock/engine';
//   ideBridge.install(adapter, () => myScene.getEntities().values().map(toSnapshot));
//
// The bridge is a no-op when no HostAdapter is provided.

import type { HostAdapter, HostMessage } from "@emptysock/types";
import { HostAdapterSlot } from "./HostAdapterSlot.js";

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
  private _tickHandle: unknown = null;
  private _provider: SnapshotProvider | null = null;
  private _onPatch: ComponentPatchHandler | null = null;
  private _onSelect: SelectHandler | null = null;
  private readonly _adapterSlot = new HostAdapterSlot();
  /** Captured from the first incoming message's origin; used for replies. */
  private _targetOrigin = "*";

  install(
    adapter: HostAdapter,
    getSnapshot: SnapshotProvider,
    opts?: {
      onPatch?: ComponentPatchHandler;
      onSelect?: SelectHandler;
      tickMs?: number;
    },
  ): void {
    this.destroy();
    this._adapterSlot.install(adapter, this._onMessage);
    this._active = true;
    this._provider = getSnapshot;
    this._onPatch = opts?.onPatch ?? null;
    this._onSelect = opts?.onSelect ?? null;
    this._tickHandle = adapter.setInterval(() => {
      this._broadcast();
    }, opts?.tickMs ?? 100);
  }

  send(
    entityId: string,
    component: string,
    fields: Record<string, unknown>,
  ): void {
    if (!this._active) return;
    this._adapterSlot.current.postMessage(
      { type: "es:component-fields", entityId, component, fields },
      this._targetOrigin,
    );
  }

  destroy(): void {
    if (!this._active) return;
    if (this._tickHandle !== null) {
      this._adapterSlot.current.clearInterval(this._tickHandle);
      this._tickHandle = null;
    }
    this._adapterSlot.detach();
    this._active = false;
    this._provider = null;
    this._targetOrigin = "*";
  }

  private _broadcast(): void {
    if (this._provider === null || !this._active) return;
    const payload = this._provider();
    this._adapterSlot.current.postMessage(
      { type: "es:entities", payload },
      this._targetOrigin,
    );
  }

  private _onMessage = (event: HostMessage): void => {
    // Capture origin from first real message for subsequent replies.
    if (event.origin !== "" && event.origin !== "null") {
      this._targetOrigin = event.origin;
    }
    const data = event.data as Record<string, unknown> | null;
    if (typeof data !== "object" || data === null) return;
    switch (data["type"]) {
      case "es:select-entity":
        if (typeof data["id"] === "string") {
          this._onSelect?.(data["id"]);
          this._adapterSlot.current.postMessage(
            { type: "es:entity-selected", id: data["id"] },
            this._targetOrigin,
          );
        }
        break;
      case "es:set-component": {
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
        break;
      }
    }
  };
}

export const ideBridge = new IDEBridgeService();
