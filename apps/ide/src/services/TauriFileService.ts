/**
 * TauriFileService — thin wrapper over Tauri invoke calls for file I/O.
 * Degrades gracefully when running in a plain browser (no Tauri runtime).
 */

export interface FileResult {
  success: boolean;
  content?: string;
  path?: string;
  error?: string;
}

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(cmd, args);
}

export const TauriFileService = {
  isAvailable(): boolean {
    return isTauri();
  },

  async openFile(): Promise<FileResult> {
    if (!isTauri()) {
      return { success: false, error: 'File system access requires the desktop app.' };
    }
    return tauriInvoke<FileResult>('open_file');
  },

  async saveFile(path: string | null, content: string): Promise<FileResult> {
    if (!isTauri()) {
      return { success: false, error: 'File system access requires the desktop app.' };
    }
    return tauriInvoke<FileResult>('save_file', { path, content });
  },
};
