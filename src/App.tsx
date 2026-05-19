import { useState, useEffect } from "react";
import logo from "../src-tauri/assets/logo.png";
import { Wallet, BarChart3, Settings } from "lucide-react";
import KeysWallet from "./components/KeysWallet/KeysWallet";
import Analytics from "./components/Analytics/Analytics";
import SettingsTab from "./components/Settings/SettingsTab";
import { settingsApi } from "./lib/tauri";

type Tab = "keys" | "analytics" | "settings";

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("keys");
  const [, setGatewayRunning] = useState(false);

  useEffect(() => {
    settingsApi
      .getGatewayStatus()
      .then(({ running }) => {
        setGatewayRunning(running);
      })
      .catch(() => {});
  }, []);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "keys", label: "Keys Wallet", icon: <Wallet size={16} /> },
    { id: "analytics", label: "Analytics", icon: <BarChart3 size={16} /> },
    { id: "settings", label: "Settings", icon: <Settings size={16} /> },
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
        {activeTab === "analytics" && <Analytics />}
        {activeTab === "settings" && (
          <SettingsTab
            onGatewayStatusChange={(running) => {
              setGatewayRunning(running);
            }}
          />
        )}
      </div>
    </div>
  );
}
