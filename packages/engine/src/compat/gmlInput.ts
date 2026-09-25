// gmlInput.ts — GameMaker keyboard/gamepad/mouse polling-function compat
// layer.
//
// Sibling to `gmlActions.ts`/`gmlCamera.ts`/`gmlParticles.ts`/
// `gmlProjection.ts` — same directory, same "engine defines the context
// shape, game code wires the live pieces" pattern. Real, confirmed a
// high-value gap: `keyboard_check`/`keyboard_check_pressed`/
// `keyboard_check_released` are GameMaker's single most common input-polling
// idiom (confirmed against Freedom Backup's own `scr_get_input.gml`, which
// reads every one of the player's controls through them), and none of them,
// nor the `vk_*` constant family, nor `gamepad_*`/`gp_*`/`mouse_check_
// button_pressed`/`mb_*` had any compat wiring anywhere in this codebase —
// every one of these was a bare, undeclared identifier at runtime.
//
// Every function here takes `(ctx: GmlInputContext, ...gmlArgs)`, the same
// context-only threading shape `gmlCamera.ts`/`gmlParticles.ts` already
// establish for room-global (not per-instance) GameMaker state — keyboard/
// gamepad/mouse state belongs to the whole game, never to one calling
// instance, so there is no `_entity` to thread here either.
//
// No DOM, Tauri, or apps/ide imports — same engine-environment-boundary
// rule as every other file under compat/. `InputManager`'s own `keyboard`/
// `gamepad(index)` escape hatches (`Input.ts`) already read a *frozen*,
// per-frame snapshot (see CLAUDE.md's "Input snapshot: frozen by copy, not
// by timing" entry) — this file adds no timing/freezing logic of its own,
// it only translates GameMaker's own vk-code/gp-constant vocabulary onto
// that existing frozen snapshot.

import type { Game } from "../Game.js";
import { vkToDomCode } from "./gmlKeys.js";
import { ViewportSystem } from "../systems/ViewportSystem.js";

/** The one thing every function in this file needs: a live `Game` to read `input` from. Keyboard/gamepad/mouse state is genuinely game-global, never per-scene, so no `scene`/`entity` field is needed here at all — unlike `GmlActionContext`. */
export interface GmlInputContext {
  readonly game?: Game;
}

// ---------------------------------------------------------------------------
// vk_* — GameMaker's keyboard virtual-key-code constants. Real, confirmed
// values against GameMaker's manual's Keyboard constants page — the exact
// same legacy `KeyboardEvent.keyCode` numbering `gmlKeys.ts`'s own
// `vkToDomCode` already translates from.
// ---------------------------------------------------------------------------
export const vk_backspace = 8;
export const vk_tab = 9;
export const vk_enter = 13;
export const vk_shift = 16;
export const vk_control = 17;
export const vk_alt = 18;
export const vk_escape = 27;
export const vk_space = 32;
export const vk_pageup = 33;
export const vk_pagedown = 34;
export const vk_end = 35;
export const vk_home = 36;
export const vk_left = 37;
export const vk_up = 38;
export const vk_right = 39;
export const vk_down = 40;
export const vk_insert = 45;
export const vk_delete = 46;
export const vk_nokey = 0;
export const vk_anykey = 1;

// ---------------------------------------------------------------------------
// gp_* — GameMaker's gamepad button/axis constants. `gp_face1`..`gp_face4`
// map onto the standard `Gamepad.buttons` layout's A/B/X/Y (indices 0-3);
// `gp_shoulderl`/`gp_shoulderr`/`gp_shoulderlb`/`gp_shoulderrb` map onto the
// standard layout's bumpers/triggers (4-7); `gp_select`/`gp_start` onto
// 8/9; `gp_stickl`/`gp_stickr` (stick-click) onto 10/11; the d-pad onto
// 12-15 — the W3C Standard Gamepad layout GameMaker's own runtime already
// targets on desktop/browser, and the same layout `GamepadSnapshot.
// isButtonDown(index)` reads by raw index. `gp_axislh`/`gp_axislv`/
// `gp_axisrh`/`gp_axisrv` map onto the standard layout's 4 analog axes
// (0-3) the same way.
// ---------------------------------------------------------------------------
export const gp_face1 = 0;
export const gp_face2 = 1;
export const gp_face3 = 2;
export const gp_face4 = 3;
export const gp_shoulderl = 4;
export const gp_shoulderr = 5;
export const gp_shoulderlb = 6;
export const gp_shoulderrb = 7;
export const gp_select = 8;
export const gp_start = 9;
export const gp_stickl = 10;
export const gp_stickr = 11;
export const gp_padu = 12;
export const gp_padd = 13;
export const gp_padl = 14;
export const gp_padr = 15;
export const gp_axislh = 0;
export const gp_axislv = 1;
export const gp_axisrh = 2;
export const gp_axisrv = 3;

