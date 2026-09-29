//! Native keyboard-layout query.
//!
//! macOS (WKWebView) and Linux (WebKitGTK) do not implement
//! `navigator.keyboard.getLayoutMap()`, so the host asks the OS which
//! character each physical key types and feeds the answer to the engine's
//! injected `KeyboardLayoutProvider` (see `src/services/keyboardLayoutProvider.ts`).
//! Windows uses WebView2 (Chromium), which has `getLayoutMap`, so it needs
//! no native code and reports `supported: false` here.
//!
//! Answers are the UNSHIFTED, lowercase, single-character output of each
//! printable physical key, keyed by DOM `KeyboardEvent.code`.
//!
//! * macOS: `TISCopyCurrentKeyboardLayoutInputSource` -> `UCKeyTranslate`
//!   (Carbon/HIToolbox). Falls back to the ASCII-capable layout when the
//!   current source is an input method with no key-layout data (e.g. a
//!   Japanese IME), because that is what the user's keys type as Latin.
//! * Linux: resolves the active layout NAME (GNOME `gsettings`, then
//!   `setxkbmap -query`, then `XKB_DEFAULT_LAYOUT`), compiles it with
//!   `xkbcommon`, and translates each evdev keycode. Native Wayland offers
//!   apps no layout query outside their own `wl_keyboard`, which the GTK
//!   toolkit owns, so this is the most portable best effort.
//!
//! NOT COMPILED IN THE ENVIRONMENT THIS WAS WRITTEN IN (no Rust toolchain).

use serde::Serialize;
use std::collections::HashMap;

/// (DOM code, macOS ANSI virtual key code, Linux evdev code).
/// macOS codes are `kVK_ANSI_*` / `kVK_ISO_Section` / `kVK_JIS_*`;
/// evdev codes are `KEY_*` from linux/input-event-codes.h (xkb keycode = evdev + 8).
#[allow(dead_code)]
const KEYS: &[(&str, u16, u16)] = &[
    ("KeyA", 0x00, 30),
    ("KeyB", 0x0B, 48),
    ("KeyC", 0x08, 46),
    ("KeyD", 0x02, 32),
    ("KeyE", 0x0E, 18),
    ("KeyF", 0x03, 33),
    ("KeyG", 0x05, 34),
    ("KeyH", 0x04, 35),
    ("KeyI", 0x22, 23),
    ("KeyJ", 0x26, 36),
    ("KeyK", 0x28, 37),
    ("KeyL", 0x25, 38),
    ("KeyM", 0x2E, 50),
    ("KeyN", 0x2D, 49),
    ("KeyO", 0x1F, 24),
    ("KeyP", 0x23, 25),
    ("KeyQ", 0x0C, 16),
    ("KeyR", 0x0F, 19),
    ("KeyS", 0x01, 31),
    ("KeyT", 0x11, 20),
    ("KeyU", 0x20, 22),
    ("KeyV", 0x09, 47),
    ("KeyW", 0x0D, 17),
    ("KeyX", 0x07, 45),
    ("KeyY", 0x10, 21),
    ("KeyZ", 0x06, 44),
    ("Digit1", 0x12, 2),
    ("Digit2", 0x13, 3),
    ("Digit3", 0x14, 4),
    ("Digit4", 0x15, 5),
    ("Digit5", 0x17, 6),
    ("Digit6", 0x16, 7),
    ("Digit7", 0x1A, 8),
    ("Digit8", 0x1C, 9),
    ("Digit9", 0x19, 10),
    ("Digit0", 0x1D, 11),
    ("Minus", 0x1B, 12),
    ("Equal", 0x18, 13),
    ("BracketLeft", 0x21, 26),
    ("BracketRight", 0x1E, 27),
    ("Semicolon", 0x29, 39),
    ("Quote", 0x27, 40),
    ("Backquote", 0x32, 41),
    ("Backslash", 0x2A, 43),
    ("Comma", 0x2B, 51),
    ("Period", 0x2F, 52),
    ("Slash", 0x2C, 53),
    ("IntlBackslash", 0x0A, 86),
    ("IntlRo", 0x5E, 89),
    ("IntlYen", 0x5D, 124),
];

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct KeyboardLayoutResult {
    /// False when there is no native query on this platform (Windows) or it failed.
    pub supported: bool,
    /// Human-readable source of the answer, e.g. "macos:com.apple.keylayout.French".
    pub layout_id: Option<String>,
    /// DOM `code` -> unshifted lowercase character.
    pub chars: HashMap<String, String>,
    pub error: Option<String>,
}

