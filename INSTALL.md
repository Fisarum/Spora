# Spora Installation Guide

Spora has two runtimes:

- Docker gateway: headless `spora-daemon` for local AI tools and self-hosted use.
- Desktop app: Tauri UI for managing keys, settings, logs, and analytics.

For a first run, use Docker. It avoids local Rust, Node, WebKit, and platform build dependencies.

## Docker Quick Start

From a checkout of this repository:

```bash
./install.sh
```

The installer builds and starts the gateway with Docker Compose, stores SQLite state in the named Docker volume `spora_data`, and waits for health before reporting success.

Expected output includes:

```text
Spora is running.

Base URL: http://localhost:4141/v1
Health:   http://localhost:4141/health
```

## Platform Notes

### macOS Apple Silicon

1. Install Docker Desktop for Mac with Apple Silicon support.
2. Start Docker Desktop.
3. Run `./install.sh` from the repository.

The image is built for `linux/arm64` on Apple Silicon.

### macOS Intel

1. Install Docker Desktop for Mac.
2. Start Docker Desktop.
3. Run `./install.sh` from the repository.

The image is built for `linux/amd64` on Intel Macs.

### Linux x64

1. Install Docker Engine and the Docker Compose plugin.
2. Make sure your user can run Docker, or run the install command with the Docker permissions your system requires.
3. Run `./install.sh` from the repository.

### Ubuntu

Install Docker Engine from Docker's Ubuntu instructions, then run:

```bash
./install.sh
```

### Windows with Docker Desktop

Recommended path:

1. Install Docker Desktop for Windows.
2. Enable the WSL2 backend in Docker Desktop.
3. Enable integration for your Ubuntu WSL distro.
4. Open Ubuntu/WSL, clone the repository, and run `./install.sh`.

You can also run this from PowerShell in the repository:

```powershell
.\install.ps1
```

### WSL Ubuntu

Use Docker Desktop with WSL2 integration enabled for the Ubuntu distro, then run:

```bash
./install.sh
```

## Verify

```bash
curl http://localhost:4141/health
```

Expected response:

```json
{"service":"spora-gateway","status":"ok"}
```

OpenAI-compatible tools should use:

- Base URL: `http://localhost:4141/v1`
- API key: a Spora key from your local Spora database

The gateway can boot without provider API keys. Model requests require a valid Spora key and a configured provider key.

## Configuration

Docker Compose sets these defaults:

| Variable | Default | Purpose |
| --- | --- | --- |
| `SPORA_LISTEN_ADDR` | `0.0.0.0` | Interface inside the container |
| `SPORA_PORT` | `4141` | Gateway HTTP port |
| `SPORA_DB_PATH` | `/data/spora.db` | SQLite database path |
| `SPORA_ANALYTICS_MODE` | `local` | Placeholder for local-only analytics mode |
| `RUST_LOG` | `info` | Rust logging level |

Persistent state lives in the named Docker volume `spora_data`.

## Desktop App Development

Use this path only when developing the Tauri UI:

```bash
npm install
npx tauri dev
```

Build a desktop release:

```bash
npx tauri build
```
