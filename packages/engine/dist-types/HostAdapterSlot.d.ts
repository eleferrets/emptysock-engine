import type { HostAdapter, HostMessage } from "@emptysock/types";
/**
 * A single attach point for a `HostAdapter`. Both `EngineAPI` (the debugger
 * bridge) and `IDEBridge` (the entity-inspector bridge) need the same small
 * lifecycle — hold an adapter, default to a no-op `NullHostAdapter`, swap it
 * on `install()`, deregister the previous listener so it can't fire after
 * being replaced. `HostAdapterSlot` is that lifecycle, written once.
 */
export declare class HostAdapterSlot {
  private _adapter;
  private _listener;
  get current(): HostAdapter;
  /** Attach `adapter`, replacing any previously attached one and its listener. */
  install(adapter: HostAdapter, listener?: (event: HostMessage) => void): void;
  /** Deregister the current listener and reset to the null adapter. */
  detach(): void;
}
