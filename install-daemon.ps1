$ErrorActionPreference = "Stop"

$binDir = "$env:LOCALAPPDATA\Spora"
$binPath = "$binDir\spora-daemon.exe"

New-Item -ItemType Directory -Force -Path $binDir | Out-Null
Copy-Item "src-tauri\target\release\spora-daemon.exe" $binPath -Force

$action = New-ScheduledTaskAction -Execute $binPath
$trigger = New-ScheduledTaskTrigger -AtLogOn
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel LeastPrivilege
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask -TaskName "SporaDaemon" -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force

Write-Host "Spora daemon installed. It will start on next login."
Start-ScheduledTask -TaskName "SporaDaemon"
Write-Host "Daemon started."
