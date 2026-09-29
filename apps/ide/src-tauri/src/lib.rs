use serde::{Deserialize, Serialize};
use std::path::PathBuf;

mod keyboard_layout;

// Force discrete GPU on NVIDIA Optimus and AMD PowerXpress laptops.
#[no_mangle]
pub static NvOptimusEnablement: u32 = 1;
#[no_mangle]
pub static AmdPowerXpressRequestHighPerformance: i32 = 1;

// ---------------------------------------------------------------------------
// File I/O commands
// ---------------------------------------------------------------------------

#[derive(Serialize)]
pub struct FileResult {
    pub success: bool,
    pub content: Option<String>,
    pub path: Option<String>,
    pub error: Option<String>,
}

/// Open a single file via the native file-picker dialog and return its content.
#[tauri::command]
async fn open_file(app: tauri::AppHandle) -> FileResult {
    use tauri_plugin_dialog::DialogExt;
    let path = app
        .dialog()
        .file()
        .add_filter("TypeScript / JavaScript", &["ts", "js", "json"])
        .blocking_pick_file();

    let path = match path {
        Some(p) => p,
        None => {
            return FileResult {
                success: false,
                content: None,
                path: None,
                error: Some("Cancelled".into()),
            }
        }
    };

    let path = match path.into_path() {
        Ok(p) => p,
        Err(e) => {
            return FileResult {
                success: false,
                content: None,
                path: None,
                error: Some(e.to_string()),
            }
        }
    };
    let path_str = path.to_string_lossy().to_string();
    match std::fs::read_to_string(&path) {
        Ok(content) => FileResult {
            success: true,
            content: Some(content),
            path: Some(path_str),
            error: None,
        },
        Err(e) => FileResult {
            success: false,
            content: None,
            path: Some(path_str),
            error: Some(e.to_string()),
        },
    }
}

/// Save `content` to `path`; if path is null the user is prompted for a location.
#[tauri::command]
async fn save_file(app: tauri::AppHandle, path: Option<String>, content: String) -> FileResult {
    use tauri_plugin_dialog::DialogExt;

    let resolved: PathBuf = match path {
        Some(p) => PathBuf::from(p),
        None => {
            let picked = app
                .dialog()
                .file()
                .add_filter("TypeScript", &["ts"])
                .blocking_save_file();
            match picked {
                Some(p) => match p.into_path() {
                    Ok(p) => p,
                    Err(e) => {
                        return FileResult {
                            success: false,
                            content: None,
                            path: None,
                            error: Some(e.to_string()),
                        }
                    }
                },
                None => {
                    return FileResult {
                        success: false,
                        content: None,
                        path: None,
                        error: Some("Cancelled".into()),
                    }
                }
            }
        }
    };

    let path_str = resolved.to_string_lossy().to_string();
    if let Some(parent) = resolved.parent() {
        if let Err(e) = std::fs::create_dir_all(parent) {
            return FileResult {
                success: false,
                content: None,
                path: Some(path_str),
                error: Some(e.to_string()),
            };
        }
    }

    match std::fs::write(&resolved, &content) {
        Ok(()) => FileResult {
            success: true,
            content: None,
            path: Some(path_str),
            error: None,
        },
        Err(e) => FileResult {
            success: false,
            content: None,
            path: Some(path_str),
            error: Some(e.to_string()),
        },
    }
}

// ---------------------------------------------------------------------------
// "Open in VS Code" command (ENGINE_DESIGN.md §20)
// ---------------------------------------------------------------------------
//
// Deliberately not a theme/extension import — this shells out to the user's
// own installed VS Code CLI (`code`) against the project folder, same as
// running it from a terminal. On Windows `code` is a `.cmd` shim that
// `Command::new` cannot exec directly, so that platform is retried through
// `cmd /C`. This is a plain `std::process::Command` spawn (the same pattern
// `export_game` already uses to shell out to `cargo tauri build`), not the
// `tauri-plugin-shell` JS API, so no shell-execute scope config is needed.

#[derive(Serialize)]
pub struct OpenVsCodeResult {
    pub success: bool,
    pub error: Option<String>,
}

#[tauri::command]
fn open_in_vscode(path: String) -> OpenVsCodeResult {
    let spawn_result = if cfg!(target_os = "windows") {
        std::process::Command::new("cmd")
            .args(["/C", "code", &path])
            .spawn()
    } else {
        std::process::Command::new("code").arg(&path).spawn()
    };

    match spawn_result {
        Ok(_) => OpenVsCodeResult {
            success: true,
            error: None,
        },
        Err(e) => OpenVsCodeResult {
            success: false,
            error: Some(format!(
                "Could not launch the `code` command ({e}). Is VS Code's \
                 command-line launcher installed? (VS Code → Command Palette → \
                 \"Shell Command: Install 'code' command in PATH\")."
            )),
        },
    }
}

