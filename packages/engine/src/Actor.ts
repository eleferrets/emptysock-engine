export type ActorId = string;

export interface Message {
  readonly type: string;
  readonly [key: string]: unknown;
}

/**
 * Base class for the Actor Model. Each actor owns a private mailbox;
 * no actor may read another's fields directly — all interaction is via send().
 *
 * A networked variant, if one is ever needed, belongs in `@emptysock/network`
 * — the engine's own `core/NetworkActor.ts`/`Transport.ts` were deleted
 * as a second, unused networking primitive
 * alongside the real one in that package.
 */
const INBOX_LIMIT = 1000;

export abstract class Actor {
  readonly id: ActorId;
  private readonly _inbox: Message[] = [];
  private _running = false;

  constructor(id: ActorId) {
    this.id = id;
  }

  /** Enqueue a message in this actor's mailbox. Drops the message with a warning if the inbox exceeds the limit. */
  send(msg: Message): void {
    if (this._inbox.length >= INBOX_LIMIT) {
      console.warn(
        `[Actor:${this.id}] inbox overflow — dropping message type "${msg.type}"`,
      );
      return;
    }
    this._inbox.push(msg);
  }

  /** Drain the mailbox and dispatch each message. Called by ActorSystem each frame. */
  flush(): void {
    const batch = this._inbox.splice(0);
    for (const msg of batch) {
      try {
        this.receive(msg);
      } catch (e) {
        console.error(
          `[Actor:${this.id}] receive() threw on type "${msg.type}":`,
          e,
        );
      }
    }
  }

  /** Override to handle incoming messages. */
  abstract receive(msg: Message): void;

  /** Override to add per-frame logic (dt in seconds). */
  update(_dt: number): void {}

  /** Override to clean up listeners and resources. */
  destroy(): void {}

  get isRunning(): boolean {
    return this._running;
  }

  /** Number of messages currently queued, not yet drained by `flush()`. Read by `QueryChannel`'s `actorInboxSize` query. */
  get inboxSize(): number {
    return this._inbox.length;
  }

  /** Called by ActorSystem.register(). */
  start(): void {
    this._running = true;
    this.onStart();
  }

  /** Called by ActorSystem.unregister(). */
  stop(): void {
    this._running = false;
    this.onStop();
  }

  protected onStart(): void {}
  protected onStop(): void {}
}
