/**
 * Game-wide signal/broadcast bus. Any code holding the `Game` (or a scene's
 * `ctx.signals`) can `emit` a named signal with a payload and every listener
 * registered under that name is called synchronously, in registration order.
 * Augment `GameSignals` to type names/payloads:
 *
 *     declare module "@emptysock/engine" { interface GameSignals { "player-died": { id: number } } }
 *
 * `broadcast` reaches every listener of every signal (the "wildcard" tap used
 * by debugging tools). `SignalGroup` gives a scene a single `dispose()` that
 * removes everything it subscribed, so a scene's `onDestroy` cannot leak
 * handlers into the next scene (same stale-registration hazard as
 * ActorSystem, see CLAUDE.md).
 *
 * A listener throwing never blocks the other listeners; the error is
 * collected and re-thrown as one AggregateError after all have run.
 * Emitting from inside a listener is allowed and dispatched immediately
 * (nested), so an emit-loop on the same signal is the caller's to avoid.
 */
export interface GameSignals {
  [name: string]: unknown;
}
export type SignalListener<T = unknown> = (payload: T, name: string) => void;
export type Unsubscribe = () => void;
export declare class SignalBus {
  private readonly _listeners;
  private readonly _wildcards;
  on<T = unknown>(name: string, fn: SignalListener<T>): Unsubscribe;
  once<T = unknown>(name: string, fn: SignalListener<T>): Unsubscribe;
  off<T = unknown>(name: string, fn: SignalListener<T>): void;
  /** Listens to every emitted signal. */
  onAny(fn: SignalListener): Unsubscribe;
  /** Calls every listener of `name` (then wildcards). Returns how many ran. */
  emit<T = unknown>(name: string, payload?: T): number;
  /** Emits `payload` to every signal name that has at least one listener. */
  broadcast<T = unknown>(payload?: T): number;
  listenerCount(name?: string): number;
  clear(): void;
  /** A scope whose subscriptions are all removed by one `dispose()`. */
  group(): SignalGroup;
}
export declare class SignalGroup {
  private readonly _bus;
  private readonly _offs;
  constructor(_bus: SignalBus);
  on<T = unknown>(name: string, fn: SignalListener<T>): Unsubscribe;
  once<T = unknown>(name: string, fn: SignalListener<T>): Unsubscribe;
  emit<T = unknown>(name: string, payload?: T): number;
  dispose(): void;
}
//# sourceMappingURL=SignalBus.d.ts.map
