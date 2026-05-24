$ErrorActionPreference = "Stop"

$ProjectName = if ($env:SPORA_COMPOSE_PROJECT) { $env:SPORA_COMPOSE_PROJECT } else { "spora" }
$ServiceName = if ($env:SPORA_SERVICE_NAME) { $env:SPORA_SERVICE_NAME } else { "spora-gateway" }
$Port = if ($env:SPORA_PORT) { $env:SPORA_PORT } else { "4141" }
$HealthUrl = "http://localhost:$Port/health"
$BaseUrl = "http://localhost:$Port/v1"
$Image = if ($env:SPORA_IMAGE) { $env:SPORA_IMAGE } else { "ghcr.io/fisarum/spora-gateway:latest" }
$BuildLocal = $true

for ($i = 0; $i -lt $args.Count; $i++) {
    switch ($args[$i]) {
        "--no-build" { $BuildLocal = $false }
        "--image" {
            if ($i + 1 -ge $args.Count) { throw "--image requires a value" }
            $Image = $args[$i + 1]
            $BuildLocal = $false
            $i++
        }
        "-h" {
            Write-Host "Usage: .\install.ps1 [--no-build] [--image IMAGE]"
            exit 0
        }
        "--help" {
            Write-Host "Usage: .\install.ps1 [--no-build] [--image IMAGE]"
            exit 0
        }
        default { throw "Unknown argument: $($args[$i])" }
    }
}

function Fail-Docker {
    Write-Error @"
Docker was not found or is not running.

Install Docker Desktop for Windows, enable the WSL2 backend, and start Docker Desktop:
https://docs.docker.com/desktop/install/windows-install/

Recommended path:
1. Install Docker Desktop.
2. Enable "Use the WSL 2 based engine".
3. Enable integration for your Ubuntu WSL distro.
4. Run ./install.sh inside WSL Ubuntu, or run .\install.ps1 from this repository.
"@
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Fail-Docker
    exit 1
}

try {
    docker info *> $null
} catch {
    Fail-Docker
    exit 1
}

try {
    docker compose version *> $null
} catch {
    throw "Docker Compose is missing. Install or update Docker Desktop."
}

Write-Host "Starting Spora gateway with Docker..."

$ComposeFile = $null
if ($BuildLocal -and (Test-Path "docker-compose.yml") -and (Test-Path "Dockerfile")) {
    docker compose -p $ProjectName up --build -d $ServiceName
} else {
    $ComposeDir = Join-Path $env:TEMP "spora-install-compose"
    New-Item -ItemType Directory -Force -Path $ComposeDir | Out-Null
    $ComposeFile = Join-Path $ComposeDir "compose.yml"
    @"
services:
  spora-gateway:
    image: $Image
    container_name: spora-gateway
    restart: unless-stopped
    ports:
      - "127.0.0.1:${Port}:${Port}"
    volumes:
      - spora_data:/data
    environment:
      SPORA_LISTEN_ADDR: "0.0.0.0"
      SPORA_PORT: "$Port"
      SPORA_DB_PATH: "/data/spora.db"
      SPORA_ANALYTICS_MODE: "local"
      RUST_LOG: "info"
    healthcheck:
      test: ["CMD", "curl", "-fsS", "http://localhost:${Port}/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 5s

volumes:
  spora_data:
    driver: local
"@ | Set-Content -Path $ComposeFile -Encoding utf8
    docker compose -p $ProjectName -f $ComposeFile up -d
}

Write-Host "Waiting for Spora health check at $HealthUrl..."
$Healthy = $false
for ($i = 0; $i -lt 60; $i++) {
    try {
        Invoke-WebRequest -UseBasicParsing -Uri $HealthUrl -TimeoutSec 2 | Out-Null
        $Healthy = $true
        break
    } catch {
        Start-Sleep -Seconds 1
    }
}

if (-not $Healthy) {
    Write-Error "Spora did not become healthy within 60 seconds."
    if ($ComposeFile) {
        docker compose -p $ProjectName -f $ComposeFile logs --tail=80 $ServiceName
    } else {
        docker compose -p $ProjectName logs --tail=80 $ServiceName
    }
    exit 1
}

Write-Host "Spora is running."
Write-Host ""
Write-Host "Base URL: $BaseUrl"
Write-Host "Health:   $HealthUrl"
Write-Host ""
Write-Host "Use this base URL in OpenAI-compatible tools."
