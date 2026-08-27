# 1 — Prerequisites & Required SDKs

This section lists every tool you need installed before the IDE or any game project will build. Install them in the order shown.

---

## 1.1 Node.js

**Required version:** 20 LTS or later (22 LTS recommended).

EmptySock's IDE and toolchain are Node-based. The build pipeline (esbuild-wasm, Vite, TypeScript) runs inside Node. Older versions may work but are untested.

Verify:
```bash
node --version   # must print v20.x.x or higher
npm --version    # 10+ expected if Node 20 is installed
```

Install via your operating system's package manager or the official installer. On Linux, the recommended path is `nvm` (Node Version Manager) to avoid permission issues with global packages.

---

## 1.2 pnpm

**Required version:** 9 or later.

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

---

## 1.3 Rust toolchain

**Required for:** Tauri desktop builds. Not needed for browser-only development.

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

| Platform | Target triple |
|----------|---------------|
| Linux x86-64 | `x86_64-unknown-linux-gnu` (default) |
| Linux ARM64 | `aarch64-unknown-linux-gnu` |
| macOS Intel | `x86_64-apple-darwin` |
| macOS Apple Silicon | `aarch64-apple-darwin` |
| Windows x86-64 | `x86_64-pc-windows-msvc` |
| Android ARM64 | `aarch64-linux-android` |
| iOS ARM64 | `aarch64-apple-ios` |

Add a target:
```bash
rustup target add aarch64-apple-darwin
```

---

## 1.4 System libraries (Linux only)

On Linux, Tauri requires several system libraries for its WebView and windowing layer. On Debian/Ubuntu:

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

---

## 1.5 Android SDK (Android export only)

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

---

## 1.6 Xcode (iOS/macOS export only)

iOS and macOS exports require Xcode 15 or later, which is only available on macOS. Install from the Mac App Store.

After installing, accept the license and install command-line tools:
```bash
sudo xcode-select --switch /Applications/Xcode.app
sudo xcodebuild -license accept
xcode-select --install
```

For iOS device builds you also need an Apple Developer Program membership (free tier works for testing on personal devices).

---

## 1.7 Git

**Required version:** 2.38 or later.

The IDE's GitPanel runs `git` as a subprocess. If `git` is not on `PATH` the panel shows a stub UI in both browser and desktop modes.

Verify:
```bash
git --version
```

---

## 1.8 Conventional-commit tooling (contributors only)

If you contribute to the engine itself (not just use it), Husky enforces conventional commits via a pre-commit hook. The required devDependencies are already in `package.json` — they install automatically with `pnpm install`.

The hook runs:
1. `lint-staged` — ESLint + Prettier on staged files
2. `commitlint` — validates commit message format (`type(scope): subject`)

Valid types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `perf`, `ci`.

---

## 1.9 Summary checklist

| Tool | Min version | Required for |
|------|-------------|-------------|
| Node.js | 20 LTS | Everything |
| pnpm | 9 | Everything |
| Rust (stable) | 1.70 | Desktop builds |
| Tauri system libs | — | Desktop builds (Linux) |
| Android Studio / SDK | API 33 | Android export |
| JDK | 17 | Android export |
| Xcode | 15 | iOS / macOS export |
| Git | 2.38 | GitPanel in IDE |
