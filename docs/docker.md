# Spora Gateway — Docker & Universal Deployment

Spora ships in two distribution modes:

| Mode | Best for | Requires |
|------|----------|----------|
| **Desktop app** (Tauri) | Individual developers | macOS / Windows / Linux desktop |
| **Docker image** (headless) | Corporate pilots, shared infra, servers | Docker Engine / Docker Desktop |
| **Binary installer** (`install.sh`) | Developers without Docker | `curl` + `sh` (macOS/Linux) or PowerShell (Windows) |

---

## Docker — One-command deployment

### Option A: Pre-built image from GitHub Container Registry

```bash
docker compose up -d
```

The default `docker-compose.yml` pulls `ghcr.io/fisarum/spora-gateway:latest`, mounts a named volume for the SQLite database, and binds the proxy to `127.0.0.1:4141` on the host.

### Option B: Build the image locally

```bash
docker build -t spora-gateway .
docker run -d \
  --name spora-gateway \
  --restart unless-stopped \
  -p 127.0.0.1:4141:4141 \
  -v spora_data:/data \
  -e RUST_LOG=info \
  spora-gateway
```

### Shared team/server deployment (LAN)

To expose the gateway to other machines on your network, change the port binding in `docker-compose.yml`:

```yaml
ports:
  - "4141:4141"   # binds to all host interfaces
```

Then point your AI tools at `http://<server-ip>:4141/v1`.

> **Security note:** if the gateway is exposed on a LAN, ensure all clients use a valid `sk-spora-*` token. The spend-cap and key-revocation features in the Spora desktop app apply to these tokens.

---

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SPORA_LISTEN_ADDR` | `127.0.0.1` (binary) / `0.0.0.0` (Docker) | Interface the proxy binds to |
| `SPORA_DB_PATH` | platform data dir | Override the SQLite database path |
| `RUST_LOG` | `info` | Log verbosity (`trace`, `debug`, `info`, `warn`, `error`) |

---

## Per-developer install (no Docker)

### macOS / Linux

```bash
curl -fsSL https://raw.githubusercontent.com/Fisarum/Spora/main/install.sh | sh
```

The script:
1. Detects your OS and CPU architecture
2. Downloads the matching pre-built `spora-daemon` binary from GitHub Releases
3. Installs it to `~/.local/bin/`
4. Registers a **Launch Agent** (macOS) or **systemd user service** (Linux) for auto-start on login

To install a specific version:

```bash
curl -fsSL https://raw.githubusercontent.com/Fisarum/Spora/main/install.sh | sh -s -- --version v0.1.3
```

### Windows

Run PowerShell as Administrator:

```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force
.\install-daemon.ps1
```

---

## Building the daemon binary from source

```bash
# Headless daemon — no Tauri, no GUI dependencies
cd src-tauri
cargo build --release --no-default-features --features daemon --bin spora-daemon

# The binary is at:
./target/release/spora-daemon          # Linux / macOS
./target/release/spora-daemon.exe      # Windows (cross-compiled)
```

---

## Verifying the gateway

```bash
curl http://localhost:4141/health
# {"status":"ok","service":"spora-gateway"}
```

---

## Corporate IT checklist

- [ ] Docker Engine 20.10+ (or Docker Desktop) installed on each developer machine, OR `spora-daemon` binary distributed via internal software catalogue
- [ ] Outbound HTTPS allowed to provider APIs: `api.openai.com`, `api.anthropic.com`, `generativelanguage.googleapis.com`, `openrouter.ai`
- [ ] Port `4141` reachable on `localhost` (no local firewall blocking it)
- [ ] Developer IDE configured with `base_url = http://localhost:4141/v1` and a `sk-spora-*` token
