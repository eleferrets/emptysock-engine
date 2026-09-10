// AssetStore — real file I/O for the Asset Browser.
// Browser implementation uses File System Access API rooted at a user-picked directory.
// Tauri implementation uses the fs plugin.
// Falls back to in-memory store when no directory is open.

import type { AssetItem } from "../store/ideStore";

export interface FileStore {
  list(): Promise<AssetItem[]>;
  read(path: string): Promise<Blob>;
  write(name: string, blob: Blob): Promise<AssetItem>;
  delete(path: string): Promise<void>;
  hasRoot(): boolean;
}

function mimeToType(mime: string): AssetItem["type"] {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.includes("font")) return "font";
  if (mime === "application/json") return "json";
  return "script";
}

function extToType(name: string): AssetItem["type"] {
  const ext = name.slice(name.lastIndexOf(".") + 1).toLowerCase();
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext))
    return "image";
  if (["ogg", "mp3", "wav", "flac"].includes(ext)) return "audio";
  if (["ttf", "otf", "woff", "woff2"].includes(ext)) return "font";
  if (ext === "json") return "json";
  return "script";
}

class BrowserFileStore implements FileStore {
  private _root: FileSystemDirectoryHandle | null = null;

  setRoot(handle: FileSystemDirectoryHandle): void {
    this._root = handle;
  }

  hasRoot(): boolean {
    return this._root !== null;
  }

  async list(): Promise<AssetItem[]> {
    if (this._root === null) return [];
    const entries: AssetItem[] = [];
    for await (const [name, handle] of this._root.entries()) {
      if (handle.kind !== "file") continue;
      const file = await (handle as FileSystemFileHandle).getFile();
      entries.push({
        id: name,
        name,
        path: name,
        type:
          mimeToType(file.type) === "script"
            ? extToType(name)
            : mimeToType(file.type),
        size: file.size,
      });
    }
    return entries.sort((a, b) => a.name.localeCompare(b.name));
  }

  async read(path: string): Promise<Blob> {
    if (this._root === null) throw new Error("No asset directory open");
    const handle = await this._root.getFileHandle(path);
    return handle.getFile();
  }

  async write(name: string, blob: Blob): Promise<AssetItem> {
    if (this._root === null) throw new Error("No asset directory open");
    const handle = await this._root.getFileHandle(name, { create: true });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    const type =
      mimeToType(blob.type) === "script"
        ? extToType(name)
        : mimeToType(blob.type);
    return { id: name, name, path: name, type, size: blob.size };
  }

  async delete(path: string): Promise<void> {
    if (this._root === null) throw new Error("No asset directory open");
    await this._root.removeEntry(path);
  }
}

class MemoryFileStore implements FileStore {
  private readonly _entries = new Map<
    string,
    { blob: Blob; item: AssetItem }
  >();

  hasRoot(): boolean {
    return true;
  }

  async list(): Promise<AssetItem[]> {
    return [...this._entries.values()].map((v) => v.item);
  }

  async read(path: string): Promise<Blob> {
    const v = this._entries.get(path);
    if (v === undefined) throw new Error(`Asset not found: ${path}`);
    return v.blob;
  }

  async write(name: string, blob: Blob): Promise<AssetItem> {
    const type =
      mimeToType(blob.type) === "script"
        ? extToType(name)
        : mimeToType(blob.type);
    const item: AssetItem = {
      id: name,
      name,
      path: name,
      type,
      size: blob.size,
    };
    this._entries.set(name, { blob, item });
    return item;
  }

  async delete(path: string): Promise<void> {
    this._entries.delete(path);
  }
}

export const browserAssetStore = new BrowserFileStore();
export const memoryAssetStore = new MemoryFileStore();

export function getAssetStore(): FileStore {
  // In browser mode, prefer browserAssetStore if a directory is open.
  // Otherwise fall back to in-memory.
  if (typeof window !== "undefined" && !("__TAURI_INTERNALS__" in window)) {
    return browserAssetStore.hasRoot() ? browserAssetStore : memoryAssetStore;
  }
  // Tauri: placeholder — TauriFileStore would use the fs plugin
  return memoryAssetStore;
}
