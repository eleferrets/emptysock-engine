import { describe, expect, it, vi } from "vitest";
import {
  bindKeyboardLayoutToIframe,
  createKeyboardLayoutProvider,
  type NativeLayoutResult,
} from "../services/keyboardLayoutProvider";

function layoutMap(o: Record<string, string>) {
  return {
    forEach: (cb: (v: string, k: string) => void) =>
      Object.entries(o).forEach(([k, v]) => cb(v, k)),
  };
}
function fakeTarget() {
  const l = new Map<string, Set<() => void>>();
  return {
    addEventListener: (t: string, cb: () => void) =>
      void (l.get(t) ?? l.set(t, new Set()).get(t)!).add(cb),
    removeEventListener: (t: string, cb: () => void) =>
      void l.get(t)?.delete(cb),
    fire: (t: string) => l.get(t)?.forEach((cb) => cb()),
    count: (t: string) => l.get(t)?.size ?? 0,
  };
}
const flush = () => new Promise((r) => setTimeout(r, 0));

describe("createKeyboardLayoutProvider", () => {
  it("uses getLayoutMap and follows layoutchange", async () => {
    let map: Record<string, string> = { KeyQ: "a" };
    const kb = {
      ...fakeTarget(),
      getLayoutMap: () => Promise.resolve(layoutMap(map)),
    };
    const r = await createKeyboardLayoutProvider({ nav: { keyboard: kb } });
    expect(r?.source).toBe("getLayoutMap");
    expect(r?.provider.charForCode("KeyQ")).toBe("a");
    const cb = vi.fn();
    r?.provider.onChange?.(cb);
    map = { KeyA: "a" };
    kb.fire("layoutchange");
    await flush();
    expect(cb).toHaveBeenCalledTimes(1);
    expect(r?.provider.charForCode("KeyA")).toBe("a");
    expect(r?.provider.charForCode("KeyQ")).toBeUndefined();
    r?.dispose();
    expect(kb.count("layoutchange")).toBe(0);
  });

  it("falls through to the native command when getLayoutMap rejects or is missing", async () => {
    const native: NativeLayoutResult = {
      supported: true,
      chars: { KeyQ: "a" },
    };
    const invoke = vi.fn(() => Promise.resolve(native)) as never;
    const rejecting = {
      getLayoutMap: () => Promise.reject(new Error("SecurityError")),
    };
    for (const nav of [undefined, { keyboard: {} }, { keyboard: rejecting }]) {
      const r = await createKeyboardLayoutProvider({ nav, invoke });
      expect(r?.source).toBe("native");
      expect(r?.provider.charForCode("KeyQ")).toBe("a");
    }
  });

  it("native path refreshes on focus and only notifies on a real change", async () => {
    let chars: Record<string, string> = { KeyQ: "a" };
    const invoke = (() => Promise.resolve({ supported: true, chars })) as never;
    const win = fakeTarget();
    const doc = fakeTarget();
    const r = await createKeyboardLayoutProvider({ invoke, win, doc });
    const cb = vi.fn();
    r?.provider.onChange?.(cb);
    win.fire("focus");
    await flush();
    expect(cb).not.toHaveBeenCalled();
    chars = { KeyA: "a" };
    doc.fire("visibilitychange");
    await flush();
    expect(cb).toHaveBeenCalledTimes(1);
    r?.dispose();
    expect(win.count("focus")).toBe(0);
  });

  it("returns null when nothing answers (unsupported native, no keyboard API)", async () => {
    expect(await createKeyboardLayoutProvider({})).toBeNull();
    const invoke = (() =>
      Promise.resolve({ supported: false, chars: {} })) as never;
    expect(await createKeyboardLayoutProvider({ invoke })).toBeNull();
    const boom = (() => Promise.reject(new Error("no command"))) as never;
    expect(await createKeyboardLayoutProvider({ invoke: boom })).toBeNull();
  });
});

describe("bindKeyboardLayoutToIframe", () => {
  it("injects once into each Game the iframe creates, and stops on dispose", async () => {
    vi.useFakeTimers();
    const setProvider = vi.fn();
    const game = { input: { layout: { setProvider } } };
    const instances = new Set<typeof game>();
    const iframe = {
      contentWindow: { EmptySockEngine: { Game: { instances } } },
    };
    const provider = { charForCode: () => undefined };
    const getProvider = () =>
      Promise.resolve({
        provider,
        source: "native" as const,
        dispose() {},
      });
    const stop = bindKeyboardLayoutToIframe(iframe, getProvider, 50);
    vi.advanceTimersByTime(100);
    expect(setProvider).not.toHaveBeenCalled();
    instances.add(game);
    await vi.advanceTimersByTimeAsync(200);
    expect(setProvider).toHaveBeenCalledTimes(1);
    expect(setProvider).toHaveBeenCalledWith(provider);
    stop();
    instances.add({ input: { layout: { setProvider } } });
    await vi.advanceTimersByTimeAsync(200);
    expect(setProvider).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
