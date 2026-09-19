export interface TransportMessage {
  readonly actorId: string;
  readonly msg: Record<string, unknown>;
}
export interface Transport {
  /** Send a message payload to a remote actor by id. */
  send(actorId: string, msg: Record<string, unknown>): void;
  /** Register the handler that receives incoming messages from the network. */
  onReceive(handler: (payload: TransportMessage) => void): void;
  /** Open the connection (WebSocket handshake, WebRTC negotiation, etc.). */
  connect(): Promise<void>;
  /** Close the connection and release resources. */
  disconnect(): void;
}
