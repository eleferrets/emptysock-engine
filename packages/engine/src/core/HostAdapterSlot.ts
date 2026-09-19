import type { HostAdapter, HostMessage } from "@emptysock/types";
import { NullHostAdapter } from "@emptysock/types";

/**
 * A single attach point for a `HostAdapter`. Both `EngineAPI` (the debugger
 * bridge) and `IDEBridge` (the entity-inspector bridge) need the same small
 * lifecycle — hold an adapter, default to a no-op `NullHostAdapter`, swap it
 * on `install()`, deregister the previous listener so it can't fire after
 * being replaced. `HostAdapterSlot` is that lifecycle, written once.
 */
export class HostAdapterSlot {
  private _adapter: HostAdapter = new NullHostAdapter();
  private _listener: ((event: HostMessage) => void) | null = null;

  get current(): HostAdapter {
    return this._adapter;
  }

  /** Attach `adapter`, replacing any previously attached one and its listener. */
  install(adapter: HostAdapter, listener?: (event: HostMessage) => void): void {
    this.detach();
    this._adapter = adapter;
    if (listener !== undefined) {
      this._listener = listener;
      this._adapter.addMessageListener(listener);
    }
  }

  /** Deregister the current listener and reset to the null adapter. */
  detach(): void {
    if (this._listener !== null) {
      this._adapter.removeMessageListener(this._listener);
      this._listener = null;
    }
    this._adapter = new NullHostAdapter();
  }
}
