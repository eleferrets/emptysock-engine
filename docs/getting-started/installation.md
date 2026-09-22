# Installation

This page lists every tool you need before the IDE or any game project will build. Install them in the order shown, it saves you backtracking.

**Total estimated install time:** about 10–15 minutes on a fast connection (longer if you add Android or iOS targets).

You do not need everything right away. If you just want to try the IDE in a browser, only Node.js and pnpm are required.

---

## Node.js

**Required version:** 20 LTS or later (22 LTS recommended).
**Time:** 2–3 minutes.

EmptySock's IDE and toolchain are Node-based. The build pipeline (esbuild-wasm, Vite, TypeScript) runs inside Node. Older versions may work but are untested.

Verify:

```bash
node --version   # must print v20.x.x or higher
npm --version    # 10+ expected if Node 20 is installed
```

Install via your operating system's package manager or the official installer at nodejs.org. On Linux, the recommended path is `nvm` (Node Version Manager) to avoid permission issues with global packages.

> **If you get stuck:** On Linux, if `node --version` prints a version below 20, your system package manager may have installed an older Node. Use `nvm` to install and switch versions: `nvm install 22 && nvm use 22`.

---

## pnpm

**Required version:** 9 or later.
**Time:** under 1 minute.

All packages in this monorepo use pnpm workspaces. npm and yarn will not resolve workspace dependencies correctly.

Install:

```bash
corepack enable
corepack prepare pnpm@latest --activate
```

Verify:

```bash
pnpm --version   # must print 9.x.x or higher
```

> **If you get stuck:** If `corepack enable` fails with a permission error, try `sudo corepack enable`. On Windows, run the command in an Administrator PowerShell.

---

## Rust toolchain

**Required for:** Tauri desktop builds only. Not needed for browser-only development.
**Time:** 5–10 minutes (downloads several hundred MB on first install).

The Tauri backend that wraps the IDE as a native desktop application is written in Rust. The minimum required edition is **Rust 2021**, which maps to stable Rust 1.70 or later.

Install via `rustup` (the official Rust toolchain installer):

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
rustup update stable
```

Verify:

```bash
rustc --version   # must print 1.70.0 or later
cargo --version
```

**Required Rust targets for cross-platform export:**

| Platform            | Target triple                        |
| ------------------- | ------------------------------------ |
| Linux x86-64        | `x86_64-unknown-linux-gnu` (default) |
| Linux ARM64         | `aarch64-unknown-linux-gnu`          |
| macOS Intel         | `x86_64-apple-darwin`                |
| macOS Apple Silicon | `aarch64-apple-darwin`               |
| Windows x86-64      | `x86_64-pc-windows-msvc`             |
| Android ARM64       | `aarch64-linux-android`              |
| iOS ARM64           | `aarch64-apple-ios`                  |

Add a target:

```bash
rustup target add aarch64-apple-darwin
```

> **If you get stuck:** The first `cargo build` of the Tauri backend can take 5–10 minutes — this is normal. Subsequent builds are much faster because Cargo caches compiled dependencies.

---

## System libraries (Linux only)

Tauri requires several system libraries for its WebView and windowing layer. This is only needed if you want to build or run the desktop app on Linux.

On Debian/Ubuntu:

```bash
sudo apt update && sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libxdo-dev \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev
```

On Fedora/RHEL:

```bash
sudo dnf install webkit2gtk4.1-devel openssl-devel curl wget file libxdo-devel \
  libappindicator-gtk3-devel librsvg2-devel
```

On Arch:

```bash
sudo pacman -S webkit2gtk-4.1 base-devel curl wget openssl libxdo
```

> **If you get stuck:** If the package name `libwebkit2gtk-4.1-dev` is not found, your distro may use a slightly different name. Try `apt search webkit2gtk` to find the right version for your system.

---

## Android SDK (Android export only)

To export a game to Android you need the Android SDK and NDK. The simplest way is via Android Studio.

**Required components:**

- Android SDK Platform 33 or later
- Android NDK (version pinned in `apps/ide/src-tauri/gen/android/`)
- Android Build Tools 33+
- `ANDROID_HOME` environment variable pointing to your SDK root
- `NDK_HOME` pointing to the specific NDK version

**Java:** JDK 17 is required. OpenJDK 17 works.

Verify:

```bash
adb --version
javac -version   # must print 17.x.x
```

> **If you get stuck:** The most common problem is `ANDROID_HOME` not being set. Add `export ANDROID_HOME=$HOME/Android/Sdk` to your shell profile (`.bashrc` or `.zshrc`) and restart your terminal.

---

## Xcode (iOS/macOS export only)

iOS and macOS exports require Xcode 15 or later, which is only available on macOS. Install from the Mac App Store.

After installing, accept the license and install command-line tools:

```bash
sudo xcode-select --switch /Applications/Xcode.app
sudo xcodebuild -license accept
xcode-select --install
```

For iOS device builds you also need an Apple Developer Program membership (free tier works for testing on personal devices).

> **If you get stuck:** If `xcode-select --install` says the software is already installed but `xcrun` fails, try `sudo xcode-select --reset`.

---

## Git

**Required version:** 2.38 or later.

The IDE's Git panel runs `git` as a subprocess. If `git` is not on `PATH`, the panel shows a stub UI in both browser and desktop modes.

Verify:

```bash
git --version
```

---

## Summary checklist

| Tool                 | Min version | Required for           | Est. install time |
| -------------------- | ----------- | ---------------------- | ----------------- |
| Node.js              | 20 LTS      | Everything             | 2–3 min           |
| pnpm                 | 9           | Everything             | < 1 min           |
| Rust (stable)        | 1.70        | Desktop builds         | 5–10 min          |
| Tauri system libs    | —           | Desktop builds (Linux) | 1–2 min           |
| Android Studio / SDK | API 33      | Android export         | 15–30 min         |
| JDK                  | 17          | Android export         | 2–3 min           |
| Xcode                | 15          | iOS / macOS export     | 20–40 min         |
| Git                  | 2.38        | Git panel in IDE       | 1 min             |

---

Next: [Your First Game](./your-first-game.md)
