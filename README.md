# Spora

The "Zero-Latency" Local Vault for AI Agentic Workflows.

Spora is a local-first, OpenAI-compatible AI gateway and API key wallet designed for developers who demand the highest performance and absolute privacy. Built from the ground up in Rust (Axum) and Tauri v2, Spora eliminates the latency bottlenecks of Python-based gateways while keeping your data strictly on your machine.

The performance of an enterprise gateway with the privacy of a local wallet.

# Core Values

### Data Sovereignty and Security
Your prompts, your keys, your infrastructure. Spora brings zero-trust security to your local agentic workflows. All sensitive data is stored in a hardened local SQLite vault. By using the OS Keychain and SQLCipher architecture, Spora ensures that nothing leaves your machine.

### Zero-Latency Performance
Leveraging Rust's memory safety and speed, Spora provides a high-performance alternative to existing tools. While Python-based solutions hit a latency ceiling, Spora is optimized for the speed required by modern autonomous agents and real-time IDE interactions.

### Agent and IDE Ready
One Spora key to rule them all. Seamlessly switch between 100+ models in your favorite IDE. Spora acts as a drop-in replacement for the OpenAI SDK. Simply change your base URL and you are ready to use Spora with Cursor, Claude Code, and any other autonomous agent.

# The Prosumer Dashboard

Spora distinguishes itself with a powerful analytics panel designed for granular observability.
*   Real-time Cost Accounting: Track every token and cent to avoid surprise API bills.
*   Granular Observability: Detailed audit logs and performance metrics for all your local AI traffic.
*   Zero-Config UI: A beautiful, modern interface that works out of the box.

# Quick Start

### Prerequisites

*   Rust 1.77+ (rustup installed)
*   Node.js 18+
*   npm 9+
*   Xcode CLI (macOS)

### Install and Run (Development)

```bash
# Install npm dependencies
npm install

# Run in dev mode (hot-reload UI + Rust backend)
npx tauri dev
```

### Build for Production

```bash
npx tauri build
```

The distributable .dmg / .app will be in src-tauri/target/release/bundle/.

# Architecture

Spora is built with a clear separation of concerns:
*   Frontend: React/TypeScript with Vite and TailwindCSS for a responsive prosumer experience.
*   Backend: Rust (Axum) for high-performance request routing and provider translation.
*   Storage: Local SQLite vault for secure, offline-first data management.

# Using with Cursor and OpenAI-compatible clients

1. Start the gateway by clicking Start Gateway in the app.
2. Create a Spora Key in the Keys Wallet tab.
3. In Cursor Settings -> AI -> Base URL: http://localhost:4141/v1
4. API Key: your sk-spora-... token

The proxy automatically translates requests to Anthropic or Gemini formats based on your configured provider keys.

# Security

*   All API keys stored locally in ~/.spora/spora.db (SQLite).
*   Keys encrypted at rest.
*   No telemetry and no external calls except to your configured AI providers.

# License

Public under MIT LICENSE. Created by Fisarum.
