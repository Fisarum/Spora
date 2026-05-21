import { useState, useEffect, useMemo } from "react";
import {
  Search,
  Copy,
  Check,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Zap,
  Download,
} from "lucide-react";
import { modelsApi } from "../../lib/tauri";
import type { Model, ModelTag } from "../../lib/types";

const ALL_TAGS: ModelTag[] = ["Coding", "Reasoning", "Fast", "Free", "Vision"];

const TAG_STYLE: Record<ModelTag, string> = {
  Coding: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  Reasoning: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  Fast: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  Free: "bg-green-500/10 text-green-400 border-green-500/20",
  Vision: "bg-teal-500/10 text-teal-400 border-teal-500/20",
};

function formatPrice(price: number): string {
  if (price < 0) return "Variable";
  if (price === 0) return "Free";
  if (price < 0.000001) return `$${(price * 1_000_000).toFixed(4)}/M`;
  return `$${(price * 1_000_000).toFixed(2)}/M`;
}

function formatContext(len: number): string {
  if (len >= 1_000_000) return `${(len / 1_000_000).toFixed(0)}M`;
  if (len >= 1_000) return `${(len / 1_000).toFixed(0)}K`;
  return String(len);
}

interface Props {
  sporaKeyId: string;
}

export default function ModelSelector({ sporaKeyId }: Props) {
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<ModelTag | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  useEffect(() => {
    loadModels();
  }, [sporaKeyId]);

  async function loadModels() {
    setLoading(true);
    try {
      const data = await modelsApi.listAvailableModels(sporaKeyId);
      setModels(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const count = await modelsApi.syncModels();
      setSyncMsg(`Synced ${count} models`);
      await loadModels();
    } catch (e) {
      setSyncMsg("Sync failed — check network");
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMsg(null), 3000);
    }
  }

  async function copyModelId(id: string) {
    await navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const filtered = useMemo(() => {
    let list = models;
    if (activeTag) {
      list = list.filter((m) => m.tags.includes(activeTag));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (m) =>
          m.id.toLowerCase().includes(q) ||
          m.name.toLowerCase().includes(q) ||
          m.provider.toLowerCase().includes(q)
      );
    }
    return list;
  }, [models, activeTag, search]);

  return (
    <div className="mt-4 pt-4 border-t border-primary/5 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap size={12} className="text-primary" />
          <span className="text-[9px] uppercase tracking-widest text-foreground/50 font-medium">
            Model Discovery
          </span>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/10">
            {models.length}
          </span>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-1 px-2 py-1 rounded text-[9px] uppercase tracking-wider text-foreground/40 hover:text-primary hover:bg-primary/10 border border-transparent hover:border-primary/20 transition-all"
        >
          {syncing ? (
            <RefreshCw size={10} className="animate-spin" />
          ) : (
            <Download size={10} />
          )}
          {syncing ? "Syncing…" : syncMsg ?? "Sync"}
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-foreground/30" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search models…"
          className="w-full pl-7 pr-3 py-2 rounded bg-white/3 border border-primary/5 text-[11px] text-foreground placeholder-foreground/20 focus:outline-none focus:border-primary/30 transition-all font-mono"
        />
      </div>

      {/* Tag Filters */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          onClick={() => setActiveTag(null)}
          className={`px-2 py-1 rounded text-[9px] uppercase tracking-wider border transition-all ${
            activeTag === null
              ? "bg-primary/20 text-primary border-primary/40"
              : "bg-white/3 text-foreground/40 border-white/5 hover:bg-white/8"
          }`}
        >
          All
        </button>
        {ALL_TAGS.map((tag) => (
          <button
            key={tag}
            onClick={() => setActiveTag(activeTag === tag ? null : tag)}
            className={`px-2 py-1 rounded text-[9px] uppercase tracking-wider border transition-all ${
              activeTag === tag
                ? TAG_STYLE[tag]
                : "bg-white/3 text-foreground/40 border-white/5 hover:bg-white/8"
            }`}
          >
            {tag}
          </button>
        ))}
      </div>

      {/* Model List */}
      {loading ? (
        <div className="flex items-center justify-center py-6">
          <RefreshCw size={16} className="text-foreground/30 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-6 text-center text-[10px] text-foreground/30 uppercase tracking-widest">
          No models found
        </div>
      ) : (
        <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1 scrollbar-thin">
          {filtered.map((model) => (
            <div
              key={model.id}
              className="group flex items-start gap-3 p-3 rounded border border-primary/5 bg-white/1 hover:bg-primary/5 hover:border-primary/20 transition-all"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-medium text-foreground truncate">
                    {model.name.replace(/^(OpenAI|Anthropic|Google|Meta|DeepSeek|Mistral|Qwen|xAI|NVIDIA|Perplexity|MiniMax|Mistral): /, "")}
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/10 uppercase font-medium flex-shrink-0">
                    {model.provider}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[9px] font-mono text-foreground/35 truncate">{model.id}</span>
                </div>
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  <span className="text-[9px] text-foreground/40">
                    {formatContext(model.contextLength)} ctx
                  </span>
                  {model.promptPrice >= 0 && (
                    <span className="text-[9px] text-foreground/40">
                      {formatPrice(model.promptPrice)} in
                    </span>
                  )}
                  {model.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className={`text-[8px] px-1.5 py-0.5 rounded border ${TAG_STYLE[tag]}`}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <button
                onClick={() => copyModelId(model.id)}
                className="p-1.5 text-foreground/20 hover:text-foreground/70 hover:bg-foreground/10 rounded transition-all opacity-0 group-hover:opacity-100 flex-shrink-0 relative"
                title="Copy model ID"
              >
                {copiedId === model.id ? (
                  <Check size={13} className="text-green-400" />
                ) : (
                  <Copy size={13} />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ModelSelectorToggle({
  sporaKeyId,
}: {
  sporaKeyId: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-1.5 px-2 py-1 rounded text-[9px] uppercase tracking-wider text-foreground/40 hover:text-primary hover:bg-primary/10 border border-transparent hover:border-primary/20 transition-all"
      >
        <Zap size={10} />
        Models
        {open ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
      </button>
      {open && <ModelSelector sporaKeyId={sporaKeyId} />}
    </div>
  );
}
