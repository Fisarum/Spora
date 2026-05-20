import { useState } from "react";
import { X, Eye, EyeOff, Loader2 } from "lucide-react";
import { keysApi } from "../../lib/tauri";
import type { Provider, ProviderKey } from "../../lib/types";

const PROVIDERS: { id: Provider; name: string; placeholder: string }[] = [
  { id: "openai", name: "OpenAI", placeholder: "sk-..." },
  { id: "anthropic", name: "Anthropic", placeholder: "sk-ant-..." },
  { id: "gemini", name: "Google Gemini", placeholder: "AIza..." },
  { id: "openrouter", name: "OpenRouter", placeholder: "sk-or-v1-..." },
];

interface Props {
  onClose: () => void;
  onAdded: (key: ProviderKey) => void;
}

export default function AddProviderKeyModal({ onClose, onAdded }: Props) {
  const [provider, setProvider] = useState<Provider>("openai");
  const [label, setLabel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim() || !apiKey.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const key = await keysApi.addProviderKey(provider, label.trim(), apiKey.trim());
      onAdded(key);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  const selectedProvider = PROVIDERS.find((p) => p.id === provider)!;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-md mx-4 rounded border border-primary/20 bg-background shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-primary/10">
          <h3 className="text-sm tracking-[0.2em] text-primary uppercase font-medium">Add Provider Key</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded text-foreground/40 hover:text-primary hover:bg-primary/10 transition-all"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 font-mono">
          {/* Provider selector */}
          <div className="space-y-3">
            <label className="block text-[10px] uppercase tracking-[0.2em] text-foreground/40 font-medium">
              Provider
            </label>
            <div className="grid grid-cols-2 gap-2">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setProvider(p.id)}
                  className={`py-2 px-3 rounded text-[10px] uppercase tracking-wider border transition-all ${
                    provider === p.id
                      ? "bg-primary/20 text-primary border-primary/40"
                      : "bg-white/5 text-foreground/40 border-white/10 hover:bg-white/10 hover:text-foreground/60"
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* Label */}
          <div className="space-y-3">
            <label className="block text-[10px] uppercase tracking-[0.2em] text-foreground/40 font-medium">
              Label
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Production Key"
              className="w-full px-4 py-3 rounded bg-white/5 border border-white/10 text-sm text-foreground placeholder-foreground/20 focus:outline-none focus:border-primary/50 transition-all uppercase"
            />
          </div>

          {/* API Key */}
          <div className="space-y-3">
            <label className="block text-[10px] uppercase tracking-[0.2em] text-foreground/40 font-medium">
              API Key
            </label>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={selectedProvider.placeholder}
                className="w-full px-4 py-3 pr-12 rounded bg-white/5 border border-white/10 text-sm text-foreground placeholder-foreground/20 font-mono focus:outline-none focus:border-primary/50 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-foreground/30 hover:text-primary transition-colors"
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
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
              disabled={loading || !label.trim() || !apiKey.trim()}
              className="flex-1 py-3 rounded text-[10px] uppercase tracking-[0.3em] bg-primary text-background hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 font-bold"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              Add Key
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
