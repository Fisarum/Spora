# Getting Started with Spora

This guide will walk you through setting up Spora on your local machine and configuring it for your AI workflows.

## Prerequisites

Before installing Spora, ensure you have the following installed:

*   Rust 1.77 or later: Install via [rustup.rs](https://rustup.rs/).
*   Node.js 18 or later.
*   npm 9 or later.
*   macOS users: Xcode Command Line Tools (`xcode-select --install`).

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Fisarum/Spora.git
   cd Spora
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the application in development mode:
   ```bash
   npx tauri dev
   ```

## Initial Configuration

When you first launch Spora, you will be greeted by the Prosumer Dashboard.

1. Add your Provider Keys: Navigate to the Keys Wallet tab and add your API keys for providers like OpenAI, Anthropic, or Google Gemini.
2. Generate a Spora Key: Create a local Spora API key. This key will be used by your local applications to talk to the Spora gateway.
3. Start the Gateway: Click the Start Gateway button to initialize the local Axum server.

## Integration Examples

### Cursor IDE
1. Open Cursor Settings.
2. Go to AI -> Models.
3. Set the Base URL to `http://localhost:4141/v1`.
4. Use your Spora API key.

### OpenAI SDK (Python)
```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:4141/v1",
    api_key="your-sk-spora-key"
)

response = client.chat.completions.create(
    model="gpt-4",
    messages=[{"role": "user", "content": "Hello Spora!"}]
)
```
