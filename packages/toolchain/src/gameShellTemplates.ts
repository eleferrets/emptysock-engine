/**
 * Embedded templates for the minimal Tauri v2 "game shell" that desktop
 * export builds against. Kept as plain string constants (rather than files
 * read off disk at runtime) so they work the same way whether this package
 * is run from source (tsx/vitest) or from the compiled `dist/` output —
 * there is no separate "copy templates into dist" build step to keep in
 * sync.
 *
 * This mirrors apps/ide/src-tauri/game-shell-template/ (used by the IDE's
 * own `export_game` Tauri command) but is independent of it: the CLI must
 * work without the IDE app present at all.
 */

export const CARGO_TOML_TEMPLATE = `[package]
name = "{{package_name}}"
version = "0.1.0"
description = "EmptySock exported game"
authors = ["EmptySock"]
license = "UNLICENSED"
edition = "2021"
rust-version = "1.77.2"

[build-dependencies]
tauri-build = { version = "2.6.3" }

[dependencies]
serde_json = "1.0"
serde = { version = "1.0", features = ["derive"] }
tauri = { version = "2.11.3" }

[[bin]]
name = "{{package_name}}"
path = "src/main.rs"
`;

export const TAURI_CONF_TEMPLATE = `{
  "productName": "{{product_name}}",
  "version": "0.1.0",
  "identifier": "{{identifier}}",
  "build": {
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "title": "{{product_name}}",
        "width": 1280,
        "height": 720,
        "resizable": true,
        "fullscreen": false
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": {{bundle_targets}}
  }
}
`;

export const BUILD_RS = `fn main() {
    tauri_build::build();
}
`;

export const MAIN_RS = `#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running exported game");
}
`;

/** Cargo package / binary names must be lowercase kebab-ish identifiers. */
export function slugify(name: string): string {
  let out = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (out === "") out = "emptysock-game";
  if (/^[0-9]/.test(out)) out = `g-${out}`;
  return out;
}
