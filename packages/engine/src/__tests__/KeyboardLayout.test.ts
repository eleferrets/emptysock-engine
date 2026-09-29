import { describe, expect, it } from "vitest";
import {
  KeyboardLayout,
  defaultKeyLabel,
  isLetterChar,
  type KeyboardLayoutProvider,
} from "../systems/KeyboardLayout.js";

/** Fake provider over a plain code->char table, with a manual change trigger. */
export function fakeProvider(
  table: Record<string, string>,
): KeyboardLayoutProvider & {
  set(t: Record<string, string>): void;
  fire(): void;
  subs: number;
} {
  let t = table;
  const cbs = new Set<() => void>();
  const p = {
    subs: 0,
    charForCode: (c: string) => t[c],
    onChange(cb: () => void) {
      cbs.add(cb);
      p.subs = cbs.size;
      return () => {
        cbs.delete(cb);
        p.subs = cbs.size;
      };
    },
    set(n: Record<string, string>) {
      t = n;
    },
    fire() {
      for (const cb of [...cbs]) cb();
    },
  };
  return p;
}

const AZERTY = {
  KeyQ: "a",
  KeyA: "q",
  KeyW: "z",
  KeyZ: "w",
  Semicolon: "m",
  KeyM: ",",
  Digit1: "&",
};

describe("KeyboardLayout", () => {
  it("resolves both directions from a provider (AZERTY)", () => {
    const l = new KeyboardLayout();
    l.setProvider(fakeProvider(AZERTY));
    expect(l.charForCode("KeyQ")).toBe("a");
    expect(l.codeForChar("a")).toBe("KeyQ");
    expect(l.codeForChar("q")).toBe("KeyA");
    expect(l.codeForChar("m")).toBe("Semicolon");
    expect(l.codeForChar("A")).toBe("KeyQ");
  });

  it("QWERTZ swaps y and z; Dvorak moves punctuation letters", () => {
    const l = new KeyboardLayout();
    l.setProvider(fakeProvider({ KeyY: "z", KeyZ: "y" }));
    expect(l.codeForChar("z")).toBe("KeyY");
    l.setProvider(
      fakeProvider({ KeyS: "o", KeyD: "e", Quote: "q", Comma: "w" }),
    );
    expect(l.codeForChar("o")).toBe("KeyS");
    expect(l.codeForChar("q")).toBe("Quote");
    expect(l.codeForChar("y")).toBeUndefined();
  });

  it("no provider: nothing known until learned", () => {
    const l = new KeyboardLayout();
    expect(l.codeForChar("a")).toBeUndefined();
    l.learn("KeyQ", "a");
    expect(l.codeForChar("a")).toBe("KeyQ");
  });

  it("learn ignores dead, IME, multi-char, non-printable codes", () => {
    const l = new KeyboardLayout();
    l.learn("KeyE", "Dead");
    l.learn("KeyE", "Process");
    l.learn("KeyE", "Unidentified");
    l.learn("KeyE", "ab");
    l.learn("Enter", "x");
    l.learn("Numpad1", "1");
    expect(l.version).toBe(0);
    expect(l.charForCode("KeyE")).toBeUndefined();
  });

  it("learn lowercases and the latest observation wins (stale entry dropped)", () => {
    const l = new KeyboardLayout();
    l.learn("KeyQ", "A");
    expect(l.codeForChar("a")).toBe("KeyQ");
    l.learn("KeyA", "a"); // layout changed, a moved
    expect(l.codeForChar("a")).toBe("KeyA");
    expect(l.charForCode("KeyQ")).toBeUndefined();
  });

  it("provider wins over learned, for the same code and for the same char", () => {
    const l = new KeyboardLayout();
    l.setProvider(fakeProvider({ KeyQ: "a" }));
    l.learn("KeyQ", "x");
    expect(l.charForCode("KeyQ")).toBe("a");
    l.learn("KeyZ", "a");
    expect(l.codeForChar("a")).toBe("KeyQ");
  });

  it("version bumps on set, change, learn; onChange rebuilds and re-subscribes cleanly", () => {
    const l = new KeyboardLayout();
    const p1 = fakeProvider({ KeyQ: "a" });
    const v0 = l.version;
    l.setProvider(p1);
    expect(l.version).toBeGreaterThan(v0);
    const v1 = l.version;
    p1.set({ KeyA: "a" });
    p1.fire();
    expect(l.version).toBeGreaterThan(v1);
    expect(l.codeForChar("a")).toBe("KeyA");
    const p2 = fakeProvider({});
    l.setProvider(p2);
    expect(p1.subs).toBe(0);
    expect(p2.subs).toBe(1);
    l.setProvider(null);
    expect(p2.subs).toBe(0);
  });

  it("sanitises a misbehaving provider", () => {
    const l = new KeyboardLayout();
    l.setProvider({
      charForCode: (c) => {
        if (c === "KeyA") throw new Error("boom");
        if (c === "KeyB") return "bb";
        if (c === "KeyC") return "";
        if (c === "KeyD") return "D";
        if (c === "KeyE") return "\u{1F600}";
        return undefined;
      },
      onChange: () => {
        throw new Error("nope");
      },
    });
    expect(l.charForCode("KeyA")).toBeUndefined();
    expect(l.charForCode("KeyB")).toBeUndefined();
    expect(l.charForCode("KeyC")).toBeUndefined();
    expect(l.charForCode("KeyD")).toBe("d");
    expect(l.charForCode("KeyE")).toBe("\u{1F600}");
  });

  it("label precedence: provider label, provider char, learned, default", () => {
    const l = new KeyboardLayout();
    expect(l.label("KeyA")).toBe("A");
    expect(l.label("Space")).toBe("Space");
    l.learn("KeyQ", "a");
    expect(l.label("KeyQ")).toBe("A");
    l.setProvider({
      charForCode: (c) => (c === "KeyA" ? "ф" : undefined),
      labelForCode: (c) => (c === "KeyB" ? "Bee" : undefined),
    });
    expect(l.label("KeyA")).toBe("Ф");
    expect(l.label("KeyB")).toBe("Bee");
    expect(defaultKeyLabel("ArrowLeft")).toBe("Left");
  });

  it("isLetterChar is true only for a single letter", () => {
    expect(isLetterChar("a")).toBe(true);
    expect(isLetterChar("ф")).toBe(true);
    expect(isLetterChar("1")).toBe(false);
    expect(isLetterChar("&")).toBe(false);
    expect(isLetterChar("ab")).toBe(false);
  });
});
