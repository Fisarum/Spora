import { useState, useEffect } from "react";
import {
  Plus,
  Key,
  Trash2,
  Eye,
  EyeOff,
  Copy,
  Check,
  Shield,
  RefreshCw,
} from "lucide-react";
import { keysApi, settingsApi } from "../../lib/tauri";
import type { ProviderKey, SporaKey, Provider } from "../../lib/types";
import AddProviderKeyModal from "./AddProviderKeyModal";
import CreateSporaKeyModal from "./CreateSporaKeyModal";
import { ModelSelectorToggle } from "./ModelSelector";

const PROVIDER_META: Record<Provider, { name: string; color: string; bg: string }> = {
  openai: { name: "OpenAI", color: "text-primary", bg: "bg-primary/10" },
  anthropic: { name: "Anthropic", color: "text-primary", bg: "bg-primary/10" },
  gemini: { name: "Gemini", color: "text-primary", bg: "bg-primary/10" },
  openrouter: { name: "OpenRouter", color: "text-primary", bg: "bg-primary/10" },
};

interface Props {
  onGatewayStatusChange: (running: boolean, port: number) => void;
}

export default function KeysWallet({ onGatewayStatusChange }: Props) {
  const [providerKeys, setProviderKeys] = useState<ProviderKey[]>([]);
  const [sporaKeys, setSporaKeys] = useState<SporaKey[]>([]);
  const [showAddProvider, setShowAddProvider] = useState(false);
  const [showCreateSpora, setShowCreateSpora] = useState(false);
  const [revealedTokens, setRevealedTokens] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [gatewayRunning, setGatewayRunning] = useState(false);
  const [gatewayLoading, setGatewayLoading] = useState(false);
  const [gatewayPort, setGatewayPort] = useState(4141);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [pk, sk, status] = await Promise.all([
        keysApi.listProviderKeys(),
        keysApi.listSporaKeys(),
        settingsApi.getGatewayStatus(),
      ]);
      setProviderKeys(pk);
      setSporaKeys(sk);
      setGatewayRunning(status.running);
      setGatewayPort(status.port);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteProviderKey(id: string) {
    await keysApi.deleteProviderKey(id);
    setProviderKeys((prev) => prev.filter((k) => k.id !== id));
  }

  async function handleRevokeSporaKey(id: string) {
    await keysApi.revokeSporaKey(id);
    setSporaKeys((prev) =>
      prev.map((k) => (k.id === id ? { ...k, active: false } : k))
    );
  }

  async function handleDeleteSporaKey(id: string) {
    await keysApi.deleteSporaKey(id);
    setSporaKeys((prev) => prev.filter((k) => k.id !== id));
  }

  async function toggleGateway() {
    setGatewayLoading(true);
    try {
      if (gatewayRunning) {
        await settingsApi.stopGateway();
        setGatewayRunning(false);
        onGatewayStatusChange(false, gatewayPort);
      } else {
        await settingsApi.startGateway();
        setGatewayRunning(true);
        onGatewayStatusChange(true, gatewayPort);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setGatewayLoading(false);
    }
  }

  function toggleReveal(id: string) {
    setRevealedTokens((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function copyToken(id: string, token: string) {
    await navigator.clipboard.writeText(token);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw size={20} className="text-foreground animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-5 space-y-6 bg-background">
      {/* Gateway Control */}
      <div className="rounded border border-primary/10 bg-white/2 p-4 flex items-center justify-between transition-all group">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-[10px] tracking-wider text-foreground uppercase font-medium">Proxy Gateway</h3>
          </div>
          <p className="text-sm text-foreground mt-0.5 tracking-tight uppercase">
            LOCALHOST:{gatewayPort}/V1
          </p>
          <p className="text-[9px] text-foreground/40 uppercase tracking-widest mt-0.5">Universal Adapter Protocol</p>
        </div>
        <button
          onClick={toggleGateway}
          disabled={gatewayLoading}
          className={`flex items-center gap-2 px-4 py-2 rounded text-[10px] uppercase tracking-wider transition-all duration-200 ${
            gatewayRunning
              ? "bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20"
              : "bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20"
          }`}
        >
          {gatewayLoading ? (
            <RefreshCw size={14} className="animate-spin" />
          ) : null}
          {gatewayRunning ? "Shutdown" : "Initialize"}
        </button>
      </div>

      {/* Provider Keys */}
      <section>
        <div className="flex items-center justify-between mb-3 px-1">
          <div>
            <h2 className="text-[10px] tracking-wider text-foreground uppercase font-medium">Provider Keys</h2>
          </div>
          <button
            onClick={() => setShowAddProvider(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] uppercase tracking-wider bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all"
          >
            <Plus size={12} /> Add Credential
          </button>
        </div>

        {providerKeys.length === 0 ? (
          <div className="rounded border border-dashed border-primary/10 p-8 text-center bg-white/1">
            <Key size={24} className="mx-auto text-foreground/20 mb-2" />
            <p className="text-[10px] uppercase tracking-wider text-foreground/40">No Uplink Established</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {providerKeys.map((key) => {
              const meta = PROVIDER_META[key.provider];
              return (
                <div
                  key={key.id}
                  className="flex items-center gap-3 p-3 rounded border border-primary/5 bg-white/1 hover:bg-primary/5 hover:border-primary/20 transition-all group"
                >
                  <div
                    className={`w-8 h-8 rounded ${meta.bg} flex items-center justify-center flex-shrink-0 border border-primary/10`}
                  >
                    <Key size={14} className="text-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-medium text-foreground">
                        {key.label}
                      </span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/10 uppercase font-medium">
                        {meta.name}
                      </span>
                    </div>
                    <div className="text-[10px] text-foreground/40 mt-0.5 font-mono">
                      {key.maskedKey}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteProviderKey(key.id)}
                    className="p-1.5 rounded text-primary/20 hover:text-red-500 hover:bg-red-500/10 transition-all"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Spora Keys */}
      <section>
        <div className="flex items-center justify-between mb-3 px-1">
          <div>
            <h2 className="text-[10px] tracking-wider text-foreground uppercase font-medium">Virtual Access Keys</h2>
          </div>
          <button
            onClick={() => setShowCreateSpora(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] uppercase tracking-wider bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all"
          >
            <Plus size={12} /> Issue Key
          </button>
        </div>

        {sporaKeys.length === 0 ? (
          <div className="rounded border border-dashed border-primary/10 p-8 text-center bg-white/1">
            <Shield size={24} className="mx-auto text-foreground/20 mb-2" />
            <p className="text-[10px] uppercase tracking-wider text-foreground/40">No Active Virtual Identities</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sporaKeys.map((key) => (
              <div
                key={key.id}
                className={`p-4 rounded border transition-all group ${
                  key.active
                    ? "border-primary/5 bg-white/1 hover:border-primary/20 hover:bg-primary/5"
                    : "border-white/5 bg-white/0 opacity-40"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground">
                        {key.label}
                      </span>
                      {key.location && (
                        <span className="text-[9px] px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/10 uppercase font-medium">
                          {key.location}
                        </span>
                      )}
                      {!key.active && (
                        <span className="text-[9px] px-2 py-0.5 rounded bg-red-500/10 text-red-500 border border-red-500/20 font-medium uppercase">
                          TERMINATED
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-3">
                      <div className="flex-1 bg-background/50 rounded px-3 py-2 border border-primary/5 flex items-center min-w-0">
                        <code className="text-[11px] font-mono text-foreground/60 truncate flex-1">
                          {revealedTokens.has(key.id)
                            ? key.token
                            : key.token.slice(0, 16).toUpperCase() + " ••••••••••••••"}
                        </code>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => toggleReveal(key.id)}
                          className="p-1.5 text-foreground/30 hover:text-foreground hover:bg-foreground/10 rounded transition-all relative group/tooltip"
                        >
                          {revealedTokens.has(key.id) ? (
                            <EyeOff size={16} />
                          ) : (
                            <Eye size={16} />
                          )}
                          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-background border border-foreground/20 text-foreground text-[9px] uppercase tracking-wider rounded opacity-0 group-hover/tooltip:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                            {revealedTokens.has(key.id) ? "Hide Token" : "Reveal Token"}
                          </span>
                        </button>
                        <button
                          onClick={() => copyToken(key.id, key.token)}
                          className="p-1.5 text-foreground/30 hover:text-foreground hover:bg-foreground/10 rounded transition-all relative group/tooltip"
                        >
                          {copiedId === key.id ? (
                            <Check size={16} className="text-foreground" />
                          ) : (
                            <Copy size={16} />
                          )}
                          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-background border border-foreground/20 text-foreground text-[9px] uppercase tracking-wider rounded opacity-0 group-hover/tooltip:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                            {copiedId === key.id ? "Copied!" : "Copy Token"}
                          </span>
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-4 mt-4">
                      {key.allowedProviders && (
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] uppercase tracking-wider text-foreground/40 font-medium">Uplinks</span>
                          <span className="text-[10px] text-foreground/70 uppercase font-medium">{key.allowedProviders.join(", ")}</span>
                        </div>
                      )}
                      {(key.dailyLimitUsd != null || key.monthlyLimitUsd != null) && (
                        <div className="flex gap-6">
                          {key.dailyLimitUsd != null && (
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] uppercase tracking-wider text-foreground/60 font-medium">Daily Quota</span>
                              <span className="text-sm text-foreground font-medium tracking-tight">${key.dailyLimitUsd}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {key.active && (
                      <ModelSelectorToggle sporaKeyId={key.id} />
                    )}
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    {key.active && (
                      <button
                        onClick={() => handleRevokeSporaKey(key.id)}
                        className="p-1.5 rounded text-primary/30 hover:text-orange-500 hover:bg-orange-500/10 transition-all relative group/tooltip"
                      >
                        <Shield size={16} />
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-background border border-orange-500/20 text-orange-500 text-[9px] uppercase tracking-wider rounded opacity-0 group-hover/tooltip:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                          Revoke Access
                        </span>
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteSporaKey(key.id)}
                      className="p-1.5 rounded text-primary/30 hover:text-red-500 hover:bg-red-500/10 transition-all relative group/tooltip"
                    >
                      <Trash2 size={16} />
                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-background border border-red-500/20 text-red-500 text-[9px] uppercase tracking-wider rounded opacity-0 group-hover/tooltip:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                        Purge Identity
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {showAddProvider && (
        <AddProviderKeyModal
          onClose={() => setShowAddProvider(false)}
          onAdded={(key) => {
            setProviderKeys((prev) => [...prev, key]);
            setShowAddProvider(false);
          }}
        />
      )}

      {showCreateSpora && (
        <CreateSporaKeyModal
          onClose={() => setShowCreateSpora(false)}
          onCreated={(key) => {
            setSporaKeys((prev) => [...prev, key]);
            setShowCreateSpora(false);
          }}
        />
      )}
    </div>
  );
}
