# Security in Spora

Spora is built on the principle of Data Sovereignty. Your data and your keys belong to you, and they never leave your machine unless you are making a request to an AI provider.

## Local-First Security

Spora follows a zero-trust architecture for local workflows:

*   Local Vault: All API keys and configuration data are stored in a local SQLite database (`~/.spora/spora.db`).
*   Encryption at Rest: Sensitive data in the database is encrypted.
*   OS Keychain Integration: Spora leverages the operating system's secure keychain (via Tauri's secure storage) to manage encryption keys.
*   Zero Telemetry: Spora does not include any tracking, telemetry, or external reporting. The only outgoing network calls are those you explicitly configure to your AI providers.

## Privacy for AI Workflows

By using Spora as your local gateway, you gain additional layers of privacy:

*   Request Auditing: You have a complete local record of every prompt sent and every response received.
*   No Third-Party Logging: Unlike cloud-based gateways, Spora ensures that your interaction history remains on your local disk.
*   Key Isolation: Your actual provider keys (OpenAI, Anthropic, etc.) are never exposed to your IDE or agents. They only see your local Spora key.

## Best Practices

To maintain the security of your Spora installation:

1. Keep your Spora keys private: Treat your `sk-spora-...` keys with the same care as your provider keys.
2. Secure your local machine: Since Spora stores data locally, the security of your machine's filesystem is the foundation of your data privacy.
3. Regular Backups: Periodically back up your `~/.spora` directory to prevent data loss.