// ---------------------------------------------------------------------------
// Git command (GitPanel — commit/push/log for the project's own repo)
// ---------------------------------------------------------------------------
//
// One generic passthrough rather than one Tauri command per git subcommand
// (status/add/commit/push/log/…) — GitPanel already assembles the exact
// argv it wants (e.g. `["commit", "-m", msg]`), so there is no benefit to
// re-encoding each subcommand's flags into a second, parallel Rust-side
// API. Args are passed to `std::process::Command::args()` as a real Vec,
// never through a shell, so there is no injection risk from a commit
// message or file path containing shell metacharacters. Same
// `std::process::Command` pattern as `open_in_vscode`/`export_game`, not
// the `tauri-plugin-shell` JS API — no shell-execute scope config needed.

#[derive(Serialize)]
pub struct GitResult {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
}

#[tauri::command]
fn run_git(project_dir: String, args: Vec<String>) -> GitResult {
    match std::process::Command::new("git")
        .current_dir(&project_dir)
        .args(&args)
        .output()
    {
        Ok(output) => GitResult {
            success: output.status.success(),
            stdout: String::from_utf8_lossy(&output.stdout).to_string(),
            stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        },
        Err(e) => GitResult {
            success: false,
            stdout: String::new(),
            stderr: format!("Could not launch git ({e}). Is git installed and on PATH?"),
        },
    }
}

// ---------------------------------------------------------------------------
// Logging command
// ---------------------------------------------------------------------------

#[tauri::command]
fn log_error(message: String) {
    eprintln!("[EmptySock IDE] {message}");
}

// ---------------------------------------------------------------------------
// Export command — builds a real desktop installer via `cargo tauri build`
// ---------------------------------------------------------------------------
//
// This does NOT shell out to the `emptysock-toolchain` CLI or depend on it
// being installed. It scaffolds a minimal Tauri v2 "game shell" project
// (templates embedded at compile time via `include_str!`, so no external
// files are required at runtime), drops the already-bundled game JS/HTML
// into its `dist/` folder, and runs `cargo tauri build` against it directly.
// Real installers/binaries land in the project's own
// `src-tauri/target/release/bundle/<type>/` — Tauri's standard output path —
// and that directory is what gets returned to the IDE.
//
// Cross-compiling a macOS .dmg from Linux (or a Windows installer from
// macOS, etc.) is not something a single machine can reliably do — it needs
// the target OS's native toolchain (and, for macOS signing/notarisation,
// Xcode on real Apple hardware). We do not pretend otherwise: a request for
// a platform that doesn't match the host OS fails immediately with an
// explanation, before any build is attempted.

const CARGO_TOML_TMPL: &str = include_str!("../game-shell-template/Cargo.toml.tmpl");
const TAURI_CONF_TMPL: &str = include_str!("../game-shell-template/tauri.conf.json.tmpl");
const BUILD_RS: &str = include_str!("../game-shell-template/build.rs");
const MAIN_RS: &str = include_str!("../game-shell-template/src/main.rs");
const ICON_32: &[u8] = include_bytes!("../game-shell-template/icons/32x32.png");
const ICON_128: &[u8] = include_bytes!("../game-shell-template/icons/128x128.png");
const ICON_128_2X: &[u8] = include_bytes!("../game-shell-template/icons/128x128@2x.png");
const ICON_ICNS: &[u8] = include_bytes!("../game-shell-template/icons/icon.icns");
const ICON_ICO: &[u8] = include_bytes!("../game-shell-template/icons/icon.ico");

#[derive(Deserialize)]
pub struct ExportArgs {
    /// "windows" | "macos" | "linux"
    pub platform: String,
    /// Comma-separated Tauri bundle targets for this platform, e.g.
    /// "nsis,msi" (windows), "appimage,deb" (linux), "dmg,app" (macos).
    pub format: String,
    #[serde(rename = "indexHtml")]
    pub index_html: String,
    #[serde(rename = "engineJs")]
    pub engine_js: String,
    #[serde(rename = "gameJs")]
    pub game_js: String,
    #[serde(rename = "projectName", default = "default_project_name")]
    pub project_name: String,
}

fn default_project_name() -> String {
    String::from("emptysock-game")
}

#[derive(Serialize)]
pub struct ExportResult {
    pub success: bool,
    #[serde(rename = "outputPath")]
    pub output_path: String,
    pub error: Option<String>,
}

/// The Tauri-recognised OS family for the current host.
fn host_platform() -> &'static str {
    match std::env::consts::OS {
        "windows" => "windows",
        "macos" => "macos",
        _ => "linux",
    }
}

/// Turns a display name into a valid Cargo package / binary name.
fn slugify(name: &str) -> String {
    let mut out: String = name
        .to_lowercase()
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '-' })
        .collect();
    out = out.trim_matches('-').to_string();
    if out.is_empty() {
        out = "emptysock-game".to_string();
    }
    if out.chars().next().is_some_and(|c| c.is_ascii_digit()) {
        out = format!("g-{out}");
    }
    out
}

fn write_all(path: &std::path::Path, bytes: &[u8]) -> std::io::Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(path, bytes)
}

