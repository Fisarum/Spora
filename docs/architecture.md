# Architecture of Spora

Spora is built with a high-performance, local-first architecture that combines the speed of Rust with the flexibility of React.

## System Overview

Spora consists of three main components:

1. Frontend (React/TypeScript): The user interface for managing keys, viewing analytics, and configuring the gateway.
2. Backend (Rust/Tauri): The bridge between the UI and the system, managing the lifecycle of the gateway.
3. Gateway (Axum): A high-performance HTTP server that proxies and translates AI requests.

## Component Breakdown

### Frontend
The frontend is built using Vite, TailwindCSS, and React. It communicates with the Rust backend via Tauri's IPC (Inter-Process Communication).
*   Keys Wallet: Manages the encrypted storage of provider keys.
*   Analytics: Visualizes token usage and costs using Recharts.
*   Settings: Manages gateway configuration and database maintenance.

### Backend (Rust)
The Rust backend is the heart of Spora. It handles:
*   Secure Storage: Interface with the local SQLite database.
*   Process Management: Starting and stopping the Axum gateway.
*   Encryption: Managing the local vault security.

### Gateway (Axum)
The gateway runs on `localhost:4141` and provides an OpenAI-compatible interface.
*   Router: Handles `/v1/chat/completions` and other standard endpoints.
*   Middleware: Manages authentication, logging, and spend-cap enforcement.
*   Adapters: Logic for translating OpenAI-format requests into Anthropic, Gemini, or other provider-specific formats.

## Data Flow

1. A local client (e.g., Cursor) sends an OpenAI-compatible request to `http://localhost:4141/v1`.
2. The Axum gateway authenticates the request using the Spora key.
3. The gateway identifies the target provider and model.
4. The gateway retrieves the corresponding provider key from the secure vault.
5. The request is translated and forwarded to the provider.
6. The response is translated back to OpenAI format and returned to the client.
7. Usage data is asynchronously logged to the local SQLite database for analytics.
