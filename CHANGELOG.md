# Changelog

All notable changes to Spora will be documented in this file.

## [0.1.2] - 2026-05-20

### Added

#### Background Daemon
- Headless gateway proxy that runs at system startup without the UI
- Cross-platform support: macOS Launch Agent, Linux systemd, and Windows Task Scheduler
- Auto-restart functionality if the daemon crashes
- Daemon uses the same secure SQLite database as the UI app for seamless sync
- AI agents can always connect to `localhost:4141` without manually opening the app
- Makefile with cross-platform build and install targets
- DAEMON.md documentation with setup instructions for all platforms

#### OpenRouter Integration
- OpenRouter provider support for adding API keys
- Automatic provider inference for `openrouter/` model prefixes
- Ability to restrict Spora keys to use only OpenRouter provider

### Changed

#### Backend
- Added `spora-daemon` binary for headless proxy operation
- Added `default-run = "spora"` to Cargo.toml to fix `tauri dev` binary ambiguity
- Made modules public (`db`, `proxy`, `state`, `error`) for daemon reuse
- Added `openrouter` adapter for API forwarding
- Updated provider inference to recognize `openrouter/` model prefix

#### Frontend
- Added `openrouter` to PROVIDER_META in KeysWallet
- Added `openrouter` to ALL_PROVIDERS in CreateSporaKeyModal
- Added OpenRouter option to AddProviderKeyModal
- Fixed TypeScript errors with missing `openrouter` in Provider type

### Fixed

- Fixed `tauri dev` error: "could not determine which binary to run" by setting default-run
- Fixed TypeScript build error TS2741: Property 'openrouter' missing in Provider metadata

## [0.1.1] - 2026-05-20

### Added

#### Automatic Updates
- Background update checking every 24 hours
- Manual update check in Settings tab
- Update notification banner when new version is available
- Download progress visualization
- One-click install and restart

#### UI Improvements
- Updates section in Settings with current version display, check button, download progress, and install button
- Update notification banner in main app window

#### Backend
- `tauri-plugin-updater` integration
- Updater commands for checking, downloading, and installing updates
- GitHub release endpoint configuration
- Signing key support for secure updates

#### Frontend
- `updaterApi` added to Tauri API bindings
- Event listeners for update progress and download completion
- Update state management throughout the app

## [0.1.0] - Initial Release

### Features

#### Core Gateway
- Local-first, OpenAI-compatible AI gateway
- Zero-latency Rust (Axum) backend
- Secure SQLite vault for API keys with OS Keychain integration
- SQLCipher encryption at rest

#### Multi-Provider Support
- OpenAI API key management
- Anthropic API key management
- Google Gemini API key management
- Automatic provider routing based on model names

#### Virtual Access Keys
- Create Spora keys to abstract provider keys
- Restrict keys to specific providers
- Set daily and monthly spend caps
- Revoke and delete keys

#### Analytics Dashboard
- Real-time cost accounting
- Granular observability with audit logs
- Request logs with latency metrics
- Usage statistics by provider, model, and key

#### UI
- Modern, responsive React/TypeScript interface
- TailwindCSS styling
- Tauri v2 desktop application
