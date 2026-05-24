#!/usr/bin/env sh
# Spora Gateway - Docker-first installer
# Supports macOS, Linux, Ubuntu, and WSL with Docker Engine or Docker Desktop.

set -eu

PROJECT_NAME="${SPORA_COMPOSE_PROJECT:-spora}"
SERVICE_NAME="${SPORA_SERVICE_NAME:-spora-gateway}"
PORT="${SPORA_PORT:-4141}"
HEALTH_URL="http://localhost:${PORT}/health"
BASE_URL="http://localhost:${PORT}/v1"
IMAGE="${SPORA_IMAGE:-ghcr.io/fisarum/spora-gateway:latest}"

green() { printf '\033[0;32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[0;33m%s\033[0m\n' "$*"; }
red() { printf '\033[0;31m%s\033[0m\n' "$*" >&2; }
die() { red "Error: $*"; exit 1; }

usage() {
    cat <<USAGE
Usage: ./install.sh [--no-build] [--image IMAGE]

Starts the Spora gateway with Docker Compose and waits for:
  ${HEALTH_URL}

Options:
  --no-build      Use a registry image instead of building from this checkout.
  --image IMAGE   Registry image to use with --no-build.
USAGE
}

BUILD_LOCAL=1
while [ "$#" -gt 0 ]; do
    case "$1" in
        --no-build)
            BUILD_LOCAL=0
            shift
            ;;
        --image)
            [ "$#" -ge 2 ] || die "--image requires a value"
            IMAGE="$2"
            BUILD_LOCAL=0
            shift 2
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            die "Unknown argument: $1"
            ;;
    esac
done

OS="$(uname -s 2>/dev/null || printf unknown)"
case "$OS" in
    Darwin) PLATFORM="macOS" ;;
    Linux)
        if grep -qi microsoft /proc/version 2>/dev/null; then
            PLATFORM="WSL"
        else
            PLATFORM="Linux"
        fi
        ;;
    *) die "Unsupported OS: ${OS}. On Windows, use Docker Desktop with WSL2 or run install.ps1." ;;
esac

print_docker_help() {
    red "Docker was not found or is not running."
    case "$PLATFORM" in
        macOS)
            red "Install Docker Desktop for Mac, start it, then run ./install.sh again:"
            red "  https://docs.docker.com/desktop/install/mac-install/"
            ;;
        WSL)
            red "Install Docker Desktop for Windows, enable WSL2 integration for your Ubuntu distro, then run ./install.sh again:"
            red "  https://docs.docker.com/desktop/wsl/"
            ;;
        Linux)
            red "Install Docker Engine and the Compose plugin, then run ./install.sh again:"
            red "  https://docs.docker.com/engine/install/"
            ;;
    esac
}

command -v docker >/dev/null 2>&1 || { print_docker_help; exit 1; }
docker info >/dev/null 2>&1 || { print_docker_help; exit 1; }

if docker compose version >/dev/null 2>&1; then
    COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE="docker-compose"
else
    die "Docker Compose is missing. Install Docker Desktop or the Docker Compose plugin."
fi

health_check() {
    if command -v curl >/dev/null 2>&1; then
        curl -fsS "$HEALTH_URL" >/dev/null 2>&1
    elif command -v wget >/dev/null 2>&1; then
        wget -qO- "$HEALTH_URL" >/dev/null 2>&1
    else
        die "Need curl or wget to verify ${HEALTH_URL}"
    fi
}

wait_for_health() {
    yellow "Waiting for Spora health check at ${HEALTH_URL}..."
    i=0
    while [ "$i" -lt 60 ]; do
        if health_check; then
            return 0
        fi
        i=$((i + 1))
        sleep 1
    done
    return 1
}

green "Starting Spora gateway with Docker on ${PLATFORM}..."

COMPOSE_FILE=""
if [ "$BUILD_LOCAL" -eq 1 ] && [ -f "docker-compose.yml" ] && [ -f "Dockerfile" ]; then
    $COMPOSE -p "$PROJECT_NAME" up --build -d "$SERVICE_NAME"
else
    TMP_DIR="${TMPDIR:-/tmp}/spora-install-compose"
    mkdir -p "$TMP_DIR"
    COMPOSE_FILE="${TMP_DIR}/compose.yml"
    cat > "$COMPOSE_FILE" <<YAML
services:
  spora-gateway:
    image: ${IMAGE}
    container_name: spora-gateway
    restart: unless-stopped
    ports:
      - "127.0.0.1:${PORT}:${PORT}"
    volumes:
      - spora_data:/data
    environment:
      SPORA_LISTEN_ADDR: "0.0.0.0"
      SPORA_PORT: "${PORT}"
      SPORA_DB_PATH: "/data/spora.db"
      SPORA_ANALYTICS_MODE: "local"
      RUST_LOG: "info"
    healthcheck:
      test: ["CMD", "curl", "-fsS", "http://localhost:${PORT}/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 5s

volumes:
  spora_data:
    driver: local
YAML
    $COMPOSE -p "$PROJECT_NAME" -f "$COMPOSE_FILE" up -d
fi

if wait_for_health; then
    green "Spora is running."
    green ""
    green "Base URL: ${BASE_URL}"
    green "Health:   ${HEALTH_URL}"
    green ""
    green "Use this base URL in OpenAI-compatible tools."
    green "Use a Spora key from your local Spora database when proxying model requests."
else
    red "Spora did not become healthy within 60 seconds."
    red "Recent container logs:"
    if [ -n "$COMPOSE_FILE" ]; then
        $COMPOSE -p "$PROJECT_NAME" -f "$COMPOSE_FILE" logs --tail=80 "$SERVICE_NAME" >&2 || true
    else
        $COMPOSE -p "$PROJECT_NAME" logs --tail=80 "$SERVICE_NAME" >&2 || true
    fi
    exit 1
fi
