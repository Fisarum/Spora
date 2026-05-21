import { useState, useEffect } from "react";
import logo from "../src-tauri/assets/logo.png";
import { Wallet, Activity, Terminal, Settings, X, Download, BookOpen } from "lucide-react";
import KeysWallet from "./components/KeysWallet/KeysWallet";
import ActivityPage from "./components/Analytics/Analytics";
import LogsPage from "./components/Logs/Logs";
import SettingsTab from "./components/Settings/SettingsTab";
import IntegrationsTab from "./components/Integrations/IntegrationsTab";
import { settingsApi, updaterApi } from "./lib/tauri";
import { listen } from "@tauri-apps/api/event";

type Tab = "keys" | "activity" | "logs" | "settings" | "integrations";

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("keys");
  const [, setGatewayRunning] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);

  useEffect(() => {
    settingsApi
      .getGatewayStatus()
      .then(({ running }) => {
        setGatewayRunning(running);
      })
      .catch(() => {});

    // Check for updates on startup
    checkForUpdates();

    // Set up periodic update check (every 24 hours)
    const interval = setInterval(checkForUpdates, 24 * 60 * 60 * 1000);

    // Listen for update events
    const unlistenProgress = listen<number>("update-progress", (event) => {
      console.log("Update progress:", event.payload);
    });

    const unlistenDownloaded = listen("update-downloaded", () => {
      console.log("Update downloaded");
    });

    return () => {
      clearInterval(interval);
      unlistenProgress.then((fn) => fn());
      unlistenDownloaded.then((fn) => fn());
    };
  }, []);

  async function checkForUpdates() {
    try {
      const version = await updaterApi.checkForUpdates();
      if (version) {
        setUpdateAvailable(true);
        setUpdateVersion(version);
        setShowUpdateBanner(true);
      }
    } catch (e) {
      console.error("Failed to check for updates:", e);
    }
  }

  async function handleDownloadUpdate() {
    try {
      await updaterApi.downloadUpdate();
      setShowUpdateBanner(false);
    } catch (e) {
      console.error("Failed to download update:", e);
    }
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "keys", label: "Keys Wallet", icon: <Wallet size={16} /> },
    { id: "activity", label: "Activity", icon: <Activity size={16} /> },
    { id: "logs", label: "Logs", icon: <Terminal size={16} /> },
    { id: "settings", label: "Settings", icon: <Settings size={16} /> },
    { id: "integrations", label: "Integrations", icon: <BookOpen size={16} /> },
  ];

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background font-mono text-foreground">
      {/* Title Bar */}
      <div
        className="flex items-center justify-center px-5 py-3 bg-background select-none h-12 relative"
        data-tauri-drag-region
      >
        <div className="flex items-center gap-2 pointer-events-none">
          <img src={logo} alt="Spora Logo" className="w-6 h-6 object-contain" />
          <span className="text-foreground text-xl tracking-wide font-medium">
            Spora
          </span>
        </div>
      </div>

      {/* Update Notification Banner */}
      {showUpdateBanner && updateAvailable && (
        <div className="flex items-center justify-between px-4 py-3 bg-primary/10 border-b border-primary/20">
          <div className="flex items-center gap-3">
            <Download size={16} className="text-primary" />
            <span className="text-sm text-foreground/80">
              Update available: version {updateVersion}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadUpdate}
              className="px-3 py-1.5 text-xs uppercase tracking-wider bg-primary text-background rounded hover:bg-primary/90 transition-all"
            >
              Download
            </button>
            <button
              onClick={() => setShowUpdateBanner(false)}
              className="p-1.5 text-foreground/40 hover:text-foreground/60 transition-all"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 px-4 pt-2 pb-0 border-b border-primary/5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 text-[11px] tracking-wide rounded-t transition-all duration-200 -mb-px border-b-2 ${
              activeTab === tab.id
                ? "text-primary border-primary bg-primary/5"
                : "text-foreground/40 border-transparent hover:text-foreground/60 hover:bg-primary/5"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "keys" && (
          <KeysWallet
            onGatewayStatusChange={(running) => {
              setGatewayRunning(running);
            }}
          />
        )}
        {activeTab === "activity" && <ActivityPage />}
        {activeTab === "logs" && <LogsPage />}
        {activeTab === "settings" && (
          <SettingsTab
            onGatewayStatusChange={(running) => {
              setGatewayRunning(running);
            }}
          />
        )}
        {activeTab === "integrations" && <IntegrationsTab />}
      </div>
    </div>
  );
}
