type ErrorHandler = (msg: string) => void;

const _errorHandlers: ErrorHandler[] = [];

export const Engine = {
  /** Register a callback invoked whenever Engine.logError is called. */
  onError(handler: ErrorHandler): void {
    _errorHandlers.push(handler);
  },

  /** Log a runtime error to registered handlers and the console. */
  logError(msg: string): void {
    console.error('[Engine]', msg);
    for (const h of _errorHandlers) h(msg);
  },

  /** Log a debug-level error without triggering error handlers. */
  logDebugError(msg: string): void {
    console.debug('[Engine]', msg);
  },

  /**
   * In the desktop app this writes to the project log file.
   * In-browser it is a no-op stub.
   */
  logErrorToFile(msg: string): void {
    if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
      // Fire-and-forget Tauri command; import is dynamic to keep web bundle clean.
      void import('@tauri-apps/api/core').then(({ invoke }) =>
        invoke('log_error', { message: msg }).catch(() => undefined)
      );
    }
  },
};
