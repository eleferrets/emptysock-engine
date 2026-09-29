import type { Game } from "../Game.js";
/** The one thing every function in this file needs: a live `Game` to read `input` from. Keyboard/gamepad/mouse state is genuinely game-global, never per-scene, so no `scene`/`entity` field is needed here at all — unlike `GmlActionContext`. */
export interface GmlInputContext {
  readonly game?: Game;
}
export declare const vk_backspace = 8;
export declare const vk_tab = 9;
export declare const vk_enter = 13;
export declare const vk_shift = 16;
export declare const vk_control = 17;
export declare const vk_alt = 18;
export declare const vk_escape = 27;
export declare const vk_space = 32;
export declare const vk_pageup = 33;
export declare const vk_pagedown = 34;
export declare const vk_end = 35;
export declare const vk_home = 36;
export declare const vk_left = 37;
export declare const vk_up = 38;
export declare const vk_right = 39;
export declare const vk_down = 40;
export declare const vk_insert = 45;
export declare const vk_delete = 46;
export declare const vk_nokey = 0;
export declare const vk_anykey = 1;
export declare const gp_face1 = 0;
export declare const gp_face2 = 1;
export declare const gp_face3 = 2;
export declare const gp_face4 = 3;
export declare const gp_shoulderl = 4;
export declare const gp_shoulderr = 5;
export declare const gp_shoulderlb = 6;
export declare const gp_shoulderrb = 7;
export declare const gp_select = 8;
export declare const gp_start = 9;
export declare const gp_stickl = 10;
export declare const gp_stickr = 11;
export declare const gp_padu = 12;
export declare const gp_padd = 13;
export declare const gp_padl = 14;
export declare const gp_padr = 15;
export declare const gp_axislh = 0;
export declare const gp_axislv = 1;
export declare const gp_axisrh = 2;
export declare const gp_axisrv = 3;
export declare const mb_left = 0;
export declare const mb_right = 1;
export declare const mb_middle = 2;
export declare const mb_none = -1;
export declare const mb_any = -2;
/** `keyboard_check(vk)` — true while the key is held, in the current frozen input snapshot. A `vk` code with no known DOM-`code` translation (`vkToDomCode`) honestly reads as not-down, never guessed. */
export declare function keyboard_check(
  ctx: GmlInputContext,
  vk: number,
): boolean;
/** `keyboard_check_pressed(vk)` — true only on the frame the key transitions from up to down. Tracks the previous frame's state per `Game`, the same up/down-transition technique `GmsProjectRuntime`'s own Key dispatch pass uses. */
export declare function keyboard_check_pressed(
  ctx: GmlInputContext,
  vk: number,
): boolean;
/** `keyboard_check_released(vk)` — true only on the frame the key transitions from down to up. */
export declare function keyboard_check_released(
  ctx: GmlInputContext,
  vk: number,
): boolean;
/** `gamepad_is_connected(index)`. */
export declare function gamepad_is_connected(
  ctx: GmlInputContext,
  index: number,
): boolean;
/** `gamepad_button_check(index, button)` — `button` is one of the `gp_*` button constants above, read as the matching standard-layout `GamepadSnapshot.isButtonDown` index. */
export declare function gamepad_button_check(
  ctx: GmlInputContext,
  index: number,
  button: number,
): boolean;
/** `gamepad_button_check_pressed(index, button)` — edge-triggered, the same per-`Game` previous-state tracking `keyboard_check_pressed` uses, keyed by `"<index>:<button>"`. */
export declare function gamepad_button_check_pressed(
  ctx: GmlInputContext,
  index: number,
  button: number,
): boolean;
/** `gamepad_axis_value(index, axis)` — `axis` is one of the `gp_axis*` constants above, read as the matching standard-layout `GamepadSnapshot.axis` index. */
export declare function gamepad_axis_value(
  ctx: GmlInputContext,
  index: number,
  axis: number,
): number;
/**
 * `gamepad_set_axis_deadzone(index, deadzone)` — a real, honest no-op.
 * `InputManager`'s frozen `GamepadSnapshot.axis()` reads the raw device
 * value with no deadzone concept anywhere in this engine (see `Input.ts`);
 * a project calling this expects the *engine* to start clamping small axis
 * values to `0` on its own, which nothing here does. Real GML source calls
 * this purely for its side effect and never inspects a return value
 * (confirmed against a real project's own `scr_get_input.gml`, which calls
 * it then immediately does its own manual `abs(...) > 0.2` deadzone check
 * in the very next line regardless) — a caller that wants an actual
 * deadzone should keep doing that manual check itself, the same honest
 * "not modelled, don't fake it" precedent `action_if_question`/`image_index`
 * already set elsewhere in this compat layer.
 */
