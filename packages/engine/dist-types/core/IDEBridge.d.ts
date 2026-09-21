import type { HostAdapter } from "@emptysock/types";
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
declare class IDEBridgeService {
  private _active;
  private _tickHandle;
  private _provider;
  private _onPatch;
  private _onSelect;
  private readonly _adapterSlot;
  /** Captured from the first incoming message's origin; used for replies. */
  private _targetOrigin;
  install(
    adapter: HostAdapter,
    getSnapshot: SnapshotProvider,
    opts?: {
      onPatch?: ComponentPatchHandler;
      onSelect?: SelectHandler;
      tickMs?: number;
    },
  ): void;
  send(
    entityId: string,
    component: string,
    fields: Record<string, unknown>,
  ): void;
  destroy(): void;
  private _broadcast;
  private _onMessage;
}
export declare const ideBridge: IDEBridgeService;
export {};
