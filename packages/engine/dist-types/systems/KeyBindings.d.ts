import { type StorageAdapter } from "./StorageAdapter.js";
export interface KeyboardSource {
  readonly keyboard: {
    isDown(code: string): boolean;
  };
}
export declare const KEY_BINDINGS_STORAGE_KEY = "settings/keybindings";
export declare class KeyBindings {
  private readonly _input;
  private readonly _storage;
  private readonly _storageKey;
  constructor(
    _input: KeyboardSource,
    _storage?: StorageAdapter,
    _storageKey?: string,
  );
  bind(action: string, ...codes: string[]): void;
  unbind(action: string, ...codes: string[]): void;
  rebind(action: string, ...codes: string[]): void;
  getBindings(action: string): readonly string[];
  isActionDown(action: string): boolean;
  update(): void;
  wasActionPressed(action: string): boolean;
  wasActionReleased(action: string): boolean;
  save(): Promise<void>;
  load(): Promise<boolean>;
}
