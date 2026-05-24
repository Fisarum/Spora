# Spora Docker Deployment

Docker runs the headless Spora gateway (`spora-daemon`) only. The Tauri desktop UI is not part of the container.

## One-command Local Run

From a checkout of the repository:

```bash
./install.sh
```

The script:

1. Checks that Docker and Docker Compose are available.
2. Builds the daemon image from the local source tree.
3. Starts the `spora-gateway` service.
4. Persists SQLite state in the named volume `spora_data`.
5. Waits for `http://localhost:4141/health` before printing success.

## Manual Compose

```bash
docker compose up --build -d
curl http://localhost:4141/health
```

The gateway listens on the host at:

- Base URL: `http://localhost:4141/v1`
- Health: `http://localhost:4141/health`

## Registry Image Mode

When a published image is available, the installer can skip local builds:

```bash
./install.sh --no-build
```

Or specify an image:

```bash
./install.sh --image ghcr.io/fisarum/spora-gateway:latest
```

## Persistence

The container stores SQLite data at `/data/spora.db`.

`docker-compose.yml` mounts this path through:

```yaml
volumes:
  - spora_data:/data
```

The volume persists provider keys, Spora keys, settings, model metadata, and request logs across restarts and image upgrades.

## Environment

| Variable | Default | Description |
| --- | --- | --- |
| `SPORA_LISTEN_ADDR` | `0.0.0.0` | Interface the daemon binds inside the container |
| `SPORA_PORT` | `4141` | Gateway port |
| `SPORA_DB_PATH` | `/data/spora.db` | SQLite database path |
| `SPORA_ANALYTICS_MODE` | `local` | Local analytics mode placeholder |
| `RUST_LOG` | `info` | Log level |

The default Compose file interpolates `SPORA_PORT`, so `SPORA_PORT=4242 ./install.sh` starts the gateway on `http://localhost:4242/v1`.

## Platform Notes

### macOS Apple Silicon

Install Docker Desktop for Mac, start it, and run `./install.sh`. Docker builds the `linux/arm64` image.

### macOS Intel

Install Docker Desktop for Mac, start it, and run `./install.sh`. Docker builds the `linux/amd64` image.

### Linux x64 and Ubuntu

Install Docker Engine and the Docker Compose plugin, then run `./install.sh`.

### Windows with Docker Desktop

Use Docker Desktop with the WSL2 backend. The recommended path is to enable integration for Ubuntu/WSL and run:

```bash
./install.sh
```

inside the WSL Ubuntu shell.

PowerShell from the repository also works:

```powershell
.\install.ps1
```

### WSL Ubuntu

Install Docker Desktop on Windows, enable WSL2 integration for the Ubuntu distro, then run `./install.sh` in WSL.

## Network Exposure

The default Compose file binds the host port to localhost only:

```yaml
ports:
  - "127.0.0.1:4141:4141"
```

For a server or LAN deployment, change it to:

```yaml
ports:
  - "4141:4141"
```

Use firewall rules and Spora key controls before exposing the gateway to other machines.

## Provider Keys

The gateway can boot without provider API keys. Health checks and database initialization work immediately.

Actual model calls require:

1. A Spora key in the local database.
2. At least one provider key configured for the target provider/model.

Those keys are currently managed by the desktop app and stored in the same SQLite schema.
