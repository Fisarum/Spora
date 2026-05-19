# API Documentation

Spora provides an OpenAI-compatible API that acts as a universal bridge for all your AI providers.

## Base URL

The default base URL for the Spora gateway is:
`http://localhost:4141/v1`

## Authentication

All requests to Spora must include your Spora API key in the Authorization header:
`Authorization: Bearer sk-spora-your-key`

## Supported Endpoints

### Chat Completions
`POST /chat/completions`

Spora supports the standard OpenAI chat completions schema. You can use this endpoint to talk to any configured provider.

**Example Request:**
```bash
curl http://localhost:4141/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SPORA_KEY" \
  -d '{
    "model": "claude-3-5-sonnet",
    "messages": [{"role": "user", "content": "How fast is Rust?"}]
  }'
```

### Models
`GET /models`

Returns a list of all models available through your configured providers.

## Provider Translation

Spora automatically handles the translation of requests to different provider formats:

*   OpenAI: Passthrough with usage tracking.
*   Anthropic: Translates OpenAI messages to Anthropic's messages API.
*   Google Gemini: Translates OpenAI messages to Gemini's content format.

To use a specific provider, ensure you have added the corresponding key in the Spora UI. You can then use the model IDs associated with that provider in your API requests.

## Error Handling

Spora returns standard HTTP error codes:
*   401 Unauthorized: Invalid or missing Spora key.
*   402 Payment Required: Provider spend cap reached.
*   404 Not Found: Model or endpoint not found.
*   500 Internal Server Error: Gateway error or provider downtime.
