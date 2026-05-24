# ──────────────────────────────────────────────────────────────────────────────
# Stage 1: Build — compile spora-daemon without any Tauri / GUI dependencies
# ──────────────────────────────────────────────────────────────────────────────
FROM rust:1.86-slim AS builder

RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

COPY src-tauri/Cargo.toml src-tauri/Cargo.lock ./
COPY src-tauri/build.rs ./

# Warm the dependency cache with a stub source tree before copying the real code.
# This layer is only invalidated when Cargo.toml / Cargo.lock change.
RUN mkdir -p src/bin src/proxy/adapters src/commands src/db && \
    echo 'fn main() {}' > src/main.rs && \
    echo 'fn main() {}' > src/bin/daemon.rs && \
    printf 'pub mod router;\npub mod middleware;\npub mod adapters;\n' > src/proxy/mod.rs && \
    touch src/proxy/router.rs src/proxy/middleware.rs && \
    printf 'pub mod openai;\npub mod anthropic;\npub mod gemini;\npub mod openrouter;\n' > src/proxy/adapters/mod.rs && \
    touch src/proxy/adapters/openai.rs src/proxy/adapters/anthropic.rs \
          src/proxy/adapters/gemini.rs src/proxy/adapters/openrouter.rs && \
    printf 'pub mod db;\npub mod proxy;\npub mod state;\npub mod error;\n' > src/lib.rs && \
    touch src/db/mod.rs src/state.rs src/error.rs src/commands/mod.rs && \
    cargo build --release --no-default-features --features daemon --bin spora-daemon 2>/dev/null || true && \
    rm -rf src

# Copy the real source and build the final binary
COPY src-tauri/src ./src
RUN cargo build --release --no-default-features --features daemon --bin spora-daemon

# ──────────────────────────────────────────────────────────────────────────────
# Stage 2: Runtime — minimal image, no build tools, no Rust toolchain
# ──────────────────────────────────────────────────────────────────────────────
FROM debian:12-slim AS runtime

RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN useradd --system --no-create-home --shell /bin/false spora

COPY --from=builder /build/target/release/spora-daemon /usr/local/bin/spora-daemon
RUN chmod +x /usr/local/bin/spora-daemon

# /data is the persistent volume mount point for the SQLite database
RUN mkdir -p /data && chown spora:spora /data

USER spora

# Bind to all interfaces inside the container; map to 127.0.0.1 on the host
# via docker-compose or -p 127.0.0.1:4141:4141 to keep traffic local
ENV SPORA_LISTEN_ADDR=0.0.0.0
ENV SPORA_DB_PATH=/data/spora.db
ENV SPORA_PORT=4141
ENV SPORA_ANALYTICS_MODE=local
ENV RUST_LOG=info

EXPOSE 4141

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -fsS "http://localhost:${SPORA_PORT:-4141}/health"

ENTRYPOINT ["/usr/local/bin/spora-daemon"]
