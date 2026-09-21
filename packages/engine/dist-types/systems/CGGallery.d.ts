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
export declare class CGGallery {
  private _entries;
  private _unlocked;
  private _saveSystem;
  private _saveSlot;
  constructor(opts: CGGalleryOptions);
  /** Load unlocked flags from the save system */
  load(): void;
  /** Mark a CG as unlocked and persist */
  unlock(id: string): void;
  isUnlocked(id: string): boolean;
  get entries(): ReadonlyArray<CGEntry>;
  get unlockedEntries(): CGEntry[];
  get totalCount(): number;
  get unlockedCount(): number;
  private _persist;
}
