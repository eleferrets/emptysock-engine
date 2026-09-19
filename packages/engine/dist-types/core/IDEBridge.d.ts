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
  install(
    getSnapshot: SnapshotProvider,
    opts?: {
      onPatch?: ComponentPatchHandler;
      onSelect?: SelectHandler;
      tickMs?: number;
    },
  ): void;
  autoInstall(): void;
  send(
    entityId: string,
    component: string,
    fields: Record<string, unknown>,
  ): void;
  destroy(): void;
  private _hookEngine;
  private _broadcast;
  private _onMessage;
}
export declare const ideBridge: IDEBridgeService;
export {};
