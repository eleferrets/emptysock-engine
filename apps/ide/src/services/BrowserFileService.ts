/**
 * BrowserFileService — file open/save using the File System Access API.
 * Supported in Chrome 86+, Edge 86+, Safari 15.2+. Not supported in Firefox.
 * Falls back to a download-link approach for save when the API is unavailable.
 */

export interface FileResult {
  success: boolean;
  content?: string;
  path?: string;
  error?: string;
}

function hasFileSystemAccess(): boolean {
  return typeof window !== "undefined" && "showOpenFilePicker" in window;
}

export const BrowserFileService = {
  isAvailable(): boolean {
    return hasFileSystemAccess();
  },

  async openFile(): Promise<FileResult> {
    if (!hasFileSystemAccess()) {
      return {
        success: false,
        error:
          "File System Access API not supported in this browser. Use Chrome or Edge.",
      };
    }
    try {
      const handles = await window.showOpenFilePicker({
        types: [
          {
            description: "TypeScript / JavaScript",
            accept: { "text/plain": [".ts", ".js", ".json"] },
          },
        ],
        multiple: false,
      });
      const handle = handles[0];
      if (handle === undefined)
        return { success: false, error: "No file selected" };
      const file = await handle.getFile();
      const content = await file.text();
      return { success: true, content, path: file.name };
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        return { success: false, error: "Cancelled" };
      }
      return { success: false, error: String(e) };
    }
  },

  async saveFile(filename: string, content: string): Promise<FileResult> {
    if (hasFileSystemAccess()) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [
            { description: "TypeScript", accept: { "text/plain": [".ts"] } },
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(content);
        await writable.close();
        return { success: true, path: handle.name };
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") {
          return { success: false, error: "Cancelled" };
        }
        return { success: false, error: String(e) };
      }
    }

    // Fallback: trigger a browser download
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return { success: true, path: filename };
  },

  /** Download arbitrary binary content (e.g. a zip file). */
  downloadBlob(filename: string, blob: Blob): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },
};
