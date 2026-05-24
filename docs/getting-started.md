# Getting Started with Spora

Spora is a local-first AI gateway. The fastest way to get a working gateway is Docker.

## Run the Gateway

From this repository:

```bash
./install.sh
```

The installer builds and starts the headless gateway, then waits for:

```bash
curl http://localhost:4141/health
```

Expected result:

```json
{"service":"spora-gateway","status":"ok"}
```

Use this base URL in OpenAI-compatible tools:

```text
http://localhost:4141/v1
```

## Provider and Spora Keys

The gateway can start without provider API keys. Health checks work immediately.

Model requests require:

1. A Spora key.
2. A provider key for the selected provider or routed model.

Today, key management is handled by the Tauri desktop app and stored in local SQLite.

## Desktop App Development

Use this path if you are developing the desktop UI:

```bash
npm install
npx tauri dev
```

## OpenAI SDK Example

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:4141/v1",
    api_key="your-sk-spora-key",
)

response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "Hello Spora!"}],
)
```
