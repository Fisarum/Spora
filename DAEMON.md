# Spora Daemon Setup

Spora can run as a background daemon (headless gateway proxy) on startup. This allows your AI agents (Cursor, Claude Code, etc.) to always connect to the Spora proxy on your configured port (default `4141`) without needing to launch the Spora graphical user interface.

The daemon binary (`spora-daemon`) uses the exact same secure SQLite database (`spora.db`) as the desktop application, so all your API keys and configuration settings remain automatically synchronized.

---

## macOS Installation

### Quick Install

If you have already built/installed `Spora.app` in `/Applications`, run:

```bash
make install-daemon
```

### Manual Configuration

The daemon runs as a user-level launch agent. 

1. **Build the daemon binary:**
   ```bash
   cd src-tauri && cargo build --release --bin spora-daemon
   ```
2. **Move to application bundle:**
   ```bash
   cp src-tauri/target/release/spora-daemon /Applications/Spora.app/Contents/MacOS/spora-daemon
   ```
3. **Register the Launch Agent:**
   Create a file at `~/Library/LaunchAgents/com.spora.gateway.daemon.plist`:
   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
   <plist version="1.0">
   <dict>
       <key>Label</key>
       <string>com.spora.gateway.daemon</string>
       <key>ProgramArguments</key>
       <array>
           <string>/Applications/Spora.app/Contents/MacOS/spora-daemon</string>
       </array>
       <key>RunAtLoad</key>
       <true/>
       <key>KeepAlive</key>
       <true/>
       <key>StandardOutPath</key>
       <string>/Users/YOUR_USER/Library/Logs/spora-daemon.log</string>
       <key>StandardErrorPath</key>
       <string>/Users/YOUR_USER/Library/Logs/spora-daemon-error.log</string>
       <key>EnvironmentVariables</key>
       <dict>
           <key>RUST_LOG</key>
           <string>spora_daemon=info,spora_lib=info</string>
       </dict>
   </dict>
   </plist>
   ```
4. **Load the daemon:**
   ```bash
   launchctl load ~/Library/LaunchAgents/com.spora.gateway.daemon.plist
   ```

### Uninstall on macOS
```bash
make uninstall-daemon
```

---

## Linux Installation

On Linux, the daemon is managed via a `systemd` user service, meaning it runs entirely within your user session and does not require root/sudo access.

### Quick Install
```bash
make install-daemon-linux
```

### Manual Configuration

1. **Build the daemon binary:**
   ```bash
   cd src-tauri && cargo build --release --bin spora-daemon
   ```
2. **Move to local binaries:**
   ```bash
   mkdir -p ~/.local/bin
   cp src-tauri/target/release/spora-daemon ~/.local/bin/spora-daemon
   ```
3. **Register systemd unit:**
   Create a file at `~/.config/systemd/user/spora-daemon.service`:
   ```ini
   [Unit]
   Description=Spora Gateway Daemon
   Documentation=https://github.com/Fisarum/Spora
   After=network-online.target
   Wants=network-online.target

   [Service]
   Type=simple
   ExecStart=%h/.local/bin/spora-daemon
   Restart=always
   RestartSec=5
   Environment=RUST_LOG=info

   [Install]
   WantedBy=default.target
   ```
4. **Enable and start the service:**
   ```bash
   systemctl --user daemon-reload
   systemctl --user enable --now spora-daemon
   ```

### Uninstall on Linux
```bash
make uninstall-daemon-linux
```

---

## Windows Installation

On Windows, the daemon runs on user logon via Windows Task Scheduler. This runs headlessly without showing any console window.

### Quick Install

Run PowerShell as an administrator and run:

```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force
.\install-daemon.ps1
```

### Manual Configuration

1. **Build the daemon binary:**
   ```bash
   cd src-tauri
   cargo build --release --bin spora-daemon
   ```
2. **Install the binary:**
   Copy `src-tauri\target\release\spora-daemon.exe` to `%LOCALAPPDATA%\Spora\spora-daemon.exe`.
3. **Register Scheduled Task:**
   Open PowerShell and execute:
   ```powershell
   $action = New-ScheduledTaskAction -Execute "$env:LOCALAPPDATA\Spora\spora-daemon.exe"
   $trigger = New-ScheduledTaskTrigger -AtLogOn
   $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel LeastPrivilege
   $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

   Register-ScheduledTask -TaskName "SporaDaemon" -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force
   Start-ScheduledTask -TaskName "SporaDaemon"
   ```

### Uninstall on Windows

Run this in PowerShell:
```powershell
Unregister-ScheduledTask -TaskName "SporaDaemon" -Confirm:$false
Remove-Item "$env:LOCALAPPDATA\Spora" -Recurse -Force
```

---

## 🔍 Verifying the Daemon

To verify that the daemon is correctly running and listening in the background on any platform, query the health endpoint:

```bash
curl http://localhost:4141/health
```

Expected Response:
```json
{"service":"spora-gateway","status":"ok"}
```
