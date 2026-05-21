#!/usr/bin/env sh
# Spora Gateway — universal daemon installer
# Supports: macOS (arm64/x86_64), Linux (arm64/x86_64)
# Windows: use install-daemon.ps1
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/Fisarum/Spora/main/install.sh | sh
#   or: sh install.sh [--version v0.1.3]

set -e

REPO="Fisarum/Spora"
BIN_NAME="spora-daemon"
INSTALL_DIR="${HOME}/.local/bin"

# ── Colour helpers ─────────────────────────────────────────────────────────────
green()  { printf '\033[0;32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[0;33m%s\033[0m\n' "$*"; }
red()    { printf '\033[0;31m%s\033[0m\n' "$*"; }
die()    { red "Error: $*" >&2; exit 1; }

# ── Detect OS ─────────────────────────────────────────────────────────────────
OS="$(uname -s)"
case "$OS" in
    Darwin) PLATFORM="macos" ;;
    Linux)  PLATFORM="linux" ;;
    *)      die "Unsupported OS: $OS. On Windows, use install-daemon.ps1." ;;
esac

# ── Detect arch ───────────────────────────────────────────────────────────────
ARCH="$(uname -m)"
case "$ARCH" in
    x86_64)        ARCH_SLUG="x86_64" ;;
    arm64|aarch64) ARCH_SLUG="aarch64" ;;
    *)             die "Unsupported architecture: $ARCH" ;;
esac

# ── Resolve version ───────────────────────────────────────────────────────────
VERSION=""
while [ "$#" -gt 0 ]; do
    case "$1" in
        --version) VERSION="$2"; shift 2 ;;
        *) die "Unknown argument: $1" ;;
    esac
done

if [ -z "$VERSION" ]; then
    yellow "Fetching latest release version..."
    VERSION="$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" \
        | grep '"tag_name"' | sed -E 's/.*"([^"]+)".*/\1/')"
    [ -n "$VERSION" ] || die "Could not determine latest version. Pass --version manually."
fi

green "Installing Spora daemon ${VERSION} (${PLATFORM}/${ARCH_SLUG})..."

# ── Download binary ───────────────────────────────────────────────────────────
BINARY_URL="https://github.com/${REPO}/releases/download/${VERSION}/${BIN_NAME}-${PLATFORM}-${ARCH_SLUG}"
TMP="$(mktemp)"

yellow "Downloading ${BINARY_URL}..."
curl -fsSL --progress-bar "$BINARY_URL" -o "$TMP" \
    || die "Download failed. Check that ${VERSION} exists at https://github.com/${REPO}/releases"

mkdir -p "$INSTALL_DIR"
mv "$TMP" "${INSTALL_DIR}/${BIN_NAME}"
chmod +x "${INSTALL_DIR}/${BIN_NAME}"

# ── Add to PATH warning ───────────────────────────────────────────────────────
case ":${PATH}:" in
    *":${INSTALL_DIR}:"*) ;;
    *) yellow "Note: add '${INSTALL_DIR}' to your PATH (e.g. in ~/.zshrc or ~/.bashrc):" ;
       yellow "  export PATH=\"\$PATH:${INSTALL_DIR}\"" ;;
esac

# ── Install platform daemon service ───────────────────────────────────────────
case "$PLATFORM" in
    macos)
        PLIST_DIR="${HOME}/Library/LaunchAgents"
        PLIST_PATH="${PLIST_DIR}/com.spora.gateway.daemon.plist"
        mkdir -p "$PLIST_DIR"

        cat > "$PLIST_PATH" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.spora.gateway.daemon</string>
    <key>ProgramArguments</key>
    <array>
        <string>${INSTALL_DIR}/${BIN_NAME}</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${HOME}/Library/Logs/spora-daemon.log</string>
    <key>StandardErrorPath</key>
    <string>${HOME}/Library/Logs/spora-daemon-error.log</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>RUST_LOG</key>
        <string>info</string>
    </dict>
</dict>
</plist>
PLIST

        launchctl unload "$PLIST_PATH" 2>/dev/null || true
        launchctl load "$PLIST_PATH"
        green "Spora daemon installed and started (macOS Launch Agent)."
        ;;

    linux)
        SYSTEMD_DIR="${HOME}/.config/systemd/user"
        mkdir -p "$SYSTEMD_DIR"

        cat > "${SYSTEMD_DIR}/spora-daemon.service" <<SERVICE
[Unit]
Description=Spora Gateway Daemon
Documentation=https://github.com/Fisarum/Spora
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=${INSTALL_DIR}/${BIN_NAME}
Restart=always
RestartSec=5
Environment=RUST_LOG=info

[Install]
WantedBy=default.target
SERVICE

        systemctl --user daemon-reload
        systemctl --user enable --now spora-daemon
        green "Spora daemon installed and started (systemd user service)."
        ;;
esac

# ── Verify ────────────────────────────────────────────────────────────────────
yellow "Waiting for gateway to start..."
sleep 2

if curl -fsSL http://localhost:4141/health >/dev/null 2>&1; then
    green "Gateway is up at http://localhost:4141"
    green ""
    green "  Base URL : http://localhost:4141/v1"
    green "  Health   : http://localhost:4141/health"
    green ""
    green "Configure your AI tool (Cursor, Claude Code, etc.):"
    green "  base_url = http://localhost:4141/v1"
    green "  api_key  = sk-spora-<your-token>"
else
    yellow "Gateway did not respond yet — it may still be starting."
    yellow "Check with: curl http://localhost:4141/health"
fi
