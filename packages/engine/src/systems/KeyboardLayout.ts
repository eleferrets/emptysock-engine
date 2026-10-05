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

/** Codes that can carry a printable character and are worth asking a provider about. */
const PRINTABLE_CODE =
  /^(Key[A-Z]|Digit[0-9]|Backquote|Minus|Equal|Bracket(Left|Right)|Semicolon|Quote|Comma|Period|Slash|Backslash|IntlBackslash|IntlRo|IntlYen)$/;

/** Every code the engine queries a provider for (~50 printable keys). */
const PROVIDER_CODES: readonly string[] = [
  ...Array.from({ length: 26 }, (_, i) => `Key${String.fromCharCode(65 + i)}`),
  ...Array.from({ length: 10 }, (_, i) => `Digit${i}`),
  "Backquote",
  "Minus",
  "Equal",
  "BracketLeft",
  "BracketRight",
  "Semicolon",
  "Quote",
  "Comma",
  "Period",
  "Slash",
  "Backslash",
  "IntlBackslash",
  "IntlRo",
  "IntlYen",
];

/** True for exactly one Unicode code point. */
function isSingleCodePoint(s: string): boolean {
  if (s.length === 0 || s.length > 2) return false;
  const cp = s.codePointAt(0);
  return cp !== undefined && s.length === (cp > 0xffff ? 2 : 1);
}

function sanitizeChar(raw: unknown): string | undefined {
  if (typeof raw !== "string" || !isSingleCodePoint(raw)) return undefined;
  const lower = raw.toLowerCase();
  return isSingleCodePoint(lower) ? lower : undefined;
}

/** True if `ch` is a single Unicode letter (the only chars the engine matches by produced character). */
export function isLetterChar(ch: string): boolean {
  return isSingleCodePoint(ch) && /^\p{L}$/u.test(ch);
}

const DEFAULT_NAMED_LABELS: Readonly<Record<string, string>> = {
  Space: "Space",
  Enter: "Enter",
  NumpadEnter: "Num Enter",
  Escape: "Esc",
  Backspace: "Backspace",
  Tab: "Tab",
  ArrowLeft: "Left",
  ArrowRight: "Right",
  ArrowUp: "Up",
  ArrowDown: "Down",
  ShiftLeft: "Shift",
  ShiftRight: "Right Shift",
  ControlLeft: "Ctrl",
  ControlRight: "Right Ctrl",
  AltLeft: "Alt",
  AltRight: "Right Alt",
  MetaLeft: "Meta",
  MetaRight: "Right Meta",
  CapsLock: "Caps Lock",
  PageUp: "Page Up",
  PageDown: "Page Down",
  Backquote: "`",
  Minus: "-",
  Equal: "=",
  BracketLeft: "[",
  BracketRight: "]",
  Semicolon: ";",
  Quote: "'",
  Comma: ",",
  Period: ".",
  Slash: "/",
  Backslash: "\\",
};

/** Layout-independent fallback label for a physical code. */
export function defaultKeyLabel(code: string): string {
  const named = DEFAULT_NAMED_LABELS[code];
  if (named !== undefined) return named;
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  if (/^Numpad[0-9]$/.test(code)) return `Num ${code.slice(6)}`;
  return code;
}

export class KeyboardLayout {
  private _provider: KeyboardLayoutProvider | null = null;
  private _unsubscribe: (() => void) | null = null;
  /** code -> char, snapshotted from the provider. Authoritative. */
  private readonly _providerChars = new Map<string, string>();
  /** code -> char, learned from clean keydown events. Latest observation wins. */
  private readonly _learned = new Map<string, string>();
  /** char -> code, rebuilt on any table change. */
  private readonly _charToCode = new Map<string, string>();
  private _version = 0;

  /** Bumps on every table change (provider set, provider change, new or changed learned key). */
  get version(): number {
    return this._version;
  }

  /** Install (or with `null`, remove) the host provider. Its answers are snapshotted immediately and again on every `onChange`. */
  setProvider(p: KeyboardLayoutProvider | null): void {
    if (this._unsubscribe !== null) {
      try {
        this._unsubscribe();
      } catch {
        /* a throwing unsubscribe must not break re-injection */
      }
      this._unsubscribe = null;
    }
    this._provider = p;
    this._refreshProvider();
    if (p?.onChange !== undefined) {
      try {
        this._unsubscribe = p.onChange(() => this._refreshProvider());
      } catch {
        this._unsubscribe = null;
      }
    }
  }

  private _refreshProvider(): void {
    this._providerChars.clear();
    const p = this._provider;
    if (p !== null) {
      for (const code of PROVIDER_CODES) {
        let raw: string | undefined;
        try {
          raw = p.charForCode(code);
        } catch {
          continue;
        }
        const ch = sanitizeChar(raw);
        if (ch !== undefined) this._providerChars.set(code, ch);
      }
    }
    this._rebuild();
  }

  /**
   * Learning fallback: record that physical `code` typed `key`. The caller
   * (`InputSystem`) has already dropped composing/dead/modified/shifted
   * events; this re-checks the parts that are cheap to check from data alone.
   */
  learn(code: string, key: string): void {
    if (!PRINTABLE_CODE.test(code)) return;
    const ch = sanitizeChar(key);
    if (ch === undefined) return; // "Dead", "Process", "Unidentified", multi-char
    if (this._learned.get(code) === ch) return;
    this._learned.set(code, ch);
    // Latest observation wins: a stale entry for the same char elsewhere is dropped.
    for (const [c, v] of this._learned) {
      if (c !== code && v === ch) this._learned.delete(c);
    }
    this._rebuild();
  }

  private _rebuild(): void {
    this._charToCode.clear();
    for (const [code, ch] of this._providerChars) {
      if (!this._charToCode.has(ch)) this._charToCode.set(ch, code);
    }
    for (const [code, ch] of this._learned) {
      // A code the provider answers for is never overridden by learning.
      if (this._providerChars.has(code)) continue;
      if (!this._charToCode.has(ch)) this._charToCode.set(ch, code);
    }
    this._version++;
  }

  /** Unshifted lowercase char typed by `code` (provider first, then learned), or undefined. */
  charForCode(code: string): string | undefined {
    return this._providerChars.get(code) ?? this._learned.get(code);
  }

  /** Physical code that types `ch` on the active layout, or undefined. */
  codeForChar(ch: string): string | undefined {
    return this._charToCode.get(ch.toLowerCase());
  }

  /** UI label. Precedence: provider.labelForCode, provider char uppercased, learned char uppercased, default label. */
  label(code: string): string {
    const p = this._provider;
    if (p?.labelForCode !== undefined) {
      try {
        const l = p.labelForCode(code);
        if (typeof l === "string" && l.length > 0) return l;
      } catch {
        /* fall through */
      }
    }
    const ch = this.charForCode(code);
    if (ch !== undefined) return ch.toUpperCase();
    return defaultKeyLabel(code);
  }
}