/// Keep only a single, printable, non-whitespace code point, lowercased.
#[allow(dead_code)]
fn clean_char(s: &str) -> Option<String> {
    let mut it = s.chars();
    let c = it.next()?;
    if it.next().is_some() || c.is_control() || c.is_whitespace() {
        return None;
    }
    let mut lower = c.to_lowercase();
    let first = lower.next()?;
    if lower.next().is_some() {
        return Some(c.to_string());
    }
    Some(first.to_string())
}

/// Sync on purpose: Tauri runs non-`async` commands on the main thread, which
/// the macOS Text Input Sources API requires.
#[tauri::command]
pub fn keyboard_layout_map() -> KeyboardLayoutResult {
    platform::query()
}

// ---------------------------------------------------------------------------
// macOS
// ---------------------------------------------------------------------------
#[cfg(target_os = "macos")]
mod platform {
    use super::{clean_char, KeyboardLayoutResult, KEYS};
    use core_foundation_sys::base::{CFRelease, CFTypeRef};
    use core_foundation_sys::data::{CFDataGetBytePtr, CFDataRef};
    use core_foundation_sys::string::{CFStringGetCString, CFStringRef};
    use std::collections::HashMap;
    use std::ffi::{c_char, c_void, CStr};

    type TISInputSourceRef = *const c_void;
    const K_UC_KEY_ACTION_DISPLAY: u16 = 3;
    const K_UC_KEY_TRANSLATE_NO_DEAD_KEYS_BIT: u32 = 1 << 0;
    const K_CF_STRING_ENCODING_UTF8: u32 = 0x0800_0100;

    #[link(name = "Carbon", kind = "framework")]
    extern "C" {
        static kTISPropertyUnicodeKeyLayoutData: CFStringRef;
        static kTISPropertyInputSourceID: CFStringRef;
        fn TISCopyCurrentKeyboardLayoutInputSource() -> TISInputSourceRef;
        fn TISCopyCurrentASCIICapableKeyboardLayoutInputSource() -> TISInputSourceRef;
        fn TISGetInputSourceProperty(source: TISInputSourceRef, key: CFStringRef) -> *const c_void;
        fn LMGetKbdType() -> u8;
        fn UCKeyTranslate(
            key_layout_ptr: *const c_void,
            virtual_key_code: u16,
            key_action: u16,
            modifier_key_state: u32,
            keyboard_type: u32,
            key_translate_options: u32,
            dead_key_state: *mut u32,
            max_string_length: usize,
            actual_string_length: *mut usize,
            unicode_string: *mut u16,
        ) -> i32;
    }

    unsafe fn source_id(source: TISInputSourceRef) -> Option<String> {
        let s = TISGetInputSourceProperty(source, kTISPropertyInputSourceID) as CFStringRef;
        if s.is_null() {
            return None;
        }
        let mut buf = [0 as c_char; 256];
        if CFStringGetCString(s, buf.as_mut_ptr(), buf.len() as _, K_CF_STRING_ENCODING_UTF8) == 0 {
            return None;
        }
        Some(CStr::from_ptr(buf.as_ptr()).to_string_lossy().into_owned())
    }

