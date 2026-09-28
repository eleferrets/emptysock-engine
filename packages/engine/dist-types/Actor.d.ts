export type ActorId = string;
export interface Message {
  readonly type: string;
  readonly [key: string]: unknown;
}
export declare abstract class Actor {
  readonly id: ActorId;
  private readonly _inbox;
  private _running;
  constructor(id: ActorId);
  /** Enqueue a message in this actor's mailbox. Drops the message with a warning if the inbox exceeds the limit. */
  send(msg: Message): void;
  /** Drain the mailbox and dispatch each message. Called by ActorSystem each frame. */
  flush(): void;
  /** Override to handle incoming messages. */
  abstract receive(msg: Message): void;
  /** Override to add per-frame logic (dt in seconds). */
  update(_dt: number): void;
  /** Override to clean up listeners and resources. */
  destroy(): void;
  get isRunning(): boolean;
  /** Number of messages currently queued, not yet drained by `flush()`. Read by `QueryChannel`'s `actorInboxSize` query. */
  get inboxSize(): number;
  /** Called by ActorSystem.register(). */
  start(): void;
  /** Called by ActorSystem.unregister(). */
  stop(): void;
  protected onStart(): void;
  protected onStop(): void;
}
//# sourceMappingURL=Actor.d.ts.map
