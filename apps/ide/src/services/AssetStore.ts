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

function extToMime(name: string): string {
  const ext = name.slice(name.lastIndexOf(".") + 1).toLowerCase();
  const mimeMap: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    ogg: "audio/ogg",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    flac: "audio/flac",
    ttf: "font/ttf",
    otf: "font/otf",
    woff: "font/woff",
    woff2: "font/woff2",
    json: "application/json",
  };
  return mimeMap[ext] ?? "application/octet-stream";
}

class TauriFileStore implements FileStore {
  private _root: string | null = null;

  setRoot(path: string): void {
    this._root = path;
  }

  hasRoot(): boolean {
    return this._root !== null;
  }

  async list(): Promise<AssetItem[]> {
    if (this._root === null)
      throw new Error("TauriFileStore: no root directory set");
    const { readDir } = await import("@tauri-apps/plugin-fs");
    const entries = await readDir(this._root);
    const items: AssetItem[] = entries
      .filter((e) => e.isFile)
      .map((e) => ({
        id: e.name,
        name: e.name,
        path: e.name,
        type: extToType(e.name),
      }));
    return items.sort((a, b) => a.name.localeCompare(b.name));
  }

  async read(path: string): Promise<Blob> {
    if (this._root === null)
      throw new Error("TauriFileStore: no root directory set");
    const { readFile } = await import("@tauri-apps/plugin-fs");
    const { join } = await import("@tauri-apps/api/path");
    const fullPath = await join(this._root, path);
    const bytes = await readFile(fullPath);
    return new Blob([bytes], { type: extToMime(path) });
  }

  async write(name: string, blob: Blob): Promise<AssetItem> {
    if (this._root === null)
      throw new Error("TauriFileStore: no root directory set");
    const { writeFile } = await import("@tauri-apps/plugin-fs");
    const { join } = await import("@tauri-apps/api/path");
    const fullPath = await join(this._root, name);
    const buffer = await blob.arrayBuffer();
    await writeFile(fullPath, new Uint8Array(buffer));
    const type =
      mimeToType(blob.type) === "script"
        ? extToType(name)
        : mimeToType(blob.type);
    return { id: name, name, path: name, type, size: blob.size };
  }

  async delete(path: string): Promise<void> {
    if (this._root === null)
      throw new Error("TauriFileStore: no root directory set");
    const { remove } = await import("@tauri-apps/plugin-fs");
    const { join } = await import("@tauri-apps/api/path");
    const fullPath = await join(this._root, path);
    await remove(fullPath);
  }
}

export const browserAssetStore = new BrowserFileStore();
export const memoryAssetStore = new MemoryFileStore();
export const tauriAssetStore = new TauriFileStore();

export function getAssetStore(): FileStore {
  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    return tauriAssetStore.hasRoot() ? tauriAssetStore : memoryAssetStore;
  }
  return browserAssetStore.hasRoot() ? browserAssetStore : memoryAssetStore;
}
