import type { StorageAdapter } from "./StorageAdapter.js";
import { MemoryStorageAdapter } from "./StorageAdapter.js";

/**
 * Real, handle-based virtual file system for GameMaker's `file_text_*`
 * family (`compat/gmlFileText.ts`) — the mechanism real GML source uses for
 * both read-only bundled data (GameMaker's "Included Files"/`datafiles`,
 * imported by `gms2-includedfiles-import.ts`) and the game's own save
 * files (`file_text_open_write(working_directory + "save.dat")`, a real,
 * confirmed, load-bearing pattern — see this class's own module doc for
 * real examples). GML's file API is synchronous (`file_text_read_string`
 * returns a value immediately, no `await`), so this class keeps every
 * file's full text content in memory, not behind an async read per call.
 *
 * Reuses `StorageAdapter` (the exact interface `SaveSystem` already
 * defines and depends on — "engine defines the interface, whoever has a
 * live instance wires the concrete backend") for cross-session
 * persistence, rather than inventing a second storage boundary. A write is
 * applied to the in-memory cache immediately (so a later read in the same
 * session sees it, even before any async persistence completes) and
 * mirrored to the adapter in the background. `hydrate()` is the
 * complementary read side — call it once, before gameplay starts, to pull
 * any previously-persisted files back into the in-memory cache so a save
 * file survives a restart. Without a real adapter (the default:
 * `MemoryStorageAdapter`), this is session-only — correct behaviour under
 * the headless test harness and any host that hasn't wired real storage
 * yet, the same "sane in-process default" `SaveSystem` already documents
 * for its own adapter.
 */
export class GmlFileSystem {
  private readonly _files = new Map<string, string>();
  private _nextHandle = 1;
  private readonly _handles = new Map<
    number,
    {
      readonly mode: "read" | "write" | "append";
      readonly name: string;
      lines: string[];
      pos: number;
      buffer: string[];
    }
  >();

  constructor(
    private readonly _adapter: StorageAdapter = new MemoryStorageAdapter(),
  ) {}

  /** Seeds a real, read-only bundled file's content — the toolchain's included-files importer's real output, embedded at build time (no async load needed for these). */
  preload(name: string, content: string): void {
    this._files.set(name, content);
  }

  /** Pulls every previously-persisted file back into the in-memory cache. Call once before gameplay starts if cross-session save-file persistence matters. */
  async hydrate(): Promise<void> {
    const keys = await this._adapter.listKeys("gmlfile:");
    for (const key of keys) {
      const value = await this._adapter.get(key);
      if (value !== null) this._files.set(key.slice("gmlfile:".length), value);
    }
  }

  fileExists(name: string): boolean {
    return this._files.has(name);
  }

  openRead(name: string): number {
    const content = this._files.get(name);
    if (content === undefined) return -1;
    const handle = this._nextHandle++;
    this._handles.set(handle, {
      mode: "read",
      name,
      lines: content.split(/\r\n|\r|\n/),
      pos: 0,
      buffer: [],
    });
    return handle;
  }

  openWrite(name: string): number {
    const handle = this._nextHandle++;
    this._handles.set(handle, {
      mode: "write",
      name,
      lines: [],
      pos: 0,
      buffer: [],
    });
    return handle;
  }

  openAppend(name: string): number {
    const existing = this._files.get(name);
    const handle = this._nextHandle++;
    this._handles.set(handle, {
      mode: "append",
      name,
      lines: [],
      pos: 0,
      buffer: existing !== undefined ? [existing] : [],
    });
    return handle;
  }

  readString(file: number): string {
    const h = this._handles.get(file);
    if (h === undefined || h.mode !== "read") return "";
    return h.lines[h.pos] ?? "";
  }

  readReal(file: number): number {
    const n = Number(this.readString(file));
    return Number.isFinite(n) ? n : 0;
  }

  readln(file: number): void {
    const h = this._handles.get(file);
    if (h !== undefined) h.pos += 1;
  }

  eof(file: number): boolean {
    const h = this._handles.get(file);
    if (h === undefined || h.mode !== "read") return true;
    return h.pos >= h.lines.length;
  }

  writeString(file: number, value: string): void {
    const h = this._handles.get(file);
    if (h !== undefined && h.mode !== "read") h.buffer.push(value);
  }

  writeReal(file: number, value: number): void {
    this.writeString(file, String(value));
  }

  writeln(file: number): void {
    this.writeString(file, "\n");
  }

  close(file: number): void {
    const h = this._handles.get(file);
    if (h === undefined) return;
    if (h.mode !== "read") {
      const content = h.buffer.join("");
      this._files.set(h.name, content);
      void this._adapter.set(`gmlfile:${h.name}`, content);
    }
    this._handles.delete(file);
  }

  deleteFile(name: string): void {
    this._files.delete(name);
    void this._adapter.delete(`gmlfile:${name}`);
  }
}