#[tauri::command]
async fn export_game(args: ExportArgs) -> ExportResult {
    let host = host_platform();
    if args.platform != host {
        return ExportResult {
            success: false,
            output_path: String::new(),
            error: Some(format!(
                "Cannot build a {} package on this machine — this machine is {}. \
                 Cross-compiling a native desktop installer for a different OS is not \
                 supported from a single machine (Tauri needs the target OS's own \
                 toolchain, and macOS builds additionally need real Apple hardware for \
                 signing). Build {} targets on a {} machine, or set up a CI matrix build \
                 (one job per OS) instead.",
                args.platform, host, args.platform, args.platform
            )),
        };
    }

    // 1. Check the `cargo tauri` subcommand is available. We deliberately do
    //    NOT depend on `emptysock-toolchain` or any Node/npx toolchain here —
    //    `cargo` is already a hard requirement for compiling any native
    //    binary, so this is the one thing we can assume is worth checking
    //    for rather than trying to install ourselves.
    let cargo_tauri_check = std::process::Command::new("cargo")
        .args(["tauri", "--version"])
        .output();
    match cargo_tauri_check {
        Ok(out) if out.status.success() => {}
        _ => {
            return ExportResult {
                success: false,
                output_path: String::new(),
                error: Some(
                    "`cargo tauri` is not available. Desktop export compiles a real \
                     native binary, which requires the Rust toolchain plus the Tauri \
                     CLI. Install with:\n\n  cargo install tauri-cli --version \"^2\"\n\n\
                     (and, on Linux, the Tauri system dependencies: \
                     https://v2.tauri.app/start/prerequisites/)"
                        .to_string(),
                ),
            };
        }
    }

    let slug = slugify(&args.project_name);
    let tmp_root = std::env::temp_dir()
        .join("emptysock-export")
        .join(format!("{slug}-{}", std::process::id()));
    let src_tauri = tmp_root.join("src-tauri");
    let dist = tmp_root.join("dist");

    // 2. Write the game's built output as the shell's frontend.
    if let Err(e) = write_all(&dist.join("index.html"), args.index_html.as_bytes())
        .and_then(|()| write_all(&dist.join("engine.js"), args.engine_js.as_bytes()))
        .and_then(|()| write_all(&dist.join("game.js"), args.game_js.as_bytes()))
    {
        return ExportResult {
            success: false,
            output_path: String::new(),
            error: Some(format!("Failed to write game bundle: {e}")),
        };
    }

    // 3. Scaffold the Tauri shell project from the embedded templates.
    let identifier = format!("io.emptysock.game.{slug}");
    let bundle_targets = if args.format.trim().is_empty() {
        "\"all\"".to_string()
    } else {
        let list = args
            .format
            .split(',')
            .map(|f| format!("\"{}\"", f.trim()))
            .collect::<Vec<_>>()
            .join(",");
        format!("[{list}]")
    };

    let cargo_toml = CARGO_TOML_TMPL.replace("{{package_name}}", &slug);
    let tauri_conf = TAURI_CONF_TMPL
        .replace("{{product_name}}", &args.project_name)
        .replace("{{identifier}}", &identifier)
        .replace("{{bundle_targets}}", &bundle_targets);

    let writes: [(std::path::PathBuf, &[u8]); 9] = [
        (src_tauri.join("Cargo.toml"), cargo_toml.as_bytes()),
        (src_tauri.join("tauri.conf.json"), tauri_conf.as_bytes()),
        (src_tauri.join("build.rs"), BUILD_RS.as_bytes()),
        (src_tauri.join("src/main.rs"), MAIN_RS.as_bytes()),
        (src_tauri.join("icons/32x32.png"), ICON_32),
        (src_tauri.join("icons/128x128.png"), ICON_128),
        (src_tauri.join("icons/128x128@2x.png"), ICON_128_2X),
        (src_tauri.join("icons/icon.icns"), ICON_ICNS),
        (src_tauri.join("icons/icon.ico"), ICON_ICO),
    ];
    for (path, bytes) in writes {
        if let Err(e) = write_all(&path, bytes) {
            return ExportResult {
                success: false,
                output_path: String::new(),
                error: Some(format!("Failed to scaffold build project ({path:?}): {e}")),
            };
        }
    }

    // 4. Run the real build.
    let build = std::process::Command::new("cargo")
        .arg("tauri")
        .arg("build")
        .current_dir(&src_tauri)
        .output();

    match build {
        Ok(output) if output.status.success() => {
            let bundle_dir = src_tauri.join("target/release/bundle");
            ExportResult {
                success: true,
                output_path: bundle_dir.to_string_lossy().to_string(),
                error: None,
            }
        }
        Ok(output) => {
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            ExportResult {
                success: false,
                output_path: String::new(),
                error: Some(if stderr.is_empty() {
                    format!(
                        "cargo tauri build exited with code {:?}",
                        output.status.code()
                    )
                } else {
                    stderr
                }),
            }
        }
        Err(e) => ExportResult {
            success: false,
            output_path: String::new(),
            error: Some(format!("Failed to run cargo tauri build: {e}")),
        },
    }
}

// ---------------------------------------------------------------------------
// App entry point
// ---------------------------------------------------------------------------

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            open_file,
            save_file,
            export_game,
            open_in_vscode,
            run_git,
            log_error,
            keyboard_layout::keyboard_layout_map
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