    pub fn query() -> KeyboardLayoutResult {
        unsafe {
            let mut src = TISCopyCurrentKeyboardLayoutInputSource();
            let mut data = if src.is_null() {
                std::ptr::null()
            } else {
                TISGetInputSourceProperty(src, kTISPropertyUnicodeKeyLayoutData)
            };
            if data.is_null() {
                // Input method without key-layout data: use its ASCII-capable layout.
                if !src.is_null() {
                    CFRelease(src as CFTypeRef);
                }
                src = TISCopyCurrentASCIICapableKeyboardLayoutInputSource();
                data = if src.is_null() {
                    std::ptr::null()
                } else {
                    TISGetInputSourceProperty(src, kTISPropertyUnicodeKeyLayoutData)
                };
            }
            if data.is_null() {
                if !src.is_null() {
                    CFRelease(src as CFTypeRef);
                }
                return KeyboardLayoutResult {
                    error: Some("no UCKeyboardLayout data for the current input source".into()),
                    ..Default::default()
                };
            }
            let layout_ptr = CFDataGetBytePtr(data as CFDataRef) as *const c_void;
            let kbd_type = LMGetKbdType() as u32;
            let mut chars = HashMap::new();
            for (code, vk, _) in KEYS {
                let mut dead: u32 = 0;
                let mut len: usize = 0;
                let mut buf = [0u16; 4];
                let status = UCKeyTranslate(
                    layout_ptr,
                    *vk,
                    K_UC_KEY_ACTION_DISPLAY,
                    0,
                    kbd_type,
                    K_UC_KEY_TRANSLATE_NO_DEAD_KEYS_BIT,
                    &mut dead,
                    buf.len(),
                    &mut len,
                    buf.as_mut_ptr(),
                );
                if status != 0 || len == 0 || len > buf.len() {
                    continue;
                }
                if let Some(c) = String::from_utf16(&buf[..len]).ok().and_then(|s| clean_char(&s)) {
                    chars.insert((*code).to_string(), c);
                }
            }
            let id = source_id(src).map(|s| format!("macos:{s}"));
            CFRelease(src as CFTypeRef);
            KeyboardLayoutResult {
                supported: true,
                layout_id: id,
                chars,
                error: None,
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Linux
// ---------------------------------------------------------------------------
#[cfg(target_os = "linux")]
mod platform {
    use super::{clean_char, KeyboardLayoutResult, KEYS};
    use std::collections::HashMap;
    use std::process::Command;
    use xkbcommon::xkb;

    /// Layout and variant names, e.g. ("fr", "") or ("us", "dvorak").
    type Names = (String, String);

    fn run(cmd: &str, args: &[&str]) -> Option<String> {
        let out = Command::new(cmd).args(args).output().ok()?;
        if !out.status.success() {
            return None;
        }
        String::from_utf8(out.stdout).ok()
    }

    /// All single-quoted strings in `s`, in order.
    pub(super) fn quoted(s: &str) -> Vec<&str> {
        s.split('\'').skip(1).step_by(2).collect()
    }

    /// GNOME: `sources` like `[('xkb', 'us'), ('xkb', 'ru+phonetic')]`, `current` like `uint32 1`.
    pub(super) fn parse_gsettings(sources: &str, current: &str) -> Option<Names> {
        let idx: usize = current
            .split_whitespace()
            .last()
            .and_then(|t| t.trim().parse().ok())
            .unwrap_or(0);
        let entries: Vec<Vec<&str>> = sources
            .split(')')
            .map(quoted)
            .filter(|q| q.len() >= 2)
            .collect();
        let entry = entries.get(idx).or_else(|| entries.first())?;
        if entry[0] != "xkb" {
            return None; // IBus/other input methods carry no xkb name
        }
        Some(split_name(entry[1]))
    }

    /// `setxkbmap -query`: first entry of the comma-separated layout/variant lists.
    pub(super) fn parse_setxkbmap(out: &str) -> Option<Names> {
        let field = |key: &str| -> Option<String> {
            out.lines()
                .find_map(|l| l.strip_prefix(key))
                .map(|v| v.trim().split(',').next().unwrap_or("").trim().to_string())
        };
        let layout = field("layout:")?;
        if layout.is_empty() {
            return None;
        }
        Some((layout, field("variant:").unwrap_or_default()))
    }

    /// "ru+phonetic" -> ("ru", "phonetic").
    fn split_name(n: &str) -> Names {
        match n.split_once('+') {
            Some((l, v)) => (l.to_string(), v.to_string()),
            None => (n.to_string(), String::new()),
        }
    }

    fn detect() -> Option<(Names, &'static str)> {
        if let (Some(s), Some(c)) = (
            run("gsettings", &["get", "org.gnome.desktop.input-sources", "sources"]),
            run("gsettings", &["get", "org.gnome.desktop.input-sources", "current"]),
        ) {
            if let Some(n) = parse_gsettings(&s, &c) {
                return Some((n, "gsettings"));
            }
        }
        if let Some(n) = run("setxkbmap", &["-query"]).and_then(|o| parse_setxkbmap(&o)) {
            return Some((n, "setxkbmap"));
        }
        if let Ok(l) = std::env::var("XKB_DEFAULT_LAYOUT") {
            let l = l.split(',').next().unwrap_or("").to_string();
            if !l.is_empty() {
                let v = std::env::var("XKB_DEFAULT_VARIANT")
                    .ok()
                    .and_then(|v| v.split(',').next().map(str::to_string))
                    .unwrap_or_default();
                return Some(((l, v), "env"));
            }
        }
        None
    }

    pub fn query() -> KeyboardLayoutResult {
        let ((layout, variant), via) = match detect() {
            Some(d) => d,
            None => {
                return KeyboardLayoutResult {
                    error: Some("could not determine the active XKB layout".into()),
                    ..Default::default()
                }
            }
        };
        let ctx = xkb::Context::new(xkb::CONTEXT_NO_FLAGS);
        let keymap = match xkb::Keymap::new_from_names(
            &ctx,
            "",
            "",
            &layout,
            &variant,
            None,
            xkb::KEYMAP_COMPILE_NO_FLAGS,
        ) {
            Some(k) => k,
            None => {
                return KeyboardLayoutResult {
                    error: Some(format!("xkbcommon rejected layout '{layout}' variant '{variant}'")),
                    ..Default::default()
                }
            }
        };
        let state = xkb::State::new(&keymap);
        let mut chars = HashMap::new();
        for (code, _, evdev) in KEYS {
            let cp = state.key_get_utf32((*evdev as u32) + 8);
            if let Some(c) = char::from_u32(cp).and_then(|c| clean_char(&c.to_string())) {
                chars.insert((*code).to_string(), c);
            }
        }
        KeyboardLayoutResult {
            supported: true,
            layout_id: Some(format!("linux:{via}:{layout}{}", if variant.is_empty() { String::new() } else { format!("+{variant}") })),
            chars,
            error: None,
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn gsettings_picks_current_source() {
            let s = "[('xkb', 'us'), ('xkb', 'ru+phonetic')]";
            assert_eq!(parse_gsettings(s, "uint32 1"), Some(("ru".into(), "phonetic".into())));
            assert_eq!(parse_gsettings(s, "uint32 0"), Some(("us".into(), "".into())));
        }

        #[test]
        fn gsettings_ignores_non_xkb_sources() {
            assert_eq!(parse_gsettings("[('ibus', 'mozc-jp')]", "uint32 0"), None);
        }

        #[test]
        fn setxkbmap_takes_first_entry() {
            let out = "rules:      evdev\nmodel:      pc105\nlayout:     fr,us\nvariant:    ,dvorak\n";
            assert_eq!(parse_setxkbmap(out), Some(("fr".into(), "".into())));
        }
    }
}

// ---------------------------------------------------------------------------
// Windows and everything else: WebView2 has navigator.keyboard.getLayoutMap.
// ---------------------------------------------------------------------------
#[cfg(not(any(target_os = "macos", target_os = "linux")))]
mod platform {
    use super::KeyboardLayoutResult;

    pub fn query() -> KeyboardLayoutResult {
        KeyboardLayoutResult::default()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn table_codes_are_unique() {
        let mut seen = std::collections::HashSet::new();
        for (code, _, _) in KEYS {
            assert!(seen.insert(*code), "duplicate {code}");
        }
    }

    #[test]
    fn clean_char_rules() {
        assert_eq!(clean_char("A"), Some("a".into()));
        assert_eq!(clean_char("ф"), Some("ф".into()));
        assert_eq!(clean_char("ab"), None);
        assert_eq!(clean_char(" "), None);
        assert_eq!(clean_char("\u{0}"), None);
    }
}