// ---------------------------------------------------------------------------
// mb_* — GameMaker's mouse-button constants.
// ---------------------------------------------------------------------------
export const mb_left = 0;
export const mb_right = 1;
export const mb_middle = 2;
export const mb_none = -1;
export const mb_any = -2;

/**
 * Per-`Game`-instance previous-frame down-state, for the pressed/released
 * *edge* functions below — `InputManager`'s own frozen snapshot has no
 * `justPressed`/`justReleased` of its own (see this file's own doc comment,
 * and `GmsProjectRuntime`'s own `_prevKeyDown` field, which independently
 * needed the identical shape for its Key dispatch pass — this is a second,
 * intentionally separate instance of the same pattern, not a reuse, since
 * that one is scoped to one `GmsProjectRuntime`'s own frame loop while this
 * one has to work for *any* caller of `keyboard_check_pressed`/`_released`,
 * with or without a `GmsProjectRuntime` in the picture at all). Keyed by
 * `Game` (a `WeakMap`, so an unreferenced `Game` and its tracked state are
 * both free to be collected together) then by DOM `code` string.
 */
const prevKeyDownByGame = new WeakMap<Game, Map<string, boolean>>();
const prevGamepadButtonByGame = new WeakMap<Game, Map<string, boolean>>();
const prevMouseButtonByGame = new WeakMap<Game, Map<number, boolean>>();

function prevMapFor<K>(
  store: WeakMap<Game, Map<K, boolean>>,
  game: Game,
): Map<K, boolean> {
  let m = store.get(game);
  if (m === undefined) {
    m = new Map();
    store.set(game, m);
  }
  return m;
}

/** `keyboard_check(vk)` — true while the key is held, in the current frozen input snapshot. A `vk` code with no known DOM-`code` translation (`vkToDomCode`) honestly reads as not-down, never guessed. */
export function keyboard_check(ctx: GmlInputContext, vk: number): boolean {
  const code = vkToDomCode(vk);
  if (code === undefined || ctx.game === undefined) return false;
  return ctx.game.input.keyboard.isDown(code);
}

/** `keyboard_check_pressed(vk)` — true only on the frame the key transitions from up to down. Tracks the previous frame's state per `Game`, the same up/down-transition technique `GmsProjectRuntime`'s own Key dispatch pass uses. */
export function keyboard_check_pressed(
  ctx: GmlInputContext,
  vk: number,
): boolean {
  const code = vkToDomCode(vk);
  if (code === undefined || ctx.game === undefined) return false;
  const down = ctx.game.input.keyboard.isDown(code);
  const prev = prevMapFor(prevKeyDownByGame, ctx.game);
  const wasDown = prev.get(code) ?? false;
  prev.set(code, down);
  return down && !wasDown;
}

/** `keyboard_check_released(vk)` — true only on the frame the key transitions from down to up. */
export function keyboard_check_released(
  ctx: GmlInputContext,
  vk: number,
): boolean {
  const code = vkToDomCode(vk);
  if (code === undefined || ctx.game === undefined) return false;
  const down = ctx.game.input.keyboard.isDown(code);
  const prev = prevMapFor(prevKeyDownByGame, ctx.game);
  const wasDown = prev.get(code) ?? false;
  prev.set(code, down);
  return !down && wasDown;
}

/** `gamepad_is_connected(index)`. */
export function gamepad_is_connected(
  ctx: GmlInputContext,
  index: number,
): boolean {
  return ctx.game?.input.gamepad(index).connected ?? false;
}

/** `gamepad_button_check(index, button)` — `button` is one of the `gp_*` button constants above, read as the matching standard-layout `GamepadSnapshot.isButtonDown` index. */
export function gamepad_button_check(
  ctx: GmlInputContext,
  index: number,
  button: number,
): boolean {
  return ctx.game?.input.gamepad(index).isButtonDown(button) ?? false;
}

/** `gamepad_button_check_pressed(index, button)` — edge-triggered, the same per-`Game` previous-state tracking `keyboard_check_pressed` uses, keyed by `"<index>:<button>"`. */
export function gamepad_button_check_pressed(
  ctx: GmlInputContext,
  index: number,
  button: number,
): boolean {
  if (ctx.game === undefined) return false;
  const down = ctx.game.input.gamepad(index).isButtonDown(button);
  const key = `${index}:${button}`;
  const prev = prevMapFor(prevGamepadButtonByGame, ctx.game);
  const wasDown = prev.get(key) ?? false;
  prev.set(key, down);
  return down && !wasDown;
}

/** `gamepad_axis_value(index, axis)` — `axis` is one of the `gp_axis*` constants above, read as the matching standard-layout `GamepadSnapshot.axis` index. */
export function gamepad_axis_value(
  ctx: GmlInputContext,
  index: number,
  axis: number,
): number {
  return ctx.game?.input.gamepad(index).axis(axis) ?? 0;
}

