# 02 - Layout-correct keyboard input

Status: research, read-only pass. Question: make `keyboard_check(ord("A"))` and action bindings layout-correct, with a host-injected label provider and a "capture next input" rebind helper. Paths are relative to `packages/engine/src/`.

Web facts below come from prior knowledge of MDN/caniuse/Chromium status, not re-fetched this pass (web tools were not loaded). Re-verify the three "VERIFY" items before committing to step 4.

## 1. Current state (file:line)

| Concern | Where |
|---|---|
| Keys stored by `KeyboardEvent.code` only. `_keys: Map<string, boolean>`; `keydown`/`keyup` set `(e as KeyboardEvent).code`. `e.key` is never read. | `systems/InputSystem.ts:4,81-86` |
| Attach/detach (default target `window`); only host bootstrap calls it. | `InputSystem.ts:19-31`, `Input.ts:196-206`, `docs/decisions/input-and-audio.md` |
| Headless injection by code string: `simulateKeyDown(code)`/`simulateKeyUp(code)`. | `InputSystem.ts:70-76`, `Input.ts:~440` |
| Frozen per-frame copy `snapshotKeys()` (`new Map`) into `_frozen.keys`. | `InputSystem.ts:59-61`, `Input.ts:339-340` |
| Raw hatch `input.keyboard.isDown(code)` reads `_frozen.keys`. | `Input.ts:36-39,385-389` |
| Action bindings: `Binding = {kind:"key", code}` (a physical code). `_isBindingActive` reads `_frozen.keys.get(b.code)`. | `Input.ts:19-32,~446-450` |
| Rebind API: `setActions/bindAction/rebind/addBinding/unbind/resetToDefaults/saveBindings/loadBindings`. Persist JSON of `ActionMap` (codes) via `StorageAdapter`. No capture helper. | `Input.ts:215-300` |
| vk to code table. GML `vk_*` is legacy keyCode numbering; letters 65-90 map to `Key<L>`, digits 48-57 to `Digit<n>`, F1-F12, named keys. Shift/Ctrl/Alt resolve left-only (documented gap). | `compat/gmlKeys.ts:42-100` (`vkToDomCode`) |
| `keyboard_check`, `_pressed`, `_released` call `vkToDomCode` then `keyboard.isDown(code)`. Edges tracked per `Game` in `prevKeyDownByGame`. Unknown vk reads false. | `compat/gmlInput.ts:122,138-170` |
| `ord(str)` = char code, so `ord("A")` = 65 = `vk` for letter A. Duplicated in two files. | `compat/gml.ts:115`, `compat/gmlInput.ts` |
| Key event dispatch (KeyPress/KeyRelease objects) polls every `KNOWN_VK_CODES` through `vkToDomCode`. | `GmsRuntime.ts:18,507-508` |
| Not present: `keyboard_lastkey`, `keyboard_lastchar`, `keyboard_string`, any `e.key`, any layout logic, any label API. |  |
| Existing tests: `__tests__/InputSystem.test.ts`, `input.test.ts`, `gmlInput.test.ts`. |  |

Consequence today: on AZERTY the physical key at QWERTY-A position is code `KeyQ`. A GML game doing `keyboard_check(ord("A"))` polls `KeyA`, i.e. the key that types "Q" on AZERTY. WASD games are physically comfortable on QWERTY only. Bindings persisted as codes are physical, which is right for movement but wrong for label display.

## 2. Platform facts

`KeyboardEvent.code`: physical key position, layout-independent, named by US-QWERTY position (`KeyQ`, `Digit1`, `BracketLeft`). Stable across layouts; not localized. Best for "movement cluster" semantics.

`KeyboardEvent.key`: value produced under the active layout, modifiers (Shift/AltGr/CapsLock), and dead-key state. Examples: `"a"`, `"A"`, `"é"`, `"Enter"`, `"Dead"`, `"Process"` (IME), `"Unidentified"`. Not stable enough to key state on (Shift changes it between keydown and keyup, which would strand a "held" entry). So: store state by `code`, use `key` only to learn a mapping.

`navigator.keyboard.getLayoutMap()` (Keyboard Map API): resolves to a `KeyboardLayoutMap` (`Map<code, string>`) of the unshifted character for printable keys under the current layout. Non-printable keys absent. Chromium 69+ (Chrome/Edge/Opera); Firefox and Safari do not implement it (caniuse "Keyboard API": no). Needs a secure context and the `keyboard-map` permissions-policy in iframes. Change notification via `navigator.keyboard` `layoutchange` event (Chromium; VERIFY current status, it has been experimental). Returns Cyrillic/Greek characters on those layouts, so the map answers "what does this key type", not "what Latin letter".

