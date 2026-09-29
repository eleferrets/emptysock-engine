import type { World } from "bitecs";
import type { Entity } from "../Entity.js";

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

export class SignalBus {
  private readonly _listeners = new Map<string, Set<SignalListener>>();
  private readonly _wildcards = new Set<SignalListener>();

  on<T = unknown>(name: string, fn: SignalListener<T>): Unsubscribe {
    let set = this._listeners.get(name);
    if (!set) {
      set = new Set();
      this._listeners.set(name, set);
    }
    const l = fn as SignalListener;
    set.add(l);
    return () => this.off(name, fn);
  }

  once<T = unknown>(name: string, fn: SignalListener<T>): Unsubscribe {
    const off = this.on<T>(name, (p, n) => {
      off();
      fn(p, n);
    });
    return off;
  }

  off<T = unknown>(name: string, fn: SignalListener<T>): void {
    const set = this._listeners.get(name);
    if (!set) return;
    set.delete(fn as SignalListener);
    if (set.size === 0) this._listeners.delete(name);
  }

  /** Listens to every emitted signal. */
  onAny(fn: SignalListener): Unsubscribe {
    this._wildcards.add(fn);
    return () => this._wildcards.delete(fn);
  }

  /** Calls every listener of `name` (then wildcards). Returns how many ran. */
  emit<T = unknown>(name: string, payload?: T): number {
    const errors: unknown[] = [];
    let n = 0;
    const run = (l: SignalListener): void => {
      n++;
      try {
        l(payload, name);
      } catch (e) {
        errors.push(e);
      }
    };
    const set = this._listeners.get(name);
    if (set) for (const l of [...set]) run(l);
    for (const l of [...this._wildcards]) run(l);
    if (errors.length > 0)
      throw new AggregateError(
        errors,
        `SignalBus: listener(s) for "${name}" threw`,
      );
    return n;
  }

  /** Emits `payload` to every signal name that has at least one listener. */
  broadcast<T = unknown>(payload?: T): number {
    let n = 0;
    for (const name of [...this._listeners.keys()])
      n += this.emit(name, payload);
    return n;
  }

  listenerCount(name?: string): number {
    if (name === undefined) {
      let n = this._wildcards.size;
      for (const s of this._listeners.values()) n += s.size;
      return n;
    }
    return this._listeners.get(name)?.size ?? 0;
  }

  clear(): void {
    this._listeners.clear();
    this._wildcards.clear();
  }

  /**
   * Subscribes `fn` to `name` for the lifetime of `entity`: when the entity
   * is destroyed (`Scene.destroy`, pooled or not) the listener is removed,
   * so a dead entity's handlers never leak or fire on a pooled reuse. Returns
   * an early unsubscribe. Throws on a destroyed entity.
   */
  onEntity<T = unknown>(
    entity: Entity,
    name: string,
    fn: SignalListener<T>,
  ): Unsubscribe {
    if (!entity.isAlive) {
      throw new Error("SignalBus.onEntity() called on a destroyed entity.");
    }
    let byEid = _entityGroups.get(entity.world);
    if (byEid === undefined) {
      byEid = new Map();
      _entityGroups.set(entity.world, byEid);
    }
    let group = byEid.get(entity.eid);
    if (group === undefined) {
      group = new SignalGroup(this);
      byEid.set(entity.eid, group);
    }
    return group.on(name, fn);
  }

  /** A scope whose subscriptions are all removed by one `dispose()`. */
  group(): SignalGroup {
    return new SignalGroup(this);
  }
}

/** World -> eid -> group of listeners registered with `SignalBus.onEntity`. */
const _entityGroups = new WeakMap<World, Map<number, SignalGroup>>();

/**
 * Removes every `onEntity` listener of `(world, eid)`. Called from
 * `Scene.destroy` alongside the other per-entity side-table clears, so
 * pooled ids (never released to bitECS) do not inherit listeners.
 *
 * @internal
 */
export function clearEntitySignals(world: World, eid: number): void {
  const byEid = _entityGroups.get(world);
  const group = byEid?.get(eid);
  if (group === undefined) return;
  group.dispose();
  byEid?.delete(eid);
}

export class SignalGroup {
  private readonly _offs: Unsubscribe[] = [];
  constructor(private readonly _bus: SignalBus) {}
  on<T = unknown>(name: string, fn: SignalListener<T>): Unsubscribe {
    const off = this._bus.on(name, fn);
    this._offs.push(off);
    return off;
  }
  once<T = unknown>(name: string, fn: SignalListener<T>): Unsubscribe {
    const off = this._bus.once(name, fn);
    this._offs.push(off);
    return off;
  }
  emit<T = unknown>(name: string, payload?: T): number {
    return this._bus.emit(name, payload);
  }
  dispose(): void {
    for (const off of this._offs.splice(0)) off();
  }
}
