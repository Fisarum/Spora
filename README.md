<p align="center">
  <img src="src-tauri/assets/logo.png" width="140" alt="Spora Logo" />
</p>

<h1 align="center">Spora</h1>

<p align="center">
  <b>High Performance Local AI Gateway and API Key Wallet</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-white?style=flat-square" alt="License" />
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-white?style=flat-square" alt="Platforms" />
  <img src="https://img.shields.io/badge/version-v0.1.3-blue?style=flat-square" alt="Version" />
</p>

Spora is a local-first, AI gateway and API key wallet designed for developers who demand the highest performance and absolute privacy. Built from the ground up in Rust (Axum) and Tauri v2, Spora eliminates the latency bottlenecks of Python-based gateways while keeping your data strictly on your machine.

The performance of an enterprise gateway with the privacy of a local wallet.

## Principles of Design

### Data Sovereignty
Your prompts and secrets never leave your infrastructure. Spora employs a local first architecture where all provider keys and usage logs are stored in a hardened SQLite vault on your machine. This zero trust approach ensures that sensitive intellectual property remains private even when using public LLM providers.

### High Fidelity Performance
While Python based gateways often introduce significant latency overhead, Spora is engineered in Rust to handle high frequency requests from autonomous agents and real time IDE integrations. It is optimized for the sub second responsiveness required by modern agentic frameworks.

### Unified Developer Experience
Integrate Spora once and access over 100 models from OpenAI, Anthropic, Gemini, and OpenRouter. It serves as a drop in replacement for any OpenAI SDK compatible tool. Simply point your base URL to the local proxy and manage all model routing through a single Sk-Spora token.

## Technical Capabilities

### Intelligent Analytics Dashboard
Monitor your AI infrastructure with a high fidelity observability suite designed for transparency.
* **Real Time Cost Tracking**: Granular accounting for every token and request to prevent unforeseen expenses.
* **Dynamic Interaction**: Interactive metric cards that update instantly on hover to show specific model performance.
* **Long Term Insight**: Integrated 365 day activity heatmap for visualizing usage patterns over time.
* **Multi Dimensional Filters**: Analyze data by model, provider, or specific Spora keys across 17 timeframe ranges.

### Comprehensive Audit Logging
Gain full visibility into how your agents interact with LLMs.
* **Payload Inspection**: View formatted request and response JSON for every generation to debug agent behavior.
* **Session Tracking**: Group related requests into logical sessions to follow complex multi step conversations.
* **Performance Benchmarking**: Track tokens per second and latency for every individual provider interaction.

### Modern Architecture
* **Frontend**: React and TypeScript with TailwindCSS for a responsive, prosumer grade UI.
* **Backend**: High performance Axum server implemented in Rust for reliable request routing.
* **Storage**: Local SQLite persistence for secure, offline first state management.

## Getting Started

### Prerequisites
* Rust 1.77+
* Node.js 18+
* Xcode CLI (for macOS users)

### Installation
```bash
# Clone the repository and install dependencies
npm install

# Run in development mode
npx tauri dev

# Build for production
npx tauri build
```

## Integration Guide
1. Launch Spora and initialize the local gateway.
2. Add your provider keys in the Settings panel.
3. Generate a Sk-Spora token in the Keys Wallet.
4. Configure your application or IDE (such as Cursor or Claude Code):
   * **Base URL**: `http://localhost:4141/v1`
   * **API Key**: `sk-spora-your-token`

The gateway automatically handles protocol translation between OpenAI format and your selected provider backend.

## Security Architecture
All cryptographic material and usage logs are stored in `~/.spora/spora.db`. Spora contains no telemetry and establishes no external network connections except those explicitly directed to your configured AI providers.

## License
Published under the MIT License. Created by Fisarum.