Tauri webview engines: Windows = WebView2 (Chromium): getLayoutMap available. macOS = WKWebView (Safari engine): not available. Linux = WebKitGTK: not available. So two of three shipping targets need the `event.key` learning fallback; treat getLayoutMap as an optimisation, not a dependency. VERIFY the Tauri secure-context origin (`tauri://localhost` / `https://tauri.localhost`) counts as secure on WebView2 before relying on it.

Dead keys: keydown `key === "Dead"`, `code` still correct. Never learn from these. IME: keydown during composition has `isComposing === true` / `key === "Process"` / legacy `keyCode 229`; `code` may be unreliable across IMEs. Ignore for learning and for game state while composing (game canvas rarely has an IME active, but a text field overlay does). Modifier layers: AltGr yields `key` of the third layer (and reports Ctrl+Alt on Windows); Shift yields uppercase/symbols. Learn only from events with no Ctrl/Alt/Meta and normalise with `toLowerCase()`. Shift-held learning is fine after lowercase, except for layouts where Shift changes the letter (Turkish dotted/dotless i: `"I".toLowerCase()` is wrong under default locale; use `toLocaleLowerCase("en-US")` or only learn when `!e.shiftKey`, which is simpler and chosen here).

Non-Latin layouts (Cyrillic, Greek, Arabic, Hebrew, Thai): no key produces Latin "A" unless the user toggles to a Latin layout. Most such users keep a Latin layout for games or the OS keeps ASCII-capable input; but if not, `ord("A")` must fall back to the physical `KeyA`. This is also what the Steam/Unity/Godot "physical vs logical" split does; Godot defaults to physical for actions for this reason.

Gamepad: entirely separate (`GamepadSystem`, `Binding.kind` gamepadButton/gamepadAxis). Unaffected by any of this; no changes to `Input.ts` gamepad paths.

## 3. Design

Principle: state stays keyed by physical `code`. Layout awareness is a translation layer between "what the game asks for" and "which code(s) to read". No per-frame cost beyond a Map lookup; resolved table is rebuilt only on layout change or new learned key.

### 3.1 Interfaces (engine, no DOM)

New file `systems/KeyboardLayout.ts`:

```ts
/** Host-injected. Engine never touches navigator. */
export interface KeyboardLayoutProvider {
  /** Unshifted printable char produced by physical `code` on the active layout, or undefined (unknown / non-printable). Lowercase. */
  charForCode(code: string): string | undefined;
  /** Optional: subscribe to layout changes (layoutchange). Returns unsubscribe. */
  onChange?(cb: () => void): () => void;
  /** Optional: human label for UI ("A", "Q", "Space", "Ф"). Falls back to engine defaults. */
  labelForCode?(code: string): string | undefined;
}

export class KeyboardLayout {
  setProvider(p: KeyboardLayoutProvider | null): void;
  /** Feed from InputSystem keydown (learning fallback). Ignores dead/composing/modified/shifted events. */
  learn(code: string, key: string): void;
  /** Resolve a produced character to the physical code(s) that type it, or undefined. */
  codeForChar(ch: string): string | undefined;
  /** Label for UI. Precedence: provider.labelForCode, provider.charForCode uppercased, learned key, defaultLabel(code). */
  label(code: string): string;
  readonly version: number; // bumps on any table change
}
```

`InputSystem` gains a `KeyboardLayout` instance (`input.layout`), and `_onKeyDown` additionally calls `layout.learn(e.code, e.key)` guarded by `!e.isComposing && !e.repeat-irrelevant && !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey && e.key.length === 1`. State write is unchanged (`_keys.set(e.code, true)`). `simulateKeyDown(code, key?)` gains an optional second arg so headless tests can simulate a learned layout without a DOM.

Host contract (bootstrap, not engine), in the browser shell / Tauri entry:

```ts
const kb = (navigator as any).keyboard;
if (kb?.getLayoutMap) {
  let map = await kb.getLayoutMap();
  const listeners = new Set<() => void>();
  kb.addEventListener?.("layoutchange", async () => { map = await kb.getLayoutMap(); listeners.forEach(f => f()); });
  game.input.layout.setProvider({
    charForCode: (c) => map.get(c)?.toLowerCase(),
    onChange: (cb) => (listeners.add(cb), () => listeners.delete(cb)),
  });
}
// else: no provider; engine falls back to event.key learning.
```

Contract rules: synchronous, pure, cheap; must return lowercase single code point or `undefined`; engine snapshots the whole answer into its resolved table on `setProvider` and on `onChange` (so provider is queried for the ~50 printable codes, not per frame).

### 3.2 Matching algorithm for GML letters/digits

Only `vk` 65-90 (A-Z) and optionally 48-57 (digits) get layout treatment; named keys (arrows, space, F-keys) stay physical, exactly as today.

