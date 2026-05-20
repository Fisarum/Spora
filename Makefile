.PHONY: build-daemon install-daemon uninstall-daemon install-daemon-macos install-daemon-linux uninstall-daemon-macos uninstall-daemon-linux

DAEMON_SRC = src-tauri
DAEMON_BIN = $(DAEMON_SRC)/target/release/spora-daemon
APP_BUNDLE = /Applications/Spora.app
PLIST_SRC = com.spora.gateway.daemon.plist
PLIST_DST = $(HOME)/Library/LaunchAgents/com.spora.gateway.daemon.plist
SERVICE_SRC = spora-daemon.service
SERVICE_DST = $(HOME)/.config/systemd/user/spora-daemon.service
USER := $(shell whoami)

build-daemon:
	cd $(DAEMON_SRC) && cargo build --release --bin spora-daemon

# ── macOS ──────────────────────────────────────────────
install-daemon-macos: build-daemon
	@if [ ! -d "$(APP_BUNDLE)/Contents/MacOS" ]; then \
		echo "Error: $(APP_BUNDLE) not found. Build and install Spora.app first."; \
		exit 1; \
	fi
	cp $(DAEMON_BIN) $(APP_BUNDLE)/Contents/MacOS/spora-daemon
	sed 's/REPLACE_WITH_YOUR_USER/$(USER)/g' $(PLIST_SRC) > $(PLIST_DST)
	launchctl load $(PLIST_DST)
	@echo "Daemon installed and started (macOS). It will auto-start on login."

uninstall-daemon-macos:
	launchctl unload $(PLIST_DST) 2>/dev/null || true
	rm -f $(PLIST_DST)
	rm -f $(APP_BUNDLE)/Contents/MacOS/spora-daemon
	@echo "Daemon uninstalled (macOS)."

# ── Linux ──────────────────────────────────────────────
install-daemon-linux: build-daemon
	mkdir -p $(HOME)/.local/bin
	cp $(DAEMON_BIN) $(HOME)/.local/bin/spora-daemon
	mkdir -p $(HOME)/.config/systemd/user
	cp $(SERVICE_SRC) $(SERVICE_DST)
	systemctl --user daemon-reload
	systemctl --user enable --now spora-daemon
	@echo "Daemon installed and started (Linux). It will auto-start on login."

uninstall-daemon-linux:
	systemctl --user disable --now spora-daemon 2>/dev/null || true
	rm -f $(SERVICE_DST)
	rm -f $(HOME)/.local/bin/spora-daemon
	systemctl --user daemon-reload
	@echo "Daemon uninstalled (Linux)."

# ── Auto-detect ────────────────────────────────────────
install-daemon:
	@case $$(uname -s) in \
		Darwin)  $(MAKE) install-daemon-macos ;; \
		Linux)   $(MAKE) install-daemon-linux ;; \
		*)       echo "Unsupported OS. Use install-daemon-macos, install-daemon-linux, or install-daemon.ps1 (Windows)."; exit 1 ;; \
	esac

uninstall-daemon:
	@case $$(uname -s) in \
		Darwin)  $(MAKE) uninstall-daemon-macos ;; \
		Linux)   $(MAKE) uninstall-daemon-linux ;; \
		*)       echo "Unsupported OS. Use uninstall-daemon-macos, uninstall-daemon-linux, or remove the Scheduled Task manually (Windows)."; exit 1 ;; \
	esac
