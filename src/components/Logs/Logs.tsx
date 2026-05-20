import React, { useState, useEffect, useRef } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { RefreshCw, SlidersHorizontal, ChevronDown, Check, Copy, MoreHorizontal } from "lucide-react";
import { analyticsApi, keysApi } from "../../lib/tauri";
import { listen } from "@tauri-apps/api/event";
import type { RequestLog, SporaKey } from "../../lib/types";

// ── Time-range (shared with Activity) ────────────────────────────
type RangeKey =
  | "15m" | "30m" | "1h" | "3h" | "1d" | "2d" | "1w" | "1mo" | "1y"
  | "today" | "yesterday" | "thisweek" | "prevweek"
  | "thismonth" | "prevmonth" | "thisyear" | "prevyear";

interface RangeOption { key: RangeKey; short: string; label: string }

const ROLLING: RangeOption[] = [
  { key: "15m", short: "15m", label: "Past 15 Minutes" },
  { key: "30m", short: "30m", label: "Past 30 Minutes" },
  { key: "1h",  short: "1h",  label: "Past 1 Hour" },
  { key: "3h",  short: "3h",  label: "Past 3 Hours" },
  { key: "1d",  short: "1d",  label: "Past 1 Day" },
  { key: "2d",  short: "2d",  label: "Past 2 Days" },
  { key: "1w",  short: "1w",  label: "Past 1 Week" },
  { key: "1mo", short: "1mo", label: "Past 1 Month" },
  { key: "1y",  short: "1y",  label: "Past 1 Year" },
];
const CALENDAR_LEFT: RangeOption[] = [
  { key: "today",     short: "2h",  label: "Today" },
  { key: "thisweek",  short: "3d",  label: "This Week" },
  { key: "thismonth", short: "20d", label: "This Month" },
  { key: "thisyear",  short: "5mo", label: "This Year" },
];
const CALENDAR_RIGHT: RangeOption[] = [
  { key: "yesterday", short: "24h", label: "Yesterday" },
  { key: "prevweek",  short: "7d",  label: "Prev Week" },
  { key: "prevmonth", short: "30d", label: "Prev Month" },
  { key: "prevyear",  short: "1y",  label: "Prev Year" },
];

const ALL = [...ROLLING, ...CALENDAR_LEFT, ...CALENDAR_RIGHT];

function resolveRange(key: RangeKey): { from: number; to: number } {
  const now = Math.floor(Date.now() / 1000);
  const d = new Date(); d.setHours(0, 0, 0, 0);
  const ts = Math.floor(d.getTime() / 1000);
  const map: Record<RangeKey, { from: number; to: number }> = {
    "15m":       { from: now - 900,      to: now },
    "30m":       { from: now - 1800,     to: now },
    "1h":        { from: now - 3600,     to: now },
    "3h":        { from: now - 10800,    to: now },
    "1d":        { from: now - 86400,    to: now },
    "2d":        { from: now - 172800,   to: now },
    "1w":        { from: now - 604800,   to: now },
    "1mo":       { from: now - 2592000,  to: now },
    "1y":        { from: now - 31536000, to: now },
    "today":     { from: ts,             to: now },
    "yesterday": { from: ts - 86400,     to: ts - 1 },
    "thisweek":  { from: ts - d.getDay() * 86400, to: now },
    "prevweek":  { from: ts - (d.getDay() + 7) * 86400, to: ts - d.getDay() * 86400 - 1 },
    "thismonth": { from: Math.floor(new Date(d.getFullYear(), d.getMonth(), 1).getTime() / 1000), to: now },
    "prevmonth": { from: Math.floor(new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime() / 1000), to: Math.floor(new Date(d.getFullYear(), d.getMonth(), 1).getTime() / 1000) - 1 },
    "thisyear":  { from: Math.floor(new Date(d.getFullYear(), 0, 1).getTime() / 1000), to: now },
    "prevyear":  { from: Math.floor(new Date(d.getFullYear() - 1, 0, 1).getTime() / 1000), to: Math.floor(new Date(d.getFullYear(), 0, 1).getTime() / 1000) - 1 },
  };
  return map[key];
}