export declare function gamepad_set_axis_deadzone(
  _ctx: GmlInputContext,
  _index: number,
  _deadzone: number,
): void;
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
export declare function display_get_gui_width(ctx: GmlInputContext): number;
/** See `display_get_gui_width`'s doc comment. */
export declare function display_get_gui_height(ctx: GmlInputContext): number;
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
export declare const application_surface = -1;
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
export declare function surface_get_width(
  ctx: GmlInputContext,
  surface: number,
): number;
/** See `surface_get_width`'s doc comment. */
export declare function surface_get_height(
  ctx: GmlInputContext,
  surface: number,
): number;
/**
 * `display_get_width()`/`display_get_height()` — GameMaker's real functions
 * read the *physical monitor's* pixel resolution, not the game's own
 * window/room size. This engine has no access to that at all from inside
 * the engine-environment boundary (no DOM/Tauri import allowed here — see
 * CLAUDE.md's "Engine environment boundary" entry), the same class of gap
 * `application_surface` already documents honestly rather than fakes. The
 * one thing this compat layer *can* answer honestly is the game's own
 * authored logical resolution (`ViewportSystem.config.designWidth`/
 * `designHeight`, the same value `display_get_gui_width`/`_height` already
 * read) — real GML code that calls this purely to log/derive an aspect
 * ratio (a real project's own `display_write_specs.gml`: `"Display: " +
 * String(display_get_width()) + " x " + String(display_get_height())`)
 * gets a real, self-consistent number rather than a crash, at the honest
 * cost of it being the game's design resolution, not the user's actual
 * monitor.
 */
export declare function display_get_width(ctx: GmlInputContext): number;
/** See `display_get_width`'s doc comment. */
export declare function display_get_height(ctx: GmlInputContext): number;
/**
 * `window_set_size(w, h)` — resizes the real OS window (desktop) or the
 * browser viewport's backing element. `WindowSystem` (one of `Game`'s five
 * always-registered services, see CLAUDE.md's "PluginSystem, VariableStore,
 * ..." entry) already owns exactly this via its own `setSize()`, which is
 * `async` (it awaits a real Tauri `Window.setSize()` call on desktop). GML's
 * own `window_set_size` is fire-and-forget/synchronous from the script's
 * point of view, so this compat function does not await it either — the
 * same "don't make the caller's site async just to satisfy a host API"
 * shape `onUpdate` itself is documented as requiring (CLAUDE.md's "`onUpdate`
 * must not be async" entry): a real resize eventually happens, this call
 * just doesn't block the calling GML statement waiting for it.
 */
export declare function window_set_size(
  ctx: GmlInputContext,
  width: number,
  height: number,
): void;
/**
 * `window_get_width()`/`window_get_height()` — the real OS window's (or the
 * browser viewport's backing element's) current size, read back from
 * `WindowSystem.getSize()`. Unlike `display_get_width`/`_height` (which
 * honestly alias the game's own *design* resolution, since this engine has
 * no access to the physical monitor), these track the window this engine
 * itself owns and last set — a real, non-approximated answer. `0` when no
 * `Game` is wired (the same "nothing to even ask" default every other
 * `ctx.game`-optional function here uses).
 */
export declare function window_get_width(ctx: GmlInputContext): number;
/** See `window_get_width`'s doc comment. */
export declare function window_get_height(ctx: GmlInputContext): number;
/**
 * `surface_resize(surface, w, h)` — real Surface API resizing this engine
 * has no general implementation for (see `application_surface`'s own doc
 * comment), *except* the same one honestly-supported case
 * `surface_get_width`/`_height` already carve out: called with
 * `application_surface`, which is what a real project's own zoom/scaling
 * code (`obj_display_manager`) actually does — `surface_resize(
 * application_surface, ideal_width * zoom, ideal_height * zoom)`, a classic
 * GameMaker integer-zoom technique. The real, honest engine-side equivalent
 * of "resize the surface the whole room draws to" is `ViewportSystem.
 * setDesignResolution()` — changing the game's own logical design
 * resolution, which is exactly what re-sizing `application_surface`
 * achieves in real GameMaker (everything downstream, including the GUI
 * layer, is defined relative to it). Called with any other surface id, this
 * is a documented no-op — there is no real surface behind it to resize.
 */