/**
 * `gamepad_set_axis_deadzone(index, deadzone)` — a real, honest no-op.
 * `InputManager`'s frozen `GamepadSnapshot.axis()` reads the raw device
 * value with no deadzone concept anywhere in this engine (see `Input.ts`);
 * a project calling this expects the *engine* to start clamping small axis
 * values to `0` on its own, which nothing here does. Real GML source calls
 * this purely for its side effect and never inspects a return value
 * (confirmed against Freedom Backup's own `scr_get_input.gml`, which calls
 * it then immediately does its own manual `abs(...) > 0.2` deadzone check
 * in the very next line regardless) — a caller that wants an actual
 * deadzone should keep doing that manual check itself, the same honest
 * "not modelled, don't fake it" precedent `action_if_question`/`image_index`
 * already set elsewhere in this compat layer.
 */
export function gamepad_set_axis_deadzone(
  _ctx: GmlInputContext,
  _index: number,
  _deadzone: number,
): void {
  // Intentionally empty — see doc comment.
}

/**
 * `display_get_gui_width()`/`display_get_gui_height()` — GameMaker's GUI
 * layer resolution (the coordinate space `Draw GUI` events/`draw_*` calls
 * made from `onDrawGui` draw into, independent of the room's own world
 * size or the window's actual pixel size). This engine's closest matching
 * concept is `ViewportSystem`'s own `designWidth`/`designHeight` — the
 * fixed logical resolution the game is authored against, which is exactly
 * what a GML GUI layer is laid out against too (see `ViewportSystem`'s own
 * `config` doc comment) — read via `game.services.get(ViewportSystem)`,
 * one of the five `Game`-owned services CLAUDE.md's "PluginSystem,
 * VariableStore, ..." entry documents as always registered by `Game`'s own
 * constructor, so this is never `undefined` for a real live `Game`.
 */
export function display_get_gui_width(ctx: GmlInputContext): number {
  return ctx.game?.services.get(ViewportSystem).config.designWidth ?? 0;
}

/** See `display_get_gui_width`'s doc comment. */
export function display_get_gui_height(ctx: GmlInputContext): number {
  return ctx.game?.services.get(ViewportSystem).config.designHeight ?? 0;
}

/**
 * `application_surface` — GameMaker's built-in handle for the main render
 * surface the whole room draws to before any post-processing. This engine
 * has no general-purpose Surface API (no `surface_create`/`surface_set_
 * target`/arbitrary render-to-texture handles anywhere in this codebase —
 * a real, honest gap, distinct from and broader than the `PostProcessSystem`
 * layer-filter pipeline, which achieves GameMaker's most common *use* for
 * `application_surface` — full-screen shader effects — through a completely
 * different mechanism), so there is no live resource this constant can
 * meaningfully reference. It resolves to a fixed sentinel handle (`-1`, an
 * otherwise-invalid GameMaker surface id) purely so real GML source
 * *naming* it (almost always as `surface_get_width(application_surface)`/
 * `surface_get_height(application_surface)`, immediately below) doesn't hit
 * a hard `ReferenceError` — the sentinel itself carries no meaning beyond
 * "not a real surface", and any other real GameMaker surface function
 * given it is a genuinely unmodelled, honestly-still-open gap.
 */
export const application_surface = -1;

/**
 * `surface_get_width`/`surface_get_height` — real Surface API functions
 * this engine has no general implementation for (see `application_surface`'s
 * own doc comment), *except* for the one specific, extremely common real
 * case this compat layer does honestly support: called with
 * `application_surface` itself, which GameMaker sizes to the room/GUI
 * resolution by default — the same `ViewportSystem` design resolution
 * `display_get_gui_width`/`_height` above already read. Called with any
 * other (genuinely unmodelled, hand-created) surface id, this honestly
 * returns `0` rather than fabricating a plausible-looking number for a
 * surface that doesn't actually exist anywhere in this engine.
 */
export function surface_get_width(
  ctx: GmlInputContext,
  surface: number,
): number {
  return surface === application_surface ? display_get_gui_width(ctx) : 0;
}

/** See `surface_get_width`'s doc comment. */
export function surface_get_height(
  ctx: GmlInputContext,
  surface: number,
): number {
  return surface === application_surface ? display_get_gui_height(ctx) : 0;
}

/** `mouse_check_button_pressed(button)` — edge-triggered mouse-button check. Reads `InputManager.pointers`' real per-pointer `buttons` bitmask (the standard `MouseEvent.buttons` convention — bit 0 left, bit 1 right, bit 2 middle, matching `mb_left`/`mb_right`/`mb_middle`'s own 0/1/2 numbering once shifted to a bit index), `true` while any live pointer has that button held. */
export function mouse_check_button_pressed(
  ctx: GmlInputContext,
  button: number,
): boolean {
  if (ctx.game === undefined || button < 0) return false;
  const bit = 1 << button;
  const down = ctx.game.input.pointers.some((p) => (p.buttons & bit) !== 0);
  const prev = prevMapFor(prevMouseButtonByGame, ctx.game);
  const wasDown = prev.get(button) ?? false;
  prev.set(button, down);
  return down && !wasDown;
}