// ── TimeframePicker ───────────────────────────────────────────────
function TimeframePicker({ value, onChange }: { value: RangeKey; onChange: (k: RangeKey) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const sel = ALL.find(r => r.key === value) ?? ROLLING[4];
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 h-8 pl-2 pr-3 rounded-md border border-white/10 bg-white/5 text-[11px] text-foreground/70 hover:bg-white/10 transition-all"
      >
        <span className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-medium text-foreground/50">{sel.short}</span>
        <span>{sel.label}</span>
        <ChevronDown size={12} className="text-foreground/40" />
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 rounded-lg border border-white/10 bg-[#0f0f0f] shadow-2xl overflow-hidden">
          <div className="py-1">
            {ROLLING.map(r => (
              <button key={r.key} onClick={() => { onChange(r.key); setOpen(false); }}
                className={`w-full flex items-center justify-between px-4 py-2 text-[12px] hover:bg-white/5 ${value === r.key ? "text-foreground font-semibold" : "text-foreground/60"}`}>
                <div className="flex items-center gap-3">
                  <span className="w-9 text-[10px] text-foreground/40 font-mono">{r.short}</span>
                  <span>{r.label}</span>
                </div>
                {value === r.key && <Check size={13} className="text-primary" />}
              </button>
            ))}
          </div>
          <div className="border-t border-white/5 py-1 grid grid-cols-2">
            {CALENDAR_LEFT.map((r, i) => (
              <React.Fragment key={r.key}>
                <button onClick={() => { onChange(r.key); setOpen(false); }}
                  className={`flex items-center gap-2 px-4 py-2 text-[12px] hover:bg-white/5 ${value === r.key ? "text-foreground font-semibold" : "text-foreground/60"}`}>
                  <span className="px-1.5 py-0.5 rounded bg-white/8 text-[9px] text-foreground/40 font-mono">{r.short}</span>
                  <span>{r.label}</span>
                </button>
                <button onClick={() => { onChange(CALENDAR_RIGHT[i].key); setOpen(false); }}
                  className={`flex items-center gap-2 px-4 py-2 text-[12px] hover:bg-white/5 ${value === CALENDAR_RIGHT[i].key ? "text-foreground font-semibold" : "text-foreground/60"}`}>
                  <span className="px-1.5 py-0.5 rounded bg-white/8 text-[9px] text-foreground/40 font-mono">{CALENDAR_RIGHT[i].short}</span>
                  <span>{CALENDAR_RIGHT[i].label}</span>
                </button>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sessions empty state code snippets ───────────────────────────
type SnippetTab = "spora" | "openai-python" | "typescript" | "curl";

const SNIPPETS: Record<SnippetTab, string> = {
  "spora": `import OpenAI from "openai";

const client = new OpenAI({
  apiKey: "<SPORA_KEY>",
  baseURL: "http://localhost:4141/v1",
});

const completion = await client.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Hello" }],
});

// Pass session_id as extra_headers to group requests
`,
  "openai-python": `from openai import OpenAI

client = OpenAI(
    api_key="<SPORA_KEY>",
    base_url="http://localhost:4141/v1",
)

completion = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello"}],
    extra_headers={"X-Session-ID": "my-session-123"},
)
print(completion.choices[0].message)`,
  "typescript": `import OpenAI from "openai";

const client = new OpenAI({
  apiKey: "<SPORA_KEY>",
  baseURL: "http://localhost:4141/v1",
  defaultHeaders: { "X-Session-ID": "my-session-123" },
});

const completion = await client.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Hello" }],
});`,
  "curl": `curl http://localhost:4141/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <SPORA_KEY>" \\
  -H "X-Session-ID: my-session-123" \\
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Hello"}]
  }'`,
};

// ── Log row expanded view ────────────────────────────────────────
function LogDetailRow({ log }: { log: RequestLog }) {
  function prettyJson(s: string | undefined) {
    if (!s) return null;
    try { return JSON.stringify(JSON.parse(s), null, 2); } catch { return s; }
  }
  return (
    <tr className="bg-[#0a0a0a] border-b border-white/5">
      <td colSpan={9} className="px-6 py-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col">
            <h4 className="text-[10px] text-foreground/40 mb-2 uppercase tracking-wider">Request</h4>
            <div className="bg-black/60 border border-white/5 rounded p-3 overflow-y-auto max-h-56">
              <pre className="text-[10px] text-foreground/70 whitespace-pre-wrap font-mono break-all">
                {prettyJson(log.requestBody) ?? "No body captured"}
              </pre>
            </div>
          </div>
          <div className="flex flex-col">
            <h4 className="text-[10px] text-foreground/40 mb-2 uppercase tracking-wider">Response</h4>
            <div className="bg-black/60 border border-white/5 rounded p-3 overflow-y-auto max-h-56">
              <pre className="text-[10px] text-foreground/70 whitespace-pre-wrap font-mono break-all">
                {prettyJson(log.responseBody) ?? "No body captured"}
              </pre>
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}

// ── Generations tab ──────────────────────────────────────────────
function GenerationsTab({
  range, sporaKeys,
}: { range: RangeKey; sporaKeys: SporaKey[] }) {
  const PAGE = 20;
  const [logs, setLogs] = useState<RequestLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filterModel, setFilterModel] = useState<string | null>(null);
  const [filterKeyId, setFilterKeyId] = useState<string | null>(null);
  const [chartData, setChartData] = useState<{ time: string; count: number }[]>([]);

  const filtersRef = useRef({ filterModel, filterKeyId });
  filtersRef.current = { filterModel, filterKeyId };

  useEffect(() => { loadPage(0); }, [range, filterModel, filterKeyId]);

  useEffect(() => {
    const unlisten = listen<RequestLog>("new-request-log", (event) => {
      const log = event.payload;
      const f = filtersRef.current;
      if (f.filterModel && log.model !== f.filterModel) return;
      if (f.filterKeyId && log.sporaKeyId !== f.filterKeyId) return;
      setLogs(prev => prev.some(l => l.id === log.id) ? prev : [log, ...prev.slice(0, PAGE - 1)]);
      setTotal(prev => prev + 1);
    });
    return () => { unlisten.then(fn => fn()); };
  }, []);

  async function loadPage(p: number) {
    setLoading(true);
    const { from, to } = resolveRange(range);
    try {
      const result = await analyticsApi.getRequestLogs({
        limit: PAGE, offset: p * PAGE,
        sporaKeyId: filterKeyId ?? null, provider: null, model: filterModel ?? null,
      });
      setLogs(result.logs);
      setTotal(result.total);
      setPage(p);

      // Build mini chart: bucket by hour
      const buckets = new Map<string, number>();
      result.logs.forEach(l => {
        const h = new Date(l.ts * 1000);
        h.setMinutes(0, 0, 0);
        const k = h.toLocaleTimeString("en-US", { hour: "numeric", hour12: true });
        buckets.set(k, (buckets.get(k) ?? 0) + 1);
      });
      setChartData(Array.from(buckets.entries()).map(([time, count]) => ({ time, count })));

      // suppress unused param warning
      void from; void to;
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const distinctModels = [...new Set(logs.map(l => l.model))].sort();

  return (
    <div className="flex flex-col gap-0">
      {/* Mini chart */}
      {chartData.length > 0 && (
        <div className="h-24 px-6 pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
              <XAxis dataKey="time" tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip
                contentStyle={{ background: "#111", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, fontSize: 11 }}
                formatter={(v: number) => [v, "requests"]}
              />
              <Bar dataKey="count" fill="#dffb0a" radius={[2, 2, 0, 0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-white/5">
        <select
          value={filterModel ?? ""}
          onChange={e => setFilterModel(e.target.value || null)}
          className="h-7 bg-white/5 border border-white/10 rounded px-2 text-[11px] text-foreground/60 focus:outline-none focus:border-primary/30"
        >
          <option value="">All Models</option>
          {distinctModels.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select
          value={filterKeyId ?? ""}
          onChange={e => setFilterKeyId(e.target.value || null)}
          className="h-7 bg-white/5 border border-white/10 rounded px-2 text-[11px] text-foreground/60 focus:outline-none focus:border-primary/30"
        >
          <option value="">All Keys</option>
          {sporaKeys.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
        </select>
        <span className="text-[11px] text-foreground/30 ml-auto">{total.toLocaleString()} generations</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-white/5 text-foreground/30 uppercase text-[10px] tracking-wider">
              <th className="text-left px-6 py-3 font-medium">Date</th>
              <th className="text-left px-4 py-3 font-medium">Model</th>
              <th className="text-left px-4 py-3 font-medium">Provider</th>
              <th className="text-left px-4 py-3 font-medium">Key</th>
              <th className="text-right px-4 py-3 font-medium">Input</th>
              <th className="text-right px-4 py-3 font-medium">Output</th>
              <th className="text-right px-4 py-3 font-medium">Cost</th>
              <th className="text-right px-4 py-3 font-medium">Speed</th>
              <th className="text-right px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="text-center py-12 text-foreground/20 text-[11px]">Loading…</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-12 text-foreground/20 text-[11px]">No generations yet</td></tr>
            ) : (
              logs.map(log => (
                <React.Fragment key={log.id}>
                  <tr
                    onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                    className={`border-b border-white/5 hover:bg-white/2 cursor-pointer transition-colors ${expanded === log.id ? "bg-white/3" : ""}`}
                  >
                    <td className="px-6 py-3 text-foreground/50 whitespace-nowrap">
                      {new Date(log.ts * 1000).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center text-[8px] text-foreground/40 shrink-0">
                          →
                        </div>
                        <span className="text-foreground/70 text-[11px] truncate max-w-[200px]">{log.model}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-foreground/50 capitalize">{log.provider}</td>
                    <td className="px-4 py-3 text-foreground/50 truncate max-w-[120px]">{log.sporaKeyLabel ?? "—"}</td>
                    <td className="px-4 py-3 text-right text-foreground/50">{log.promptTokens.toLocaleString()} tok</td>
                    <td className="px-4 py-3 text-right text-foreground/50">{log.completionTokens.toLocaleString()} tok</td>
                    <td className="px-4 py-3 text-right text-foreground/50">${log.costUsd.toFixed(4)}</td>
                    <td className="px-4 py-3 text-right text-foreground/50">
                      {log.latencyMs > 0
                        ? `${((log.promptTokens + log.completionTokens) / (log.latencyMs / 1000)).toFixed(1)} tok/s`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`px-2 py-0.5 rounded text-[9px] uppercase font-medium ${
                        log.statusCode < 300
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : log.statusCode < 500
                          ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          : "bg-red-500/10 text-red-400 border border-red-500/20"
                      }`}>
                        {log.statusCode < 300 ? "stop" : log.statusCode}
                      </span>
                    </td>
                  </tr>
                  {expanded === log.id && <LogDetailRow log={log} />}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > PAGE && (
        <div className="flex items-center justify-between px-6 py-3 border-t border-white/5">
          <button
            onClick={() => loadPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="text-[11px] text-foreground/40 hover:text-foreground/70 disabled:opacity-30 transition-colors"
          >
            ← Previous
          </button>
          <span className="text-[11px] text-foreground/30">
            Page {page + 1} of {Math.ceil(total / PAGE)}
          </span>
          <button
            onClick={() => loadPage(page + 1)}
            disabled={(page + 1) * PAGE >= total}
            className="text-[11px] text-foreground/40 hover:text-foreground/70 disabled:opacity-30 transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

// ── Sessions tab ─────────────────────────────────────────────────
function SessionsTab() {
  const [activeSnippet, setActiveSnippet] = useState<SnippetTab>("spora");
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(SNIPPETS[activeSnippet]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const tabs: { key: SnippetTab; label: string }[] = [
    { key: "spora", label: "Spora SDK" },
    { key: "openai-python", label: "openai-python" },
    { key: "typescript", label: "TypeScript" },
    { key: "curl", label: "curl" },
  ];

  return (
    <div className="flex flex-col items-center justify-center py-20 px-8 gap-8">
      <div className="text-center space-y-3">
        <h2 className="text-xl font-semibold text-foreground/80">You don't have any sessions yet</h2>
        <p className="text-sm text-foreground/40 max-w-xl">
          Group related generations into sessions to follow full conversations, debug chains,
          and track multi-step agents. Pass an{" "}
          <code className="px-1.5 py-0.5 rounded bg-white/10 text-foreground/70 text-[12px] font-mono">
            X-Session-ID
          </code>{" "}
          header in your API request to get started.
        </p>
      </div>

      {/* Code snippet */}
      <div className="w-full max-w-2xl rounded-lg border border-white/10 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 bg-white/3 border-b border-white/5">
          <div className="flex gap-1">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setActiveSnippet(t.key)}
                className={`px-3 py-1 rounded text-[11px] transition-all ${
                  activeSnippet === t.key
                    ? "bg-white/10 text-foreground/90"
                    : "text-foreground/40 hover:text-foreground/70 hover:bg-white/5"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-[11px] text-foreground/40 hover:text-foreground/70 transition-colors"
          >
            <Copy size={12} />
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <div className="bg-[#0a0a0a] p-5 overflow-x-auto">
          <pre className="text-[12px] font-mono text-foreground/70 leading-relaxed">
            {SNIPPETS[activeSnippet].split("\n").map((line, i) => {
              const importStyle = line.startsWith("import") || line.startsWith("from");
              const commentStyle = line.trim().startsWith("//") || line.trim().startsWith("#");
              const stringStyle = line.includes('"<') || line.includes('"http') || line.includes('"my-');
              return (
                <span key={i} className={`block ${importStyle ? "text-primary/80" : commentStyle ? "text-foreground/30 italic" : stringStyle ? "text-amber-400/80" : ""}`}>
                  {line || "\u00A0"}
                </span>
              );
            })}
          </pre>
        </div>
      </div>
    </div>
  );
}

// ── Main Logs Component ──────────────────────────────────────────
type LogTab = "generations" | "sessions";

export default function Logs() {
  const [activeTab, setActiveTab] = useState<LogTab>("generations");
  const [range, setRange] = useState<RangeKey>("1d");
  const [sporaKeys, setSporaKeys] = useState<SporaKey[]>([]);

  useEffect(() => {
    keysApi.listSporaKeys().then(setSporaKeys).catch(() => {});
  }, []);

  const tabs: { key: LogTab; label: string }[] = [
    { key: "generations", label: "Generations" },
    { key: "sessions",    label: "Sessions" },
  ];

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="px-8 pt-6 pb-4 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground tracking-tight">Logs</h1>
            <p className="text-sm text-foreground/40 mt-0.5">View your request logs and history.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.location.reload()}
              className="w-8 h-8 flex items-center justify-center rounded-md border border-white/10 bg-white/5 text-foreground/40 hover:text-foreground/70 hover:bg-white/10 transition-all"
            >
              <RefreshCw size={14} />
            </button>
            <button className="w-8 h-8 flex items-center justify-center rounded-md border border-white/10 bg-white/5 text-foreground/40 hover:text-foreground/70 hover:bg-white/10 transition-all">
              <SlidersHorizontal size={14} />
            </button>
            <TimeframePicker value={range} onChange={setRange} />
            <button className="w-8 h-8 flex items-center justify-center rounded-md border border-white/10 bg-white/5 text-foreground/40 hover:text-foreground/70 hover:bg-white/10 transition-all">
              <MoreHorizontal size={14} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 px-8 border-b border-white/8">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-4 py-3 text-[13px] transition-all border-b-2 -mb-px ${
                activeTab === t.key
                  ? "border-foreground text-foreground font-medium"
                  : "border-transparent text-foreground/40 hover:text-foreground/70"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "generations" && (
          <GenerationsTab range={range} sporaKeys={sporaKeys} />
        )}
        {activeTab === "sessions" && <SessionsTab />}
      </div>
    </div>
  );
}
