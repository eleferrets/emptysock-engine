import { Actor } from './Actor.js';
import type { Message } from './Actor.js';
import type { Transport } from './Transport.js';

/**
 * Opt-in base class for actors that participate in real-time networking.
 * Attach a Transport (WebSocket, WebRTC, etc.) before calling start().
 *
 * Messages arriving from the network are forwarded into the local mailbox
 * exactly as if they were sent locally — so receive() handles both cases.
 */
export abstract class NetworkActor extends Actor {
  protected _transport: Transport | null = null;

  setTransport(transport: Transport): void {
    this._transport = transport;
    transport.onReceive(({ actorId, msg }) => {
      if (actorId === this.id) {
        this.send(msg as Message);
      }
    });
  }

  /** Send a message to a remote peer's actor. */
  protected sendRemote(targetActorId: string, msg: Message): void {
    if (this._transport === null) {
      console.warn(`[NetworkActor:${this.id}] No transport attached — message dropped.`);
      return;
    }
    this._transport.send(targetActorId, msg as Record<string, unknown>);
  }

  override destroy(): void {
    this._transport?.disconnect();
    super.destroy();
  }
}
