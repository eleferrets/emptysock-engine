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
export declare const VK_NAMES: Readonly<Record<number, string>>;
/**
 * Mirrors `gms2-codegen.ts`'s `vkMethodName(prefix, code)` exactly —
 * `${prefix}${VK_NAMES[code] ?? "Vk" + code}` — so a handler name this
 * function builds always matches the real generated export name for the
 * same vk code.
 */
export declare function vkMethodName(prefix: string, code: number): string;
/** Translates a GameMaker `vk_*`-numbered code to the DOM `KeyboardEvent.code` string `InputSystem` tracks, or `undefined` if this code has no known translation (see this module's doc comment). */
export declare function vkToDomCode(code: number): string | undefined;
/**
 * Layout-aware `vk` -> DOM `code`. Letters (vk 65-90) resolve by produced
 * character first (`ord("A")` follows the key that types "a" on the active
 * layout, e.g. `KeyQ` on AZERTY), falling back to the physical QWERTY-position
 * code when the layout has no such character (Cyrillic, Greek, unlearned).
 * Digits, symbols and named keys stay physical, exactly as `vkToDomCode`.
 * `layout` may be omitted or empty, which reproduces `vkToDomCode`.
 */
export declare function resolveVk(
  vk: number,
  layout?: Pick<KeyboardLayout, "codeForChar">,
): string | undefined;
/**
 * Every vk code `GmsProjectRuntime` polls for a per-frame up/down
 * transition — the named table above, plus the digit row, plus A-Z, plus
 * F1-F12: the realistic set of codes a real GameMaker `KeyPress_<n>.gml`/
 * `KeyRelease_<n>.gml` file actually names (confirmed by grepping a real,
 * full GameMaker project's `objects/*` directories for these files — every
 * vk code observed there falls inside this set). A vk code outside it has
 * no `vkToDomCode` translation anyway and is never polled.
 */
export declare const KNOWN_VK_CODES: readonly number[];
