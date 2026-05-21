# Spora Installation Guide

Spora can be installed as a full desktop application (with a GUI) or as a headless background daemon (for servers/CLI tools).

## 🚀 Quick Start (Daemon Only)

If you only need the background engine for tools like Cursor or Claude Code:

### macOS & Linux (inc. WSL)
```bash
curl -fsSL https://raw.githubusercontent.com/Fisarum/Spora/main/install.sh | sh
```

### Windows
Run this in PowerShell as Administrator:
```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12; iex ((New-Object System.Net.WebClient).DownloadString('https://raw.githubusercontent.com/Fisarum/Spora/main/install-daemon.ps1'))
```

---

## 🛠️ Full Desktop App Build (GUI)

To build the interactive dashboard and the gateway, follow these steps.

### Prerequisites
- **Node.js**: v18 or later
- **Rust**: v1.86 or later (required for Edition 2024 support)
- **System Dependencies**:
  - **macOS**: Xcode Command Line Tools (`xcode-select --install`)
  - **Linux**: `build-essential`, `curl`, `wget`, `libssl-dev`, `libwebkit2gtk-4.1-dev`, `librsvg2-dev`
  - **Windows**: [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) and C++ Build Tools.

### Build Steps
```bash
# 1. Clone & Enter
git clone https://github.com/Fisarum/Spora.git
cd Spora

# 2. Install Frontend Dependencies
npm install

# 3. Build for your OS
npm run tauri build
```
The resulting installer will be located in `src-tauri/target/release/bundle/`.

---

## 🐳 Docker Installation (Universal Headless)

Docker is the most stable way to run the Spora engine on any platform without installing system dependencies.

```bash
# Build and start in detached mode
docker compose up --build -d

# Verify connectivity
curl http://localhost:4141/health
```

---

## 📋 Comparison of Methods

| Feature | Standard Build | `install.sh` | Docker |
| :--- | :--- | :--- | :--- |
| **Output** | `.dmg` / `.exe` / `.deb` | Background Service | Container |
| **GUI Dashboard** | ✅ Yes | ❌ No | ❌ No |
| **Auto-update** | ✅ Built-in | ❌ Manual | ❌ Via Image |
| **Platform** | Mac, Win, Linux | Mac, Linux, WSL | Any w/ Docker |

---

## ⚙️ Configuration

Once running, Spora is available at `http://localhost:4141`.

- **Base URL for AI Tools**: `http://localhost:4141/v1`
- **API Key**: `sk-spora-xxxx` (Generate yours in the Spora Dashboard)
