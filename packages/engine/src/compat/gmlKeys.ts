/**
 * GameMaker virtual-key-code naming and DOM-`code` translation, shared
 * between `GmlBehaviorSystem`'s KeyPress/KeyRelease dispatch and — by
 * separate, independent implementation — `packages/toolchain/src/
 * gms2-codegen.ts`'s `vkNames`/`vkMethodName`. The engine package cannot
 * import from `@emptysock/toolchain` (that's an offline-codegen CLI
 * package, not a runtime dependency of `@emptysock/engine` — the same
 * "engine depends on the interface, never the concrete tool that produced
 * the data" boundary `StorageAdapter`/`TileLayerSource` already draw), so
 * `VK_NAMES` here is a second, hand-kept-in-sync copy of the exact same
 * table `gms2-codegen.ts` uses to name `onKeyPress<Name>`/`onKeyRelease<Name>`
 * exports. If GameMaker's own key naming there ever changes, this table
 * must change with it — the two are two implementations of the same rule
 * that must agree, the same caveat CLAUDE.md's `GmlCollision.ts` entry
 * already raises for object-type resolution being shared between two call
 * sites.
 */

import type { KeyboardLayout } from "../systems/KeyboardLayout.js";
export const VK_NAMES: Readonly<Record<number, string>> = {
  8: "Backspace",
  13: "Enter",
  16: "Shift",
  17: "Control",
  27: "Escape",
  32: "Space",
  37: "Left",
  38: "Up",
  39: "Right",
  40: "Down",
};

/**
 * Mirrors `gms2-codegen.ts`'s `vkMethodName(prefix, code)` exactly —
 * `${prefix}${VK_NAMES[code] ?? "Vk" + code}` — so a handler name this
 * function builds always matches the real generated export name for the
 * same vk code.
 */
export function vkMethodName(prefix: string, code: number): string {
  const label = VK_NAMES[code] ?? `Vk${code}`;
  return `${prefix}${label}`;
}

/**
 * GameMaker's `vk_*` constants reuse the legacy DOM `KeyboardEvent.keyCode`
 * numbering (confirmed against GameMaker's manual's Keyboard constants
 * page — `vk_left`/`vk_up`/`vk_right`/`vk_down` = 37/38/39/40,
 * `vk_space` = 32, `vk_enter` = 13, `vk_escape` = 27, `vk_backspace` = 8,
 * `vk_shift`/`vk_control` = 16/17, `vk_tab` = 9, `vk_alt` = 18, the digit
 * row = 48-57, A-Z = 65-90 and F1-F12 = 112-123 — the same numbering
 * legacy `KeyboardEvent.keyCode` used). `InputSystem`/`InputManager` key
 * every held key by the real DOM `KeyboardEvent.code` string instead (a
 * distinct, non-numeric identifier — `"ArrowLeft"`, `"KeyA"`, `"Digit1"`),
 * so a numeric vk code has to be translated to the matching `code` string
 * before it can be checked against `input.keyboard.isDown(...)`. This is a
 * best-effort table for the vk codes real GameMaker keyboard events
 * actually use in practice (arrows, space, enter, escape, backspace,
 * shift, control, tab, alt, digits, letters, function keys) — a vk code
 * outside this table has no known `code` translation and is honestly
 * skipped (never guessed), the same "surface as unresolved, don't fake it"
 * rule this codebase's GML compat layer applies elsewhere. `Shift`/
 * `Control`/`Alt` resolve to the left-hand variant (`"ShiftLeft"`, ...) for
 * identity, e.g. as a previous-state key; `isVkDown` is what reads them, and
 * it accepts either side, as GameMaker's own `vk_shift`/`vk_control`/`vk_alt`
 * do not distinguish left from right.
 */
const NAMED_VK_DOM_CODES: Readonly<Record<number, string>> = {
  8: "Backspace",
  9: "Tab",
  13: "Enter",
  16: "ShiftLeft",
  17: "ControlLeft",
  18: "AltLeft",
  27: "Escape",
  32: "Space",
  33: "PageUp",
  34: "PageDown",
  35: "End",
  36: "Home",
  37: "ArrowLeft",
  38: "ArrowUp",
  39: "ArrowRight",
  40: "ArrowDown",
  45: "Insert",
  46: "Delete",
};

/** Translates a GameMaker `vk_*`-numbered code to the DOM `KeyboardEvent.code` string `InputSystem` tracks, or `undefined` if this code has no known translation (see this module's doc comment). */
export function vkToDomCode(code: number): string | undefined {
  const named = NAMED_VK_DOM_CODES[code];
  if (named !== undefined) return named;
  if (code >= 48 && code <= 57) return `Digit${code - 48}`;
  if (code >= 65 && code <= 90) return `Key${String.fromCharCode(code)}`;
  if (code >= 112 && code <= 123) return `F${code - 111}`;
  return undefined;
}

const MODIFIER_SIDES: Readonly<Record<number, readonly [string, string]>> = {
  16: ["ShiftLeft", "ShiftRight"],
  17: ["ControlLeft", "ControlRight"],
  18: ["AltLeft", "AltRight"],
};

/** `true` while the key for `vk` is held; `vk_shift`/`vk_control`/`vk_alt` accept either side. */
export function isVkDown(
  keyboard: { isDown(code: string): boolean },
  vk: number,
  layout?: Pick<KeyboardLayout, "codeForChar">,
): boolean {
  const sides = MODIFIER_SIDES[vk];
  if (sides !== undefined) return sides.some((code) => keyboard.isDown(code));
  const code = resolveVk(vk, layout);
  return code !== undefined && keyboard.isDown(code);
}

const LETTER_CHARS: readonly string[] = Array.from({ length: 26 }, (_, i) =>
  String.fromCharCode(97 + i),
);

/**
 * Layout-aware `vk` -> DOM `code`. Letters (vk 65-90) resolve by produced
 * character first (`ord("A")` follows the key that types "a" on the active
 * layout, e.g. `KeyQ` on AZERTY), falling back to the physical QWERTY-position
 * code when the layout has no such character (Cyrillic, Greek, unlearned).
 * Digits, symbols and named keys stay physical, exactly as `vkToDomCode`.
 * `layout` may be omitted or empty, which reproduces `vkToDomCode`.
 */
export function resolveVk(
  vk: number,
  layout?: Pick<KeyboardLayout, "codeForChar">,
): string | undefined {
  if (layout !== undefined && vk >= 65 && vk <= 90) {
    const produced = layout.codeForChar(LETTER_CHARS[vk - 65] as string);
    if (produced !== undefined) return produced;
  }
  return vkToDomCode(vk);
}

/**
 * Every vk code `GmsProjectRuntime` polls for a per-frame up/down
 * transition — the named table above, plus the digit row, plus A-Z, plus
 * F1-F12: the realistic set of codes a real GameMaker `KeyPress_<n>.gml`/
 * `KeyRelease_<n>.gml` file actually names (confirmed by grepping a real,
 * full GameMaker project's `objects/*` directories for these files — every
 * vk code observed there falls inside this set). A vk code outside it has
 * no `vkToDomCode` translation anyway and is never polled.
 */
export const KNOWN_VK_CODES: readonly number[] = [
  ...Object.keys(NAMED_VK_DOM_CODES).map(Number),
  ...Array.from({ length: 10 }, (_, i) => 48 + i),
  ...Array.from({ length: 26 }, (_, i) => 65 + i),
  ...Array.from({ length: 12 }, (_, i) => 112 + i),
];
