import type { Actor } from './Actor.js';
import type { Message } from './Actor.js';

/**
 * Manages a registry of Actors. Wire this into your game loop:
 *
 *   const actors = new ActorSystem();
 *   actors.register(myActor);
 *   // in update:
 *   actors.update(dt);
 */
export class ActorSystem {
  private readonly _actors: Map<string, Actor> = new Map();

  register(actor: Actor): void {
    if (this._actors.has(actor.id)) {
      throw new Error(`[ActorSystem] Actor id "${actor.id}" is already registered.`);
    }
    this._actors.set(actor.id, actor);
    actor.start();
  }

  unregister(id: string): void {
    const actor = this._actors.get(id);
    if (actor === undefined) return;
    actor.stop();
    actor.destroy();
    this._actors.delete(id);
  }

  get(id: string): Actor | undefined {
    return this._actors.get(id);
  }

  /** Send a message to a specific actor by id. No-op if the id is unknown. */
  send(actorId: string, msg: Message): void {
    this._actors.get(actorId)?.send(msg);
  }

  /** Broadcast a message to every registered actor. */
  broadcast(msg: Message): void {
    for (const actor of this._actors.values()) {
      actor.send(msg);
    }
  }

  /** Flush mailboxes then call update on every actor. Call once per frame. */
  update(dt: number): void {
    for (const actor of this._actors.values()) {
      actor.flush();
    }
    for (const actor of this._actors.values()) {
      if (actor.isRunning) actor.update(dt);
    }
  }

  destroy(): void {
    for (const actor of this._actors.values()) {
      actor.stop();
      actor.destroy();
    }
    this._actors.clear();
  }

  get size(): number { return this._actors.size; }
}