export declare function surface_resize(
  ctx: GmlInputContext,
  surface: number,
  width: number,
  height: number,
): void;
/**
 * `mouse_x`/`mouse_y` — the real, extremely common GameMaker built-ins for
 * the mouse's current position, confirmed real and used unwired
 * (`ReferenceError: mouse_x is not defined`) against real project
 * gameplay (`obj_gun`/`obj_pna`'s own aiming code). GameMaker's own real
 * semantic is *room-space* (world) coordinates, already adjusted for the
 * active view/camera — this engine's `PointerState.x`/`.y` are screen-space
 * pixels (the raw pointer/canvas position `PointerSystem` tracks), and
 * there is no camera-to-world inverse-transform helper anywhere in this
 * compat layer to convert one into the other honestly. Rather than silently
 * mislabel a screen-space number as GameMaker's room-space one, this is the
 * same honest, documented approximation `display_get_width`/`_height`
 * already establish for a value this engine cannot derive exactly: the raw
 * pointer position, screen-space, not room-space — correct for a
 * non-scrolling/non-zoomed room (the overwhelmingly common real case for a
 * UI-facing aim readout), a real, named gap otherwise. `0` when no primary
 * pointer is live (matches this engine's other input functions' "nothing
 * to answer" default).
 */
export declare function mouse_x(ctx: GmlInputContext): number;
/** See `mouse_x`'s doc comment. */
export declare function mouse_y(ctx: GmlInputContext): number;
/** `mouse_check_button_pressed(button)` — edge-triggered mouse-button check. Reads `InputManager.pointers`' real per-pointer `buttons` bitmask (the standard `MouseEvent.buttons` convention — bit 0 left, bit 1 right, bit 2 middle, matching `mb_left`/`mb_right`/`mb_middle`'s own 0/1/2 numbering once shifted to a bit index), `true` while any live pointer has that button held. */
export declare function mouse_check_button_pressed(
  ctx: GmlInputContext,
  button: number,
): boolean;
/**
 * `mouse_check_button(button)` — GameMaker's real *level* (held-down) mouse-
 * button check, distinct from `mouse_check_button_pressed`'s edge-triggered
 * variant above — confirmed real, common usage: `obj_gun`'s own real
 * `Step_0.gml` reads it every frame to fire while the button stays held,
 * not just on the click frame. Shares the exact same bitmask read
 * `mouse_check_button_pressed` already uses, with no edge-tracking side-
 * table needed at all — a level check has no "previous frame" to compare
 * against.
 */
export declare function mouse_check_button(
  ctx: GmlInputContext,
  button: number,
): boolean;
/**
 * `display_set_gui_size(w, h)` — GameMaker's real function resizes the GUI
 * layer's own coordinate space independent of the room's world size. This
 * engine's matching concept is `ViewportSystem`'s design resolution (see
 * `display_get_gui_width`'s own doc comment) — the same resource
 * `surface_resize(application_surface, ...)` above already resizes, so
 * this is a thin, honest alias onto the identical call.
 */
export declare function display_set_gui_size(
  ctx: GmlInputContext,
  width: number,
  height: number,
): void;
/**
 * `device_mouse_y_to_gui(device)` — GameMaker's real function reads a
 * specific touch/pointer device's position, already mapped into GUI-layer
 * coordinates. This compat layer has no per-device pointer index (only
 * `mouse_x`/`mouse_y`'s single "primary pointer" concept, see their own
 * doc comment for why that's already a documented approximation of
 * GameMaker's real semantics), so `device` is honestly ignored and this
 * returns the same primary-pointer position `mouse_y` already reads — a
 * real, useful position for the overwhelmingly common single-touch/single-
 * mouse case, not a fabricated per-device value this engine can't derive.
 */
export declare function device_mouse_y_to_gui(
  ctx: GmlInputContext,
  _device: number,
): number;
/** See `device_mouse_y_to_gui`'s doc comment. */
export declare function device_mouse_x_to_gui(
  ctx: GmlInputContext,
  _device: number,
): number;