```
resolveVk(vk):                       // memoised per (vk, layout.version)
  ch = String.fromCharCode(vk).toLowerCase()
  produced = layout.codeForChar(ch)  // e.g. "a" -> "KeyQ" on AZERTY
  return produced ?? vkToDomCode(vk) // Cyrillic / unknown: physical fallback
```

`keyboard_check*` and `GmsRuntime.ts:507` loop call `resolveVk` instead of `vkToDomCode`. Edge tracking (`prevKeyDownByGame`) stays keyed by resolved code, so a mid-frame layout change yields at most one spurious edge; acceptable.

Conflict case (AZERTY, "Q" and "A" swap): `ord("A")` -> `KeyQ`, `ord("Q")` -> `KeyA`; both resolve uniquely because `codeForChar` is a bijection over printable keys. If two codes produce the same char (rare, e.g. numpad digits are separate codes and excluded: only learn/accept codes matching `^(Key[A-Z]|Digit[0-9]|Backquote|Minus|Equal|Bracket|Semicolon|Quote|Comma|Period|Slash|Backslash|IntlBackslash)`), first-registered wins, provider (authoritative) over learned.

Digits: default is produced-character for GML parity? GameMaker itself uses keyCode, which for the top row on AZERTY (needs Shift for digits) reports... unverified. Decision: digits stay physical (`Digit1`) in step 3; make them opt-in via `setVkResolution({digits:"produced"})`. Ask owner.

### 3.3 Precedence: code vs key

1. Explicit physical binding wins: `Binding {kind:"key", code}` is always physical. Existing saved bindings keep working, no migration.
2. New `Binding {kind:"key", code, char?: string}`: when `char` is present it means "the key that types this char"; resolved with `codeForChar(char) ?? code` (the stored `code` is the physical fallback, captured at rebind time). `sameBinding` compares `code` and `char`.
3. GML `vk` letters: produced-char first, physical fallback (3.2).
4. GML named/other vk: physical only.
5. Snapshots and `KeyboardSnapshot.isDown(code)` remain physical; add `KeyboardSnapshot.isCharDown(ch)`.
6. Default for action maps authored by games: physical (WASD stays a cluster). Rebind helper (below) records both, and UI shows the label.

### 3.4 Rebind / capture helper

On `InputManager`:

```ts
interface CaptureOptions {
  kinds?: ("key" | "gamepadButton" | "gamepadAxis")[]; // default all
  timeoutMs?: number;                                   // default none
  cancelCodes?: string[];                               // default ["Escape"]
  mode?: "physical" | "char";                           // default "physical"
  signal?: AbortSignal;
}
interface CaptureResult { binding: Binding; label: string; }

captureNext(opts?: CaptureOptions): Promise<CaptureResult | null>; // null = cancelled/timeout
bindingLabel(b: Binding): string;                                  // uses layout.label / "Pad A" / "Axis 1+"
```

Semantics: `captureNext` arms on the next `snapshot()`, ignores inputs already held at arm time (requires release first), resolves on the first new keydown edge (or gamepad button edge / axis crossing threshold), swallows that press so it does not also trigger the game action (marks the code as suppressed until release; `isDown` for that code reads false while suppressed). Modifiers alone (Shift/Ctrl/Alt/Meta) are not accepted unless `allowModifiers`. In `mode:"char"` produces `{kind:"key", code, char}` when layout knows the char, else code only. It runs from frozen snapshots so it is fully headless-testable with `simulateKeyDown`. Convenience: `rebindByCapture(action, opts)` = capture then `rebind(action, [binding])` (or `addBinding`).

Gamepad note: capture includes gamepad edges so one helper serves both; layout code is not involved for those.

## 4. Tests (headless, Vitest, no DOM)

- `KeyboardLayout.test.ts`: provider table gives `KeyQ -> "a"`; `codeForChar("a") === "KeyQ"`; provider absent falls back to learned; learn ignores shift/ctrl/alt/meta, `Dead`, `Process`, `isComposing`, multi-char keys; provider wins over learned; `version` bumps on change; onChange rebuild.
- `gmlInput.test.ts` additions: with fake AZERTY provider, `simulateKeyDown("KeyQ")` makes `keyboard_check(ord("A"))` true and `ord("Q")` false; Cyrillic provider (`KeyA -> "ф"`, no Latin) makes `ord("A")` fall back to `KeyA`; named keys unchanged; pressed/released edges correct across a `layoutchange`; no provider = current behaviour (regression guard).
- `InputSystem.test.ts`: `_onKeyDown` with synthetic plain objects passed to a fake `EventTarget` (a minimal `{addEventListener}` stub, no jsdom) to verify learn guards and that state is still keyed by code and keyup after Shift press releases correctly.
- `input.test.ts`: `captureNext` resolves with first new key; ignores held-at-arm; swallows the press (action not triggered); Escape cancels to `null`; timeout; gamepad button and axis capture; `mode:"char"` yields `char`; `saveBindings/loadBindings` round-trip with `char`, and old saves (no `char`) load.
- Gamepad regression: existing gamepad tests unchanged and green.
- Manual, real browser/Tauri (not automatable headless): WebView2 getLayoutMap path, WKWebView and WebKitGTK learning path, layout switch mid-session.

