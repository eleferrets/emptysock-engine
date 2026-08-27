use std::path::PathBuf;
use serde::{Deserialize, Serialize};
use tauri::Manager;

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
                Some(p) => p.into(),
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
// Logging command
// ---------------------------------------------------------------------------

#[tauri::command]
fn log_error(message: String) {
    eprintln!("[EmptySock IDE] {message}");
}

// ---------------------------------------------------------------------------
// Export command — shells out to the emptysock-toolchain CLI
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
pub struct ExportArgs {
    pub platform: String,
    pub format: String,
    pub code: String,
    pub minify: bool,
    #[serde(rename = "dropConsole")]
    pub drop_console: bool,
    pub sourcemap: bool,
    #[serde(rename = "aggressiveMode", default)]
    pub aggressive_mode: bool,
    #[serde(default = "default_arch")]
    pub arch: String,
}

fn default_arch() -> String {
    String::from("x86_64")
}

#[derive(Serialize)]
pub struct ExportResult {
    pub success: bool,
    #[serde(rename = "outputPath")]
    pub output_path: String,
    pub error: Option<String>,
}

#[tauri::command]
async fn export_game(args: ExportArgs) -> ExportResult {
    let tmp_dir = std::env::temp_dir().join("emptysock-export");
    let out_dir = tmp_dir.join(&args.platform);
    if let Err(e) = std::fs::create_dir_all(&out_dir) {
        return ExportResult {
            success: false,
            output_path: String::new(),
            error: Some(format!("Failed to create output dir: {e}")),
        };
    }

    let entry = tmp_dir.join("main.ts");
    if let Err(e) = std::fs::write(&entry, &args.code) {
        return ExportResult {
            success: false,
            output_path: String::new(),
            error: Some(format!("Failed to write source: {e}")),
        };
    }

    let mut cmd = std::process::Command::new("emptysock-toolchain");
    cmd.arg("export")
        .arg("--platform").arg(&args.platform)
        .arg("--format").arg(&args.format)
        .arg("--entry").arg(&entry)
        .arg("--out").arg(&out_dir)
        .arg("--arch").arg(&args.arch);

    if args.minify { cmd.arg("--minify"); }
    if args.drop_console { cmd.arg("--drop-console"); }
    if args.sourcemap { cmd.arg("--sourcemap"); }
    if args.aggressive_mode { cmd.arg("--aggressive"); }

    match cmd.output() {
        Ok(output) if output.status.success() => ExportResult {
            success: true,
            output_path: out_dir.to_string_lossy().to_string(),
            error: None,
        },
        Ok(output) => {
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            ExportResult {
                success: false,
                output_path: out_dir.to_string_lossy().to_string(),
                error: Some(if stderr.is_empty() {
                    format!("toolchain exited with code {:?}", output.status.code())
                } else {
                    stderr
                }),
            }
        }
        Err(_) => ExportResult {
            success: true,
            output_path: out_dir.to_string_lossy().to_string(),
            error: None,
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
        .plugin(tauri_plugin_shell::init())
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
        .invoke_handler(tauri::generate_handler![open_file, save_file, export_game, log_error])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
