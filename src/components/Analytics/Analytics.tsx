import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { RefreshCw, TrendingUp, DollarSign, Clock, Cpu } from "lucide-react";
import { analyticsApi } from "../../lib/tauri";
import type {
  UsageStats,
  ProviderUsage,
  ModelUsage,
  KeyUsage,
  DailyUsage,
  RequestLog,
} from "../../lib/types";

const COLORS = ["#dffb0a", "#c8e109", "#afc608", "#899c06", "#677505"];
const PROVIDER_COLORS: Record<string, string> = {
  openai: "#dffb0a",
  anthropic: "#fdfdfd",
  gemini: "#fdfdfd",
};

type TimeRange = "24h" | "7d" | "30d" | "all";

function getTimeRange(range: TimeRange): { from: number | null; to: number | null } {
  const now = Math.floor(Date.now() / 1000);
  if (range === "all") return { from: null, to: null };
  const durations: Record<Exclude<TimeRange, "all">, number> = {
    "24h": 86400,
    "7d": 604800,
    "30d": 2592000,
  };
  return { from: now - durations[range as Exclude<TimeRange, "all">], to: now };
}

function ActivityCalendar({ data }: { data: DailyUsage[] }) {
  const today = new Date();
  const numDays = 365;
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - numDays + 1);

  const map = new Map(data.map((d) => [d.date, d.requests]));
  let maxReq = 0;
  for (const r of map.values()) if (r > maxReq) maxReq = r;

  const calendarDays = [];
  for (let i = 0; i < numDays; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const dateStr = `${y}-${m}-${day}`;
    const requests = map.get(dateStr) || 0;
    calendarDays.push({
      date: dateStr,
      requests,
      month: d.toLocaleString("default", { month: "short" }),
      isFirstOfMonth: d.getDate() === 1,
    });
  }

  const startDayOfWeek = startDate.getDay();
  const paddedDays = [];
  for (let i = 0; i < startDayOfWeek; i++) {
    paddedDays.push(null);
  }
  paddedDays.push(...calendarDays);

  const months = [];
  let colIndex = 0;
  for (let i = 0; i < paddedDays.length; i += 7) {
    const week = paddedDays.slice(i, i + 7);
    const firstDay = week.find((d) => d && d.isFirstOfMonth);
    if (firstDay) {
      months.push({ col: colIndex, label: firstDay.month });
    }
    colIndex++;
  }

  return (
    <div className="flex flex-col gap-2 overflow-x-auto pb-2">
      {/* Months */}
      <div className="flex text-[9px] uppercase tracking-wider text-foreground/40 pl-6 relative h-4">
        {months.map((m, i) => (
          <span key={i} className="absolute" style={{ left: `calc(1.5rem + ${m.col * 14}px)` }}>
            {m.label}
          </span>
        ))}
      </div>
      
      <div className="flex gap-2">
        {/* Days of week */}
        <div className="grid grid-rows-7 gap-1 text-[9px] uppercase tracking-wider text-foreground/40 text-right pr-1">
          <div className="h-2.5"></div>
          <div className="h-2.5 leading-none flex items-center justify-end">Mon</div>
          <div className="h-2.5"></div>
          <div className="h-2.5 leading-none flex items-center justify-end">Wed</div>
          <div className="h-2.5"></div>
          <div className="h-2.5 leading-none flex items-center justify-end">Fri</div>
          <div className="h-2.5"></div>
        </div>
        
        {/* Grid */}
        <div className="grid grid-rows-7 gap-1 grid-flow-col">
          {paddedDays.map((day, i) => {
            if (!day) return <div key={`pad-${i}`} className="w-2.5 h-2.5" />;
            
            let bg = "bg-white/5";
            if (maxReq > 0) {
              const intensity = day.requests / maxReq;
              if (intensity > 0) bg = "bg-primary/20";
              if (intensity > 0.25) bg = "bg-primary/40";
              if (intensity > 0.5) bg = "bg-primary/70";
              if (intensity > 0.75) bg = "bg-primary";
            }
            
            return (
              <div key={day.date} className={`w-2.5 h-2.5 rounded-[2px] ${bg} relative group transition-colors hover:ring-1 hover:ring-primary/50`}>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-[#171717] border border-white/10 text-white text-[9px] uppercase tracking-wider whitespace-nowrap rounded opacity-0 group-hover:opacity-100 pointer-events-none z-10 transition-opacity">
                  <span className="text-primary font-bold">{day.requests}</span> requests on {day.date}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Legend */}
      <div className="flex items-center justify-end gap-2 text-[9px] uppercase tracking-wider text-foreground/40 mt-2">
        <span>Less</span>
        <div className="flex gap-1">
          <div className="w-2.5 h-2.5 rounded-[2px] bg-white/5"></div>
          <div className="w-2.5 h-2.5 rounded-[2px] bg-primary/20"></div>
          <div className="w-2.5 h-2.5 rounded-[2px] bg-primary/40"></div>
          <div className="w-2.5 h-2.5 rounded-[2px] bg-primary/70"></div>
          <div className="w-2.5 h-2.5 rounded-[2px] bg-primary"></div>
        </div>
        <span>More</span>
      </div>
    </div>
  );
}

export default function Analytics() {
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [providerUsage, setProviderUsage] = useState<ProviderUsage[]>([]);
  const [modelUsage, setModelUsage] = useState<ModelUsage[]>([]);
  const [keyUsage, setKeyUsage] = useState<KeyUsage[]>([]);
  const [dailyUsage, setDailyUsage] = useState<DailyUsage[]>([]);
  const [logs, setLogs] = useState<RequestLog[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [logPage, setLogPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState<"cost" | "requests">("cost");
  const LOG_PAGE_SIZE = 15;

  useEffect(() => {
    loadData();
  }, [timeRange]);

  async function loadData() {
    setLoading(true);
    const tr = getTimeRange(timeRange);
    const from = tr.from, to = tr.to;
    try {
      const [s, pu, mu, ku, du, logResult] = await Promise.all([
        analyticsApi.getUsageStats(from, to),
        analyticsApi.getProviderUsage(from, to),
        analyticsApi.getModelUsage(from, to),
        analyticsApi.getKeyUsage(from, to),
        analyticsApi.getDailyUsage(null, null), // Fetch all history for calendar
        analyticsApi.getRequestLogs({
          limit: LOG_PAGE_SIZE,
          offset: 0,
          sporaKeyId: null,
          provider: null,
        }),
      ]);
      setStats(s);
      setProviderUsage(pu);
      setModelUsage(mu);
      setKeyUsage(ku);
      setDailyUsage(du);
      setLogs(logResult.logs);
      setTotalLogs(logResult.total);
      setLogPage(0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function loadMoreLogs(page: number) {
    const result = await analyticsApi.getRequestLogs({
      limit: LOG_PAGE_SIZE,
      offset: page * LOG_PAGE_SIZE,
      sporaKeyId: null,
      provider: null,
    });
    setLogs(result.logs);
    setLogPage(page);
  }

  const statCards = stats
    ? [
        {
          label: "Total Requests",
          value: stats.totalRequests.toLocaleString(),
          icon: <TrendingUp size={14} />,
          color: "text-primary",
          bg: "bg-primary/5",
        },
        {
          label: "Total Cost",
          value: `$${stats.totalCostUsd.toFixed(4)}`,
          icon: <DollarSign size={14} />,
          color: "text-foreground",
          bg: "bg-foreground/5",
        },
        {
          label: "Total Tokens",
          value: stats.totalTokens.toLocaleString(),
          icon: <Cpu size={14} />,
          color: "text-primary",
          bg: "bg-primary/5",
        },
        {
          label: "Avg Latency",
          value: `${Math.round(stats.avgLatencyMs)}ms`,
          icon: <Clock size={14} />,
          color: "text-foreground/60",
          bg: "bg-foreground/5",
        },
      ]
    : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw size={20} className="text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-5 pb-20 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {(["24h", "7d", "30d", "all"] as TimeRange[]).map((r) => (
            <button
              key={r}
              onClick={() => setTimeRange(r)}
              className={`px-3 py-1.5 rounded text-[10px] uppercase tracking-wider transition-all ${
                timeRange === r
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "text-foreground/40 hover:text-foreground/70 hover:bg-white/5"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <button
          onClick={loadData}
          className="p-1.5 rounded text-foreground/30 hover:text-foreground/60 hover:bg-white/5 transition-all"
        >
          <RefreshCw size={13} />
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="p-4 rounded border border-white/5 bg-white/1 flex items-center gap-3"
          >
            <div className={`w-8 h-8 rounded ${card.bg} flex items-center justify-center shrink-0`}>
              <span className={card.color}>{card.icon}</span>
            </div>
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-wider text-foreground/40 leading-none mb-1">{card.label}</div>
              <div className="text-base font-medium text-primary leading-none">{card.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Daily Usage Heatmap */}
        <div className="p-4 rounded border border-white/5 bg-white/1 flex flex-col justify-between overflow-hidden">
          <h3 className="text-[10px] uppercase tracking-wider text-foreground/60 mb-4">
            Daily Requests Activity
          </h3>
          <div className="mt-auto w-full">
            <ActivityCalendar data={dailyUsage} />
          </div>
        </div>

        {/* Provider split Pie */}
        <div className="p-4 rounded border border-white/5 bg-white/1">
          <h3 className="text-[10px] uppercase tracking-wider text-foreground/60 mb-4">
            Provider Split
          </h3>
          {providerUsage.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-foreground/20 text-[10px] uppercase">
              No data
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-6 px-2">
                <div className="w-24 h-24 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={providerUsage}
                        dataKey="requests"
                        nameKey="provider"
                        cx="50%"
                        cy="50%"
                        innerRadius={28}
                        outerRadius={45}
                        paddingAngle={4}
                        stroke="none"
                      >
                        {providerUsage.map((entry) => (
                          <Cell
                            key={entry.provider}
                            fill={PROVIDER_COLORS[entry.provider] ?? COLORS[0]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "#171717",
                          border: "1px solid rgba(255,255,255,0.05)",
                          borderRadius: 4,
                          fontSize: 10,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 grid grid-cols-1 gap-2">
                  {providerUsage.map((p) => (
                    <div key={p.provider} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ background: PROVIDER_COLORS[p.provider] ?? COLORS[0] }}
                          />
                          <span className="text-foreground/80 font-medium">{p.provider}</span>
                        </div>
                        <span className="text-primary font-bold">{p.requests}</span>
                      </div>
                      <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${(p.requests / Math.max(...providerUsage.map(x => x.requests))) * 100}%`,
                            background: PROVIDER_COLORS[p.provider] ?? COLORS[0],
                            opacity: 0.8
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Model & Key Usage */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Top Models */}
        <div className="p-4 rounded border border-white/5 bg-white/1 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[10px] uppercase tracking-wider text-foreground/60">
              Top Models
            </h3>
            <div className="flex bg-white/5 rounded p-0.5">
              <button
                onClick={() => setMetric("cost")}
                className={`px-2 py-0.5 text-[9px] uppercase tracking-wider rounded transition-all ${
                  metric === "cost" ? "bg-white/10 text-foreground" : "text-foreground/40 hover:text-foreground/70"
                }`}
              >
                Cost
              </button>
              <button
                onClick={() => setMetric("requests")}
                className={`px-2 py-0.5 text-[9px] uppercase tracking-wider rounded transition-all ${
                  metric === "requests" ? "bg-white/10 text-foreground" : "text-foreground/40 hover:text-foreground/70"
                }`}
              >
                Requests
              </button>
            </div>
          </div>
          {modelUsage.length === 0 ? (
            <div className="text-center text-foreground/20 text-[10px] py-8 uppercase">No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={140} className="mt-auto">
              <BarChart
                data={[...modelUsage].sort((a, b) => metric === "cost" ? b.costUsd - a.costUsd : b.requests - a.requests).slice(0, 5)}
                layout="vertical"
                margin={{ left: 40 }}
              >
                <XAxis type="number" tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis dataKey="model" type="category" tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 10 }} axisLine={false} tickLine={false} width={180} />
                <Tooltip
                  contentStyle={{ background: "#171717", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 4, fontSize: 10 }}
                  formatter={(v: number) => [metric === "cost" ? `$${v.toFixed(5)}` : v, metric === "cost" ? "Cost" : "Requests"]}
                />
                <Bar dataKey={metric === "cost" ? "costUsd" : "requests"} fill="#dffb0a" radius={[0, 2, 2, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Key Usage */}
        <div className="p-4 rounded border border-white/5 bg-white/1 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[10px] uppercase tracking-wider text-foreground/60">
              Spora Keys
            </h3>
            <div className="flex bg-white/5 rounded p-0.5">
              <button
                onClick={() => setMetric("cost")}
                className={`px-2 py-0.5 text-[9px] uppercase tracking-wider rounded transition-all ${
                  metric === "cost" ? "bg-white/10 text-foreground" : "text-foreground/40 hover:text-foreground/70"
                }`}
              >
                Cost
              </button>
              <button
                onClick={() => setMetric("requests")}
                className={`px-2 py-0.5 text-[9px] uppercase tracking-wider rounded transition-all ${
                  metric === "requests" ? "bg-white/10 text-foreground" : "text-foreground/40 hover:text-foreground/70"
                }`}
              >
                Usage
              </button>
            </div>
          </div>
          {keyUsage.length === 0 ? (
            <div className="text-center text-foreground/20 text-[10px] py-8 uppercase">No data</div>
          ) : (
            <div className="space-y-3 mt-auto">
              {[...keyUsage]
                .sort((a, b) => metric === "cost" ? b.costUsd - a.costUsd : b.requests - a.requests)
                .slice(0, 5)
                .map((k, i) => {
                const maxVal = Math.max(...keyUsage.map((x) => metric === "cost" ? x.costUsd : x.requests), 0.0001);
                const val = metric === "cost" ? k.costUsd : k.requests;
                return (
                  <div key={k.sporaKeyId}>
                    <div className="flex items-center justify-between text-[10px] uppercase mb-1.5">
                      <span className="text-foreground/60 truncate flex-1">{k.label}</span>
                      <span className="text-foreground/40 ml-2">
                        {metric === "cost" ? `$${val.toFixed(4)}` : val.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full transition-all duration-500"
                        style={{
                          width: `${(val / maxVal) * 100}%`,
                          background: COLORS[i % COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Audit Log */}
      <div className="rounded border border-white/5 bg-white/1 overflow-hidden">
        <div className="px-4 py-2 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-[10px] uppercase tracking-wider text-foreground/60">Audit Log</h3>
          <span className="text-[10px] text-foreground/30">{totalLogs.toLocaleString()} requests</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[10px] uppercase">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left text-foreground/30 font-medium px-4 py-2">Time</th>
                <th className="text-left text-foreground/30 font-medium px-4 py-2">Key</th>
                <th className="text-left text-foreground/30 font-medium px-4 py-2">Provider</th>
                <th className="text-left text-foreground/30 font-medium px-4 py-2">Model</th>
                <th className="text-right text-foreground/30 font-medium px-4 py-2">Tokens</th>
                <th className="text-right text-foreground/30 font-medium px-4 py-2">Cost</th>
                <th className="text-right text-foreground/30 font-medium px-4 py-2">Latency</th>
                <th className="text-right text-foreground/30 font-medium px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center text-foreground/20 py-8">
                    No requests logged yet
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-white/3 hover:bg-white/2 transition-all"
                  >
                    <td className="px-4 py-1.5 text-foreground/40 whitespace-nowrap">
                      {new Date(log.ts * 1000).toLocaleTimeString()}
                    </td>
                    <td className="px-4 py-1.5 text-foreground/60 max-w-[100px] truncate">
                      {log.sporaKeyLabel ?? "—"}
                    </td>
                    <td className="px-4 py-1.5">
                      <span
                        className="px-1.5 py-0.5 rounded text-[9px]"
                        style={{
                          background: `${PROVIDER_COLORS[log.provider]}10`,
                          color: PROVIDER_COLORS[log.provider],
                          border: `1px solid ${PROVIDER_COLORS[log.provider]}20`
                        }}
                      >
                        {log.provider}
                      </span>
                    </td>
                    <td className="px-4 py-1.5 text-foreground/50 max-w-[120px] truncate">{log.model}</td>
                    <td className="px-4 py-1.5 text-right text-foreground/50">
                      {(log.promptTokens + log.completionTokens).toLocaleString()}
                    </td>
                    <td className="px-4 py-1.5 text-right text-foreground/50">
                      ${log.costUsd.toFixed(5)}
                    </td>
                    <td className="px-4 py-1.5 text-right text-foreground/50">
                      {log.latencyMs}ms
                    </td>
                    <td className="px-4 py-1.5 text-right">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] ${
                          log.statusCode < 300
                            ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                            : log.statusCode < 500
                            ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                            : "bg-red-500/10 text-red-500 border border-red-500/20"
                        }`}
                      >
                        {log.statusCode}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalLogs > LOG_PAGE_SIZE && (
          <div className="px-4 py-2 border-t border-white/5 flex items-center justify-between">
            <button
              onClick={() => loadMoreLogs(Math.max(0, logPage - 1))}
              disabled={logPage === 0}
              className="text-[10px] text-foreground/40 hover:text-foreground/70 disabled:opacity-30 transition-colors uppercase"
            >
              ← Previous
            </button>
            <span className="text-[10px] text-foreground/30 uppercase">
              Page {logPage + 1} of {Math.ceil(totalLogs / LOG_PAGE_SIZE)}
            </span>
            <button
              onClick={() => loadMoreLogs(logPage + 1)}
              disabled={(logPage + 1) * LOG_PAGE_SIZE >= totalLogs}
              className="text-[10px] text-foreground/40 hover:text-foreground/70 disabled:opacity-30 transition-colors uppercase"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
