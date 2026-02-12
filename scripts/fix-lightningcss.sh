#!/bin/bash
# Fix lightningcss arm64 binaries on Apple Silicon
# This script runs as postinstall to ensure the native binaries are present

set -e

ARCH=$(uname -m)
if [ "$ARCH" != "arm64" ]; then
  echo "[fix-lightningcss] Not arm64, skipping."
  exit 0
fi

OS=$(uname -s)
if [ "$OS" != "Darwin" ]; then
  echo "[fix-lightningcss] Not macOS, skipping."
  exit 0
fi

echo "[fix-lightningcss] Checking arm64 binaries..."

# --- Nested (react-native-css-interop) lightningcss v1.27.0 ---
NESTED_DIR="node_modules/react-native-css-interop/node_modules"
NESTED_LC="$NESTED_DIR/lightningcss"
NESTED_PKG="$NESTED_DIR/lightningcss-darwin-arm64"
NESTED_BINARY="$NESTED_LC/lightningcss.darwin-arm64.node"

if [ -d "$NESTED_LC" ] && [ ! -f "$NESTED_BINARY" ]; then
  echo "[fix-lightningcss] Installing nested lightningcss-darwin-arm64@1.27.0..."
  TMPDIR=$(mktemp -d)
  (cd "$TMPDIR" && npm pack lightningcss-darwin-arm64@1.27.0 --quiet 2>/dev/null)
  mkdir -p "$NESTED_PKG"
  tar -xzf "$TMPDIR"/lightningcss-darwin-arm64-*.tgz -C "$NESTED_PKG" --strip-components=1
  cp "$NESTED_PKG/lightningcss.darwin-arm64.node" "$NESTED_BINARY"
  rm -rf "$TMPDIR"
  echo "[fix-lightningcss] Nested binary installed."
else
  echo "[fix-lightningcss] Nested binary OK (or not needed)."
fi

# --- Top-level lightningcss v1.31.1 ---
TOP_LC="node_modules/lightningcss"
TOP_PKG="node_modules/lightningcss-darwin-arm64"
TOP_BINARY="$TOP_LC/lightningcss.darwin-arm64.node"

if [ -d "$TOP_LC" ] && [ ! -f "$TOP_BINARY" ]; then
  # Detect version from package.json
  TOP_VERSION=$(node -p "require('./node_modules/lightningcss/package.json').version" 2>/dev/null || echo "1.31.1")
  echo "[fix-lightningcss] Installing top-level lightningcss-darwin-arm64@$TOP_VERSION..."
  TMPDIR=$(mktemp -d)
  (cd "$TMPDIR" && npm pack "lightningcss-darwin-arm64@$TOP_VERSION" --quiet 2>/dev/null)
  mkdir -p "$TOP_PKG"
  tar -xzf "$TMPDIR"/lightningcss-darwin-arm64-*.tgz -C "$TOP_PKG" --strip-components=1
  cp "$TOP_PKG/lightningcss.darwin-arm64.node" "$TOP_BINARY"
  rm -rf "$TMPDIR"
  echo "[fix-lightningcss] Top-level binary installed."
else
  echo "[fix-lightningcss] Top-level binary OK (or not needed)."
fi

echo "[fix-lightningcss] Done."
