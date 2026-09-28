import type { StorageAdapter } from "./StorageAdapter.js";
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
export declare class GmlFileSystem {
  private readonly _adapter;
  private readonly _files;
  private _nextHandle;
  private readonly _handles;
  constructor(_adapter?: StorageAdapter);
  /** Seeds a real, read-only bundled file's content — the toolchain's included-files importer's real output, embedded at build time (no async load needed for these). */
  preload(name: string, content: string): void;
  /** Pulls every previously-persisted file back into the in-memory cache. Call once before gameplay starts if cross-session save-file persistence matters. */
  hydrate(): Promise<void>;
  fileExists(name: string): boolean;
  openRead(name: string): number;
  openWrite(name: string): number;
  openAppend(name: string): number;
  readString(file: number): string;
  readReal(file: number): number;
  readln(file: number): void;
  eof(file: number): boolean;
  writeString(file: number, value: string): void;
  writeReal(file: number, value: number): void;
  writeln(file: number): void;
  close(file: number): void;
  deleteFile(name: string): void;
}
//# sourceMappingURL=GmlFileSystem.d.ts.map
