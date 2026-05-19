import { useState, useEffect } from "react";
import {
  Save,
  RefreshCw,
  Download,
  Database,
  Server,
  Shield,
  Loader2,
  Upload,
  CheckCircle,
} from "lucide-react";
import { settingsApi, updaterApi } from "../../lib/tauri";
import type { GatewaySettings } from "../../lib/types";
import { listen } from "@tauri-apps/api/event";

interface Props {
  onGatewayStatusChange: (running: boolean, port: number) => void;
}

export default function SettingsTab({ onGatewayStatusChange }: Props) {
  const [settings, setSettings] = useState<GatewaySettings>({
    retryCount: 3,
    timeoutSeconds: 30,
    semanticCacheEnabled: false,
    mcpEnabled: false,
    dataRetentionDays: 90,
    gatewayPort: 4141,
  });
  const [dbStats, setDbStats] = useState<{ sizeBytes: number; rowCount: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  
  // Update state
  const [currentVersion, setCurrentVersion] = useState<string>("");
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [downloadingUpdate, setDownloadingUpdate] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [updateDownloaded, setUpdateDownloaded] = useState(false);

  useEffect(() => {
    loadSettings();
    loadCurrentVersion();
    setupUpdateListeners();
  }, []);

  async function loadCurrentVersion() {
    try {
      const version = await updaterApi.getCurrentVersion();
      setCurrentVersion(version);
    } catch (e) {
      console.error("Failed to get current version:", e);
    }
  }

  function setupUpdateListeners() {
    const unlistenProgress = listen<number>("update-progress", (event) => {
      setDownloadProgress(event.payload);
    });

    const unlistenDownloaded = listen("update-downloaded", () => {
      setDownloadingUpdate(false);
      setUpdateDownloaded(true);
    });

    return () => {
      unlistenProgress.then((fn) => fn());
      unlistenDownloaded.then((fn) => fn());
    };
  }

  async function loadSettings() {
    setLoading(true);
    try {
      const [s, db] = await Promise.all([
        settingsApi.getSettings(),
        settingsApi.getDbStats(),
      ]);
      setSettings(s);
      setDbStats(db);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await settingsApi.updateSettings(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onGatewayStatusChange(false, settings.gatewayPort);
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleExportLogs() {
    try {
      await settingsApi.exportLogs("spora_logs_export.json");
    } catch (e) {
      console.error(e);
    }
  }

  async function handleCheckForUpdates() {
    setCheckingUpdate(true);
    try {
      const version = await updaterApi.checkForUpdates();
      if (version) {
        setUpdateAvailable(true);
        setUpdateVersion(version);
      } else {
        setUpdateAvailable(false);
        setUpdateVersion(null);
      }
    } catch (e) {
      console.error("Failed to check for updates:", e);
    } finally {
      setCheckingUpdate(false);
    }
  }

  async function handleDownloadUpdate() {
    setDownloadingUpdate(true);
    setDownloadProgress(0);
    setUpdateDownloaded(false);
    try {
      await updaterApi.downloadUpdate();
    } catch (e) {
      console.error("Failed to download update:", e);
      setDownloadingUpdate(false);
    }
  }

  async function handleInstallAndRestart() {
    try {
      await updaterApi.installAndRestart();
    } catch (e) {
      console.error("Failed to install update:", e);
    }
  }

  function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw size={20} className="text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="max-w-4xl mx-auto p-10 space-y-12">
        {/* Gateway Logic */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 border-b border-primary/10 pb-3">
            <Server size={20} className="text-primary" />
            <h3 className="text-sm tracking-[0.2em] text-primary uppercase font-medium">Gateway Logic</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-4">
              <label className="block text-xs uppercase tracking-widest text-foreground/40 font-medium">
                Gateway Port
              </label>
              <div className="relative max-w-[200px]">
                <input
                  type="number"
                  min="1024"
                  max="65535"
                  value={settings.gatewayPort}
                  onChange={(e) =>
                    setSettings({ ...settings, gatewayPort: parseInt(e.target.value) || 4141 })
                  }
                  className="w-full px-4 py-3 rounded bg-white/5 border border-white/10 text-lg text-foreground focus:outline-none focus:border-primary/50 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-foreground/20 uppercase tracking-tighter">TCP</div>
              </div>
              <p className="text-[10px] uppercase tracking-widest text-foreground/20">
                localhost:PORT/v1
              </p>
            </div>

            <div className="space-y-4">
              <label className="block text-xs uppercase tracking-widest text-foreground/40 font-medium">
                Retry Count
              </label>
              <div className="flex gap-2 max-w-[320px]">
                {[1, 3, 5, 10].map((val) => (
                  <button
                    key={val}
                    onClick={() => setSettings({ ...settings, retryCount: val })}
                    className={`flex-1 py-3 rounded text-sm uppercase tracking-wider transition-all border ${
                      settings.retryCount === val
                        ? "bg-primary/20 text-primary border-primary/40"
                        : "bg-white/5 text-foreground/40 border-white/10 hover:bg-white/10 hover:text-foreground/60"
                    }`}
                  >
                    {val}
                  </button>
                ))}
              </div>
              <p className="text-[10px] uppercase tracking-widest text-foreground/20">Attempts on failure</p>
            </div>
          </div>

          <div className="space-y-4 pt-4">
            <label className="block text-xs uppercase tracking-widest text-foreground/40 font-medium">
              Global Timeout
            </label>
            <div className="flex gap-2 max-w-xl">
              {[10, 30, 60, 120, 300].map((val) => (
                <button
                  key={val}
                  onClick={() => setSettings({ ...settings, timeoutSeconds: val })}
                  className={`flex-1 py-3 rounded text-sm uppercase tracking-wider transition-all border ${
                    settings.timeoutSeconds === val
                      ? "bg-primary/20 text-primary border-primary/40"
                      : "bg-white/5 text-foreground/40 border-white/10 hover:bg-white/10 hover:text-foreground/60"
                  }`}
                >
                  {val >= 60 ? `${val / 60}M` : `${val}S`}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 border-b border-primary/10 pb-3">
            <Shield size={20} className="text-primary" />
            <h3 className="text-sm tracking-[0.2em] text-primary uppercase font-medium">Features</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                key: "semanticCacheEnabled" as const,
                label: "Semantic Caching",
                desc: "Cache similar prompts locally",
                badge: "Coming Soon",
              },
              {
                key: "mcpEnabled" as const,
                label: "Model Context Protocol",
                desc: "Enable MCP bridge for agents",
                badge: "Coming Soon",
              },
            ].map((feature) => (
              <div key={feature.key} className="p-6 rounded border border-white/5 bg-white/2 flex items-center justify-between group transition-all hover:border-white/10">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-foreground/80 tracking-tight">{feature.label}</span>
                    {feature.badge && (
                      <span className="text-[9px] uppercase tracking-tighter px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/10 font-medium">
                        {feature.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-foreground/30">{feature.desc}</p>
                </div>
                <button
                  onClick={() =>
                    setSettings({ ...settings, [feature.key]: !settings[feature.key] })
                  }
                  disabled={!!feature.badge}
                  className={`relative w-10 h-5 rounded-full transition-all disabled:opacity-20 ${
                    settings[feature.key] ? "bg-primary" : "bg-white/10"
                  }`}
                >
                  <div
                    className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${
                      settings[feature.key] ? "left-6" : "left-1"
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Data Retention */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 border-b border-primary/10 pb-3">
            <Database size={20} className="text-primary" />
            <h3 className="text-sm tracking-[0.2em] text-primary uppercase font-medium">Database & Logs</h3>
          </div>
          
          <div className="space-y-8">
            {dbStats && (
              <div className="flex gap-6 max-w-2xl">
                <div className="flex-1 p-6 rounded bg-white/2 border border-white/5">
                  <div className="text-2xl font-medium text-primary tracking-tight">{dbStats.rowCount.toLocaleString()}</div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-foreground/30 mt-1">Log entries</div>
                </div>
                <div className="flex-1 p-6 rounded bg-white/2 border border-white/5">
                  <div className="text-2xl font-medium text-primary tracking-tight">{formatBytes(dbStats.sizeBytes)}</div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-foreground/30 mt-1">Storage used</div>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <label className="block text-xs uppercase tracking-widest text-foreground/40 font-medium">
                Data Retention
              </label>
              <div className="flex gap-2 max-w-xl">
                {[7, 30, 90, 365].map((val) => (
                  <button
                    key={val}
                    onClick={() => setSettings({ ...settings, dataRetentionDays: val })}
                    className={`flex-1 py-3 rounded text-sm uppercase tracking-wider transition-all border ${
                      settings.dataRetentionDays === val
                        ? "bg-primary/20 text-primary border-primary/40"
                        : "bg-white/5 text-foreground/40 border-white/10 hover:bg-white/10 hover:text-foreground/60"
                    }`}
                  >
                    {val === 365 ? "1 YEAR" : `${val} DAYS`}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex pt-4">
              <button
                onClick={handleExportLogs}
                className="flex items-center gap-3 px-6 py-3 rounded text-xs uppercase tracking-widest border border-white/10 text-foreground/40 hover:text-foreground/70 hover:bg-white/5 transition-all group"
              >
                <Download size={16} className="group-hover:translate-y-0.5 transition-transform" /> 
                Export Audit Logs
              </button>
            </div>
          </div>
        </section>

        {/* Updates */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 border-b border-primary/10 pb-3">
            <Upload size={20} className="text-primary" />
            <h3 className="text-sm tracking-[0.2em] text-primary uppercase font-medium">Updates</h3>
          </div>
          
          <div className="space-y-6">
            <div className="flex items-center justify-between p-6 rounded bg-white/2 border border-white/5">
              <div className="space-y-1">
                <div className="text-xs text-foreground/40 uppercase tracking-wider">Current Version</div>
                <div className="text-lg font-medium text-foreground">{currentVersion || "Loading..."}</div>
              </div>
              <button
                onClick={handleCheckForUpdates}
                disabled={checkingUpdate}
                className="flex items-center gap-2 px-4 py-2 text-xs uppercase tracking-wider border border-white/10 text-foreground/40 hover:text-foreground/70 hover:bg-white/5 transition-all rounded disabled:opacity-50"
              >
                {checkingUpdate ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <RefreshCw size={14} />
                )}
                Check for Updates
              </button>
            </div>

            {updateAvailable && updateVersion && (
              <div className="p-6 rounded bg-primary/5 border border-primary/20 space-y-4">
                <div className="flex items-center gap-3">
                  <CheckCircle size={20} className="text-primary" />
                  <div>
                    <div className="text-sm font-medium text-foreground/80">Update Available</div>
                    <div className="text-xs text-foreground/40">Version {updateVersion} is ready to download</div>
                  </div>
                </div>

                {!updateDownloaded ? (
                  <>
                    {!downloadingUpdate ? (
                      <button
                        onClick={handleDownloadUpdate}
                        className="w-full py-3 text-xs uppercase tracking-wider bg-primary text-background rounded hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
                      >
                        <Download size={16} />
                        Download Update
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-foreground/40">
                          <span>Downloading...</span>
                          <span>{Math.round(downloadProgress)}%</span>
                        </div>
                        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all duration-300"
                            style={{ width: `${downloadProgress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <button
                    onClick={handleInstallAndRestart}
                    className="w-full py-3 text-xs uppercase tracking-wider bg-primary text-background rounded hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
                  >
                    <Upload size={16} />
                    Install & Restart
                  </button>
                )}
              </div>
            )}

            {!updateAvailable && !checkingUpdate && (
              <div className="p-6 rounded bg-white/2 border border-white/5 text-center">
                <div className="text-sm text-foreground/40">You're using the latest version</div>
              </div>
            )}
          </div>
        </section>

        <div className="pt-10 border-t border-primary/5 flex justify-center">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full max-w-md py-4 rounded text-xs uppercase tracking-[0.3em] bg-primary text-background hover:bg-primary/90 disabled:opacity-30 transition-all flex items-center justify-center gap-3 font-bold"
          >
            {saving ? (
              <Loader2 size={18} className="animate-spin" />
            ) : saved ? (
              "Settings Updated"
            ) : (
              <>
                <Save size={18} /> Save All Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
