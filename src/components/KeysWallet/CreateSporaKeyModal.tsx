import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { keysApi } from "../../lib/tauri";
import type { Provider, SporaKey } from "../../lib/types";

const ALL_PROVIDERS: Provider[] = ["openai", "anthropic", "gemini", "openrouter"];

interface Props {
  onClose: () => void;
  onCreated: (key: SporaKey) => void;
}

export default function CreateSporaKeyModal({ onClose, onCreated }: Props) {
  const [label, setLabel] = useState("");
  const [location, setLocation] = useState("");
  const [restrictProviders, setRestrictProviders] = useState(false);
  const [selectedProviders, setSelectedProviders] = useState<Provider[]>([]);
  const [dailyLimit, setDailyLimit] = useState("");
  const [monthlyLimit, setMonthlyLimit] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleProvider(p: Provider) {
    setSelectedProviders((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const key = await keysApi.createSporaKey({
        label: label.trim(),
        location: location.trim(),
        allowedProviders:
          restrictProviders && selectedProviders.length > 0
            ? selectedProviders
            : null,
        allowedModels: null,
        dailyLimitUsd: dailyLimit ? parseFloat(dailyLimit) : null,
        monthlyLimitUsd: monthlyLimit ? parseFloat(monthlyLimit) : null,
      });
      onCreated(key);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-md mx-4 rounded border border-primary/20 bg-background shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-primary/10">
          <h3 className="text-sm tracking-[0.2em] text-primary uppercase font-medium">Issue Access Key</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded text-foreground/40 hover:text-primary hover:bg-primary/10 transition-all"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 font-mono">
          <div className="space-y-3">
            <label className="block text-[10px] uppercase tracking-[0.2em] text-foreground/40 font-medium">
              Identity Label <span className="text-primary">*</span>
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Cursor IDE"
              className="w-full px-4 py-3 rounded bg-white/5 border border-white/10 text-sm text-foreground placeholder-foreground/20 focus:outline-none focus:border-primary/50 transition-all uppercase"
            />
          </div>

          <div className="space-y-3">
            <label className="block text-[10px] uppercase tracking-[0.2em] text-foreground/40 font-medium">
              Geographic Scope / Purpose
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Research Agent, Production"
              className="w-full px-4 py-3 rounded bg-white/5 border border-white/10 text-sm text-foreground placeholder-foreground/20 focus:outline-none focus:border-primary/50 transition-all uppercase"
            />
          </div>

          <div className="space-y-4">
            <label className="flex items-center gap-3 text-[10px] uppercase tracking-[0.2em] text-foreground/40 font-medium cursor-pointer group">
              <input
                type="checkbox"
                checked={restrictProviders}
                onChange={(e) => setRestrictProviders(e.target.checked)}
                className="w-4 h-4 rounded border-white/10 bg-white/5 checked:bg-primary checked:border-primary transition-all cursor-pointer"
              />
              <span className="group-hover:text-foreground/60 transition-colors">Restrict Uplink Access</span>
            </label>
            {restrictProviders && (
              <div className="flex gap-2">
                {ALL_PROVIDERS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => toggleProvider(p)}
                    className={`flex-1 py-2 rounded text-[10px] uppercase tracking-wider border transition-all ${
                      selectedProviders.includes(p)
                        ? "bg-primary/20 text-primary border-primary/40"
                        : "bg-white/5 text-foreground/40 border-white/10 hover:bg-white/10"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <label className="block text-[10px] uppercase tracking-[0.2em] text-foreground/40 font-medium">
                Daily Cap (USD)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={dailyLimit}
                onChange={(e) => setDailyLimit(e.target.value)}
                placeholder="Unlimited"
                className="w-full px-4 py-3 rounded bg-white/5 border border-white/10 text-sm text-foreground placeholder-foreground/20 focus:outline-none focus:border-primary/50 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
            <div className="space-y-3">
              <label className="block text-[10px] uppercase tracking-[0.2em] text-foreground/40 font-medium">
                Monthly Cap (USD)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={monthlyLimit}
                onChange={(e) => setMonthlyLimit(e.target.value)}
                placeholder="Unlimited"
                className="w-full px-4 py-3 rounded bg-white/5 border border-white/10 text-sm text-foreground placeholder-foreground/20 focus:outline-none focus:border-primary/50 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
          </div>

          {error && (
            <div className="p-4 rounded bg-red-500/10 border border-red-500/20 text-[10px] uppercase tracking-wider text-red-500">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded text-[10px] uppercase tracking-[0.2em] text-foreground/40 hover:text-foreground/70 border border-white/10 hover:bg-white/5 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !label.trim()}
              className="flex-1 py-3 rounded text-[10px] uppercase tracking-[0.3em] bg-primary text-background hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 font-bold"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              Issue Key
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