## 5. Sweep steps (ordered, each independently committable)

| # | Step | Files owned |
|---|---|---|
| 1 | `KeyboardLayout` class + provider interface + default label table (pure, unit-tested). Export from index. | new `systems/KeyboardLayout.ts`, new `__tests__/KeyboardLayout.test.ts`, `index.ts` |
| 2 | Wire into `InputSystem`: `layout` instance, guarded `learn` in `_onKeyDown`, `simulateKeyDown(code, key?)`. State semantics unchanged. | `systems/InputSystem.ts`, `__tests__/InputSystem.test.ts` |
| 3 | `resolveVk` in `gmlKeys.ts` (takes a layout) and use it in `keyboard_check*` and the `GmsRuntime` key loop. Letters only. | `compat/gmlKeys.ts`, `compat/gmlInput.ts`, `GmsRuntime.ts:507`, `__tests__/gmlInput.test.ts` |
| 4 | Host provider: Chromium `getLayoutMap` adapter + `layoutchange`, in the browser preview shell and Tauri entry (not engine). VERIFY items 2.x first. | shell/Tauri bootstrap files (outside `packages/engine`; locate before starting) |
| 5 | `Binding.char`, `sameBinding`, `_isBindingActive` resolution, `KeyboardSnapshot.isCharDown`, `bindingLabel`. Backward compatible persistence. | `Input.ts`, `__tests__/input.test.ts` |
| 6 | `captureNext` / `rebindByCapture` incl. suppression and gamepad edges. | `Input.ts`, `__tests__/input.test.ts` |
| 7 | Docs pass (deferred per follow-up item 12: docs are being redone; only touch when that reopens): `docs/guides/input-and-gamepad.md`, `docs/reference/systems/input-bindings.md`, decision note in `docs/decisions/input-and-audio.md`. | docs (blocked) |

Steps 1-3 alone fix AZERTY GML behaviour on every engine (via learning) with zero host changes, except that a key must have been pressed once before it is learned. That is the main weakness of the fallback (see risks); step 4 closes it on WebView2/Chromium only.

## 6. Risks and open questions

1. Cold-start on WKWebView/WebKitGTK: no layout map until the player has pressed each key, so `keyboard_check(ord("A"))` falls back to `KeyA` until `KeyQ` is pressed at least once on AZERTY. First press of an unlearned key on the "wrong" position is briefly misread. Mitigations: preload common layouts by inferring from `navigator.language`/OS API in the Tauri host (Rust side can query the active layout natively: Windows `GetKeyboardLayout`, macOS TIS, Linux xkb) and feed it through the same provider interface. Recommended follow-up, keeps the engine contract unchanged.
2. Mid-game layout switch: Chromium fires `layoutchange`; others do not. Learned entries can go stale (a code learned as "a" then layout changes). Mitigation: latest observation overwrites, and codes are re-learned on every clean keydown, so staleness self-heals on next press.
3. Ambiguity with physical intent: some games want QWERTY-position WASD regardless of layout (the default here, since action bindings stay physical). Applying produced-char matching to GML `ord()` letters is a behaviour change for AZERTY players of ported games that were authored physically; that is the requested direction (GameMaker's own keyCode semantics are produced-char-like on Windows) but confirm against a real project on an AZERTY machine.
4. Edge state churn on layout change (one spurious pressed/released). Acceptable, documented.
5. IME/`isComposing` and `code` reliability under composition: game state should probably ignore key events while a DOM text field has focus; out of scope here but should be noted in the host shell.
6. Modifier keys stay left-only (`vk_shift` etc.); fixing that is orthogonal (accept either side) and could ride along in step 3.
7. Persistence compatibility: adding `char` to `Binding` requires old saves (no `char`) to keep loading; `loadBindings` currently only checks parseability, so add a shape guard.
8. `ord` is duplicated (`gml.ts:115`, `gmlInput.ts`); non-ASCII `ord("é")` will not hit the letter path (vk > 90) and is unsupported. Also `keyboard_lastchar`/`keyboard_string` are absent; if later added they should use `event.key`, not the layout map.
9. Two-copy tables: `VK_NAMES` is hand-synced with the toolchain codegen; layout work must not change `vk` numbering there.
10. Provider throwing or returning multi-char strings (e.g. dead-key composed) must be sanitised in `setProvider` (accept only a single code point).
