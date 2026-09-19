import type { Actor } from "./Actor.js";
import type { Message } from "./Actor.js";
/**
 * Manages a registry of Actors. Wire this into your game loop:
 *
 *   const actors = new ActorSystem();
 *   actors.register(myActor);
 *   // in update:
 *   actors.update(dt);
 */
export declare class ActorSystem {
  private readonly _actors;
  register(actor: Actor): void;
  unregister(id: string): void;
  get(id: string): Actor | undefined;
  /** Send a message to a specific actor by id. No-op if the id is unknown. */
  send(actorId: string, msg: Message): void;
  /** Broadcast a message to every registered actor. */
  broadcast(msg: Message): void;
  /** Flush mailboxes then call update on every actor. Call once per frame. */
  update(dt: number): void;
  destroy(): void;
  get size(): number;
}
