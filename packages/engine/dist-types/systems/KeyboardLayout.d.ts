/**
 * Layout awareness for keyboard input. Pure data and logic: no DOM, no
 * `navigator`, no Tauri. The host injects a `KeyboardLayoutProvider` (from
 * `navigator.keyboard.getLayoutMap()` on Chromium/WebView2, or from a native
 * OS query on macOS/Linux Tauri), and `InputSystem` feeds `learn()` from
 * real `keydown` events as a fallback.
 *
 * Key state elsewhere stays keyed by physical `KeyboardEvent.code`. This
 * class only answers "which physical code types this character?" so letter
 * lookups (`ord("A")`, `Binding.char`) can follow the active layout.
 */
/** Host-injected layout source. Must be synchronous, pure and cheap. */
export interface KeyboardLayoutProvider {
  /** Unshifted printable char produced by physical `code`, or undefined (unknown / non-printable). Single code point; lowercased by the engine. */
  charForCode(code: string): string | undefined;
  /** Optional: subscribe to layout changes. Returns unsubscribe. */
  onChange?(cb: () => void): () => void;
  /** Optional: human label for UI ("A", "Q", "Space", "Ф"). */
  labelForCode?(code: string): string | undefined;
}
/** True if `ch` is a single Unicode letter (the only chars the engine matches by produced character). */
export declare function isLetterChar(ch: string): boolean;
/** Layout-independent fallback label for a physical code. */
export declare function defaultKeyLabel(code: string): string;
export declare class KeyboardLayout {
  private _provider;
  private _unsubscribe;
  /** code -> char, snapshotted from the provider. Authoritative. */
  private readonly _providerChars;
  /** code -> char, learned from clean keydown events. Latest observation wins. */
  private readonly _learned;
  /** char -> code, rebuilt on any table change. */
  private readonly _charToCode;
  private _version;
  /** Bumps on every table change (provider set, provider change, new or changed learned key). */
  get version(): number;
  /** Install (or with `null`, remove) the host provider. Its answers are snapshotted immediately and again on every `onChange`. */
  setProvider(p: KeyboardLayoutProvider | null): void;
  private _refreshProvider;
  /**
   * Learning fallback: record that physical `code` typed `key`. The caller
   * (`InputSystem`) has already dropped composing/dead/modified/shifted
   * events; this re-checks the parts that are cheap to check from data alone.
   */
  learn(code: string, key: string): void;
  private _rebuild;
  /** Unshifted lowercase char typed by `code` (provider first, then learned), or undefined. */
  charForCode(code: string): string | undefined;
  /** Physical code that types `ch` on the active layout, or undefined. */
  codeForChar(ch: string): string | undefined;
  /** UI label. Precedence: provider.labelForCode, provider char uppercased, learned char uppercased, default label. */
  label(code: string): string;
}
