/**
 * Host-side keyboard layout provider for the engine's injected
 * `KeyboardLayoutProvider` (the engine itself never touches `navigator` or
 * Tauri). Source order:
 *
 * 1. `navigator.keyboard.getLayoutMap()` (Chromium, and Tauri on Windows via
 *    WebView2), refreshed on window focus / tab visibility (and on
 *    `layoutchange` if a browser ever fires it; MDN does not document it).
 * 2. The native Tauri command `keyboard_layout_map` (macOS WKWebView and Linux
 *    WebKitGTK have no getLayoutMap), refreshed on focus / visibility too.
 * 3. Nothing: the engine falls back to learning layout from `keydown`.
 */
import type { KeyboardLayoutProvider } from "@emptysock/engine";

type CharMap = Readonly<Record<string, string>>;

/** Result shape of the Rust `keyboard_layout_map` command. */
export interface NativeLayoutResult {
  supported: boolean;
  layoutId?: string | null;
  chars: Record<string, string>;
  error?: string | null;
}

interface LayoutMapLike {
  forEach(cb: (value: string, key: string) => void): void;
}
interface KeyboardApiLike {
  getLayoutMap?: () => Promise<LayoutMapLike>;
  addEventListener?: (type: string, cb: () => void) => void;
  removeEventListener?: (type: string, cb: () => void) => void;
}
interface EventTargetLike {
  addEventListener(type: string, cb: () => void): void;
  removeEventListener(type: string, cb: () => void): void;
}

export interface LayoutProviderEnv {
  /** `navigator`, or a fake. */
  nav?: { keyboard?: KeyboardApiLike } | undefined;
  /** Calls a Tauri command, or undefined outside Tauri. */
  invoke?: (<T>(cmd: string) => Promise<T>) | undefined;
  /** `window`, for focus refresh on the native path. */
  win?: EventTargetLike | undefined;
  /** `document`, for visibilitychange on the native path. */
  doc?: EventTargetLike | undefined;
}

export interface InstalledLayoutProvider {
  readonly provider: KeyboardLayoutProvider;
  readonly source: "getLayoutMap" | "native";
  dispose(): void;
}

function sameMap(a: CharMap, b: CharMap): boolean {
  const ak = Object.keys(a);
  if (ak.length !== Object.keys(b).length) return false;
  return ak.every((k) => a[k] === b[k]);
}

async function readLayoutMap(kb: KeyboardApiLike): Promise<CharMap | null> {
  try {
    const m = await kb.getLayoutMap?.();
    if (m === undefined) return null;
    const out: Record<string, string> = {};
    m.forEach((v, k) => {
      out[k] = v;
    });
    return out;
  } catch {
    return null; // SecurityError (permissions policy) or unsupported
  }
}

async function readNative(
  invoke: <T>(cmd: string) => Promise<T>,
): Promise<CharMap | null> {
  try {
    const r = await invoke<NativeLayoutResult>("keyboard_layout_map");
    return r.supported ? r.chars : null;
  } catch {
    return null;
  }
}

/** Build a provider from whichever source is available, or `null` if none answers. */
export async function createKeyboardLayoutProvider(
  env: LayoutProviderEnv,
): Promise<InstalledLayoutProvider | null> {
  let read: (() => Promise<CharMap | null>) | null = null;
  let source: InstalledLayoutProvider["source"] = "getLayoutMap";
  let first: CharMap | null = null;
  const kb = env.nav?.keyboard;
  if (kb !== undefined && typeof kb.getLayoutMap === "function") {
    first = await readLayoutMap(kb);
    if (first !== null) read = () => readLayoutMap(kb);
  }
  if (read === null && env.invoke !== undefined) {
    const invoke = env.invoke;
    first = await readNative(invoke);
    if (first !== null) {
      read = () => readNative(invoke);
      source = "native";
    }
  }
  if (read === null || first === null) return null;

  let current: CharMap = first;
  const listeners = new Set<() => void>();
  const doRead = read;
  const refresh = async (): Promise<void> => {
    const next = await doRead();
    if (next === null || sameMap(current, next)) return;
    current = next;
    for (const cb of [...listeners]) cb();
  };
  const onEvent = (): void => {
    void refresh();
  };

  const cleanups: Array<() => void> = [];
  // `layoutchange` is not documented on MDN's Keyboard page, so it is only a
  // best-effort extra; focus and visibility refresh are the reliable path.
  if (source === "getLayoutMap" && kb?.addEventListener !== undefined) {
    kb.addEventListener("layoutchange", onEvent);
    cleanups.push(() => kb.removeEventListener?.("layoutchange", onEvent));
  }
  for (const [t, type] of [
    [env.win, "focus"],
    [env.doc, "visibilitychange"],
  ] as const) {
    t?.addEventListener(type, onEvent);
    cleanups.push(() => t?.removeEventListener(type, onEvent));
  }

  return {
    source,
    provider: {
      charForCode: (code) => current[code],
      onChange(cb) {
        listeners.add(cb);
        return () => listeners.delete(cb);
      },
    },
    dispose() {
      listeners.clear();
      for (const c of cleanups) c();
    },
  };
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

let shared: Promise<InstalledLayoutProvider | null> | null = null;

/** The IDE's single provider, built lazily from the real `navigator` / Tauri. */
export function getSharedKeyboardLayoutProvider(): Promise<InstalledLayoutProvider | null> {
  shared ??= createKeyboardLayoutProvider({
    nav: typeof navigator === "undefined" ? undefined : (navigator as never),
    invoke: isTauri()
      ? async <T>(cmd: string): Promise<T> => {
          const { invoke } = await import("@tauri-apps/api/core");
          return invoke<T>(cmd);
        }
      : undefined,
    win: typeof window === "undefined" ? undefined : window,
    doc: typeof document === "undefined" ? undefined : document,
  });
  return shared;
}

interface GameLike {
  input: { layout: { setProvider(p: KeyboardLayoutProvider | null): void } };
}
interface PlayWindowLike {
  EmptySockEngine?: { Game?: { instances?: Iterable<GameLike> } };
}

/**
 * Inject the shared provider into every `Game` the play iframe creates. The
 * iframe is same-origin, and game code is generated JS that never opts in to
 * anything IDE-specific, so (like the Live Inspector bridge) this polls the
 * `Game.instances` registry. Returns a stop function.
 */
export function bindKeyboardLayoutToIframe(
  iframe: { contentWindow: unknown },
  getProvider: () => Promise<InstalledLayoutProvider | null> = getSharedKeyboardLayoutProvider,
  intervalMs = 200,
): () => void {
  const bound = new WeakSet<object>();
  let stopped = false;
  const tick = (): void => {
    const w = iframe.contentWindow as PlayWindowLike | null;
    let games: Iterable<GameLike> | undefined;
    try {
      games = w?.EmptySockEngine?.Game?.instances;
    } catch {
      return;
    }
    if (games === undefined) return;
    for (const g of games) {
      if (bound.has(g)) continue;
      bound.add(g);
      void getProvider().then((p) => {
        if (!stopped && p !== null) g.input.layout.setProvider(p.provider);
      });
    }
  };
  const timer = setInterval(tick, intervalMs);
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
