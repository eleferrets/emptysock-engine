import { Actor } from "./Actor.js";
import type { Message } from "./Actor.js";
import type { Transport } from "./Transport.js";
/**
 * Opt-in base class for actors that participate in real-time networking.
 * Attach a Transport (WebSocket, WebRTC, etc.) before calling start().
 *
 * Messages arriving from the network are forwarded into the local mailbox
 * exactly as if they were sent locally — so receive() handles both cases.
 */
export declare abstract class NetworkActor extends Actor {
  protected _transport: Transport | null;
  setTransport(transport: Transport): void;
  /** Send a message to a remote peer's actor. */
  protected sendRemote(targetActorId: string, msg: Message): void;
  destroy(): void;
}
