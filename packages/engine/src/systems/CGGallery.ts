import type { SaveSystem } from "./SaveSystem.js";

export interface CGEntry {
  id: string;
  imagePath: string;
  title?: string;
  /** Save slot key used to persist the unlocked flag. Defaults to `cg_${id}` */
  saveKey?: string;
}

export interface CGGalleryOptions {
  entries: CGEntry[];
  saveSystem?: SaveSystem;
  /** Save slot name for gallery flags. Defaults to 'cg_gallery' */
  saveSlot?: string;
}

export class CGGallery {
  private _entries: CGEntry[];
  private _unlocked: Set<string> = new Set();
  private _saveSystem: SaveSystem | null;
  private _saveSlot: string;

  constructor(opts: CGGalleryOptions) {
    this._entries = opts.entries;
    this._saveSystem = opts.saveSystem ?? null;
    this._saveSlot = opts.saveSlot ?? "cg_gallery";
  }

  /** Load unlocked flags from the save system */
  load(): void {
    if (!this._saveSystem) return;
    const slot = this._saveSystem.load(this._saveSlot);
    if (!slot) return;
    const raw: unknown = slot.data;
    if (typeof raw !== "object" || raw === null) return;
    for (const [key, val] of Object.entries(raw)) {
      if (val === true) this._unlocked.add(key);
    }
  }

  /** Mark a CG as unlocked and persist */
  unlock(id: string): void {
    if (this._unlocked.has(id)) return;
    this._unlocked.add(id);
    this._persist();
  }

  isUnlocked(id: string): boolean {
    return this._unlocked.has(id);
  }

  get entries(): ReadonlyArray<CGEntry> {
    return this._entries;
  }

  get unlockedEntries(): CGEntry[] {
    return this._entries.filter((e) => this._unlocked.has(e.id));
  }

  get totalCount(): number {
    return this._entries.length;
  }

  get unlockedCount(): number {
    return this._unlocked.size;
  }

  private _persist(): void {
    if (!this._saveSystem) return;
    const data: Record<string, boolean> = {};
    for (const id of this._unlocked) data[id] = true;
    this._saveSystem.save(this._saveSlot, {
      scene: "",
      data,
      timestamp: Date.now(),
      playtime: 0,
    });
  }
}
