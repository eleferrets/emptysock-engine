// Minimal shell — the game itself is plain HTML/JS/WASM served from `dist/`.
// No custom commands: an exported game does not need IDE-side Tauri APIs.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Force discrete GPU on NVIDIA Optimus and AMD PowerXpress laptops.
// See emptysock-engine/CLAUDE.md ("GPU flags in lib.rs") for why this must
// stay a #[no_mangle] static rather than an API call.
#[no_mangle]
pub static NvOptimusEnablement: u32 = 1;
#[no_mangle]
pub static AmdPowerXpressRequestHighPerformance: i32 = 1;

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running exported game");
}
