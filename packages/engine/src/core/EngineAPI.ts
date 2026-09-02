type ErrorHandler = (msg: string) => void;

const _errorHandlers: ErrorHandler[] = [];
let _fileLogHandler: ErrorHandler | null = null;

export const Engine = {
  /** Register a callback invoked whenever Engine.logError is called. */
  onError(handler: ErrorHandler): void {
    _errorHandlers.push(handler);
  },

  /**
   * Register a callback that receives the message when logErrorToFile is called.
   * Wire this up in the IDE/Tauri layer; game code and the engine core must not
   * import Tauri APIs directly.
   */
  onFileLog(handler: ErrorHandler): void {
    _fileLogHandler = handler;
  },

  /** Log a runtime error to registered handlers and the console. */
  logError(msg: string): void {
    console.error('[Engine]', msg);
    for (const h of _errorHandlers) h(msg);
  },

  /** Log a debug-level message without triggering error handlers. */
  logDebugError(msg: string): void {
    console.debug('[Engine]', msg);
  },

  /** Delegate to the file-log handler registered by the host layer. No-op if not set. */
  logErrorToFile(msg: string): void {
    _fileLogHandler?.(msg);
  },
};
