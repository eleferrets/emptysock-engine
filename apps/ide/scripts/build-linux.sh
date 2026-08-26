#!/usr/bin/env bash
# Build the EmptySock IDE as a standalone Linux AppImage.
# Run this on Ubuntu 22.04 or later.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IDE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_DIR="$(cd "$IDE_DIR/../.." && pwd)"

echo "==> Installing system build dependencies..."
sudo apt-get update -q
sudo apt-get install -y -q \
  libwebkit2gtk-4.1-dev \
  libappindicator3-dev \
  librsvg2-dev \
  patchelf \
  libgtk-3-dev \
  libssl-dev \
  wget \
  file

echo "==> Installing Rust (if needed)..."
if ! command -v cargo &>/dev/null; then
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable
  source "$HOME/.cargo/env"
fi

echo "==> Installing pnpm (if needed)..."
if ! command -v pnpm &>/dev/null; then
  npm install -g pnpm
fi

echo "==> Installing JS dependencies..."
cd "$REPO_DIR"
pnpm install

echo "==> Building engine package..."
pnpm --filter @emptysock/engine build

echo "==> Building Tauri AppImage..."
cd "$IDE_DIR"
pnpm tauri build --bundles appimage,deb

echo ""
echo "Done! Artifacts are in:"
echo "  $IDE_DIR/src-tauri/target/release/bundle/appimage/"
echo "  $IDE_DIR/src-tauri/target/release/bundle/deb/"
