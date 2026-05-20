import React, { useState, useEffect, useRef } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { RefreshCw, ChevronDown, SlidersHorizontal, Check } from "lucide-react";
import { analyticsApi, keysApi } from "../../lib/tauri";
import type { ModelUsage, KeyUsage, DailyUsage, SporaKey } from "../../lib/types";

// ── Colours ──────────────────────────────────────────────────────
const SEGMENT_COLORS = [
  "#dffb0a","#c8e109","#afc608","#899c06","#677505",
  "#a3e635","#65a30d","#4d7c0f","#3f6212","#84cc16",
];

// ── Time-range ───────────────────────────────────────────────────
type RangeKey =
  | "15m" | "30m" | "1h" | "3h" | "1d" | "2d" | "1w" | "1mo" | "1y"
  | "today" | "yesterday" | "thisweek" | "prevweek"
  | "thismonth" | "prevmonth" | "thisyear" | "prevyear";

interface RangeOption { key: RangeKey; short: string; label: string }

const ROLLING: RangeOption[] = [
  { key: "15m",  short: "15m",  label: "Past 15 Minutes" },
  { key: "30m",  short: "30m",  label: "Past 30 Minutes" },
  { key: "1h",   short: "1h",   label: "Past 1 Hour" },
  { key: "3h",   short: "3h",   label: "Past 3 Hours" },
  { key: "1d",   short: "1d",   label: "Past 1 Day" },
  { key: "2d",   short: "2d",   label: "Past 2 Days" },
  { key: "1w",   short: "1w",   label: "Past 1 Week" },
  { key: "1mo",  short: "1mo",  label: "Past 1 Month" },
  { key: "1y",   short: "1y",   label: "Past 1 Year" },
];
const CALENDAR_LEFT: RangeOption[] = [
  { key: "today",     short: "2h",  label: "Today" },
  { key: "thisweek",  short: "3d",  label: "This Week" },
  { key: "thismonth", short: "20d", label: "This Month" },
  { key: "thisyear",  short: "5mo", label: "This Year" },
];
const CALENDAR_RIGHT: RangeOption[] = [
  { key: "yesterday",  short: "24h", label: "Yesterday" },
  { key: "prevweek",   short: "7d",  label: "Prev Week" },
  { key: "prevmonth",  short: "30d", label: "Prev Month" },
  { key: "prevyear",   short: "1y",  label: "Prev Year" },
];

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

const ALL_RANGES = [...ROLLING, ...CALENDAR_LEFT, ...CALENDAR_RIGHT];
const rangeLabel  = (k: RangeKey) => ALL_RANGES.find(r => r.key === k)?.label ?? k;
const rangeShort  = (k: RangeKey) => ALL_RANGES.find(r => r.key === k)?.short ?? k;

function formatDateRange(key: RangeKey): string {
  const { from, to } = resolveRange(key);
  const fmt = (ts: number) =>
    new Date(ts * 1000).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  return `${fmt(from)} – ${fmt(to)}`;
}

type GroupBy = "model" | "key";

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

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 h-8 pl-2 pr-3 rounded-md border border-white/10 bg-white/5 text-[11px] text-foreground/70 hover:bg-white/10 transition-all"
      >
        <span className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-medium text-foreground/50">
          {rangeShort(value)}
        </span>
        <span>{rangeLabel(value)}</span>
        <ChevronDown size={12} className="text-foreground/40" />
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 rounded-lg border border-white/10 bg-[#0f0f0f] shadow-2xl overflow-hidden">
          <div className="py-1">
            {ROLLING.map(r => (
              <button
                key={r.key}
                onClick={() => { onChange(r.key); setOpen(false); }}
                className={`w-full flex items-center justify-between px-4 py-2 text-[12px] hover:bg-white/5 transition-all ${value === r.key ? "text-foreground font-semibold" : "text-foreground/60"}`}
              >
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
                <button
                  onClick={() => { onChange(r.key); setOpen(false); }}
                  className={`flex items-center gap-2 px-4 py-2 text-[12px] hover:bg-white/5 ${value === r.key ? "text-foreground font-semibold" : "text-foreground/60"}`}
                >
                  <span className="px-1.5 py-0.5 rounded bg-white/8 text-[9px] text-foreground/40 font-mono">{r.short}</span>
                  <span>{r.label}</span>
                </button>
                <button
                  onClick={() => { onChange(CALENDAR_RIGHT[i].key); setOpen(false); }}
                  className={`flex items-center gap-2 px-4 py-2 text-[12px] hover:bg-white/5 ${value === CALENDAR_RIGHT[i].key ? "text-foreground font-semibold" : "text-foreground/60"}`}
                >
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

// ── GroupByPicker ────────────────────────────────────────────────
function GroupByPicker({ value, onChange }: { value: GroupBy; onChange: (g: GroupBy) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 h-8 px-3 rounded-md border border-white/10 bg-white/5 text-[11px] text-foreground/70 hover:bg-white/10 transition-all"
      >
        {value === "model" ? "By Model" : "By Spora Key"}
        <ChevronDown size={12} className="text-foreground/40" />
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-50 w-44 rounded-lg border border-white/10 bg-[#0f0f0f] shadow-2xl overflow-hidden py-1">
          {(["model", "key"] as GroupBy[]).map(g => (
            <button
              key={g}
              onClick={() => { onChange(g); setOpen(false); }}
              className={`w-full flex items-center justify-between px-4 py-2 text-[12px] hover:bg-white/5 ${value === g ? "text-foreground font-semibold" : "text-foreground/60"}`}
            >
              {g === "model" ? "By Model" : "By Spora Key"}
              {value === g && <Check size={13} className="text-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── MetricCard ───────────────────────────────────────────────────
interface MetricCardProps {
  title: string;
  total: string;
  items: { label: string; value: string; color: string }[];
  chartData: { name: string; value: number }[];
}

function MetricCard({ title, total, items, chartData }: MetricCardProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const displayTotal = hoveredIndex !== null && chartData[hoveredIndex] 
    ? (title === "Spend" ? `$${chartData[hoveredIndex].value.toFixed(chartData[hoveredIndex].value < 0.01 ? 4 : 2)}` : chartData[hoveredIndex].value.toLocaleString())
    : total;

  const displayItems = hoveredIndex !== null && items[hoveredIndex]
    ? [items[hoveredIndex]]
    : items;

  return (
    <div className="flex-1 min-w-0 rounded-xl border border-white/8 bg-white/2 p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider text-foreground/50">{title}</span>
        {hoveredIndex !== null && chartData[hoveredIndex] && (
          <span className="text-[10px] text-primary font-medium animate-in fade-in slide-in-from-right-1">
            {chartData[hoveredIndex].name}
          </span>
        )}
      </div>
      <div className="text-3xl font-semibold text-foreground tracking-tight h-9 flex items-baseline gap-1">
        {displayTotal}
        {title === "Tokens" && hoveredIndex === null && <span className="text-sm font-normal text-foreground/30">Total</span>}
      </div>
      {chartData.length > 0 ? (
        <div className="h-28">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={chartData} 
              margin={{ left: 0, right: 0, top: 0, bottom: 0 }}
              onMouseMove={(state) => {
                if (state.activeTooltipIndex !== undefined) setHoveredIndex(state.activeTooltipIndex);
              }}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <XAxis dataKey="name" hide />
              <YAxis hide />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.03)" }}
                contentStyle={{ background: "#111", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, fontSize: 11 }}
                itemStyle={{ color: "#dffb0a", fontSize: "10px", textTransform: "uppercase" }}
                labelStyle={{ display: "none" }}
                formatter={(v: number) => [v.toLocaleString(), title]}
              />
              <Bar dataKey="value" radius={[2, 2, 0, 0]} maxBarSize={18}>
                {chartData.map((_d, i) => (
                  <Cell 
                    key={i} 
                    fill={SEGMENT_COLORS[i % SEGMENT_COLORS.length]} 
                    fillOpacity={hoveredIndex === null || hoveredIndex === i ? 1 : 0.3}
                    className="transition-all duration-200"
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-28 flex items-center justify-center text-foreground/20 text-[10px] uppercase">
          No data
        </div>
      )}
      <div className="space-y-2.5 min-h-[100px]">
        {displayItems.slice(0, 4).map((item, i) => (
          <div key={i} className="flex items-center justify-between text-[11px] animate-in fade-in duration-200">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: item.color }} />
              <span className="text-foreground/70 truncate">{item.label}</span>
            </div>
            <span className="text-foreground/60 ml-2 shrink-0">{item.value}</span>
          </div>
        ))}
        {hoveredIndex === null && items.length > 4 && (
          <div className="flex items-center justify-between text-[11px] opacity-40">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-white/20" />
              <span>Others</span>
            </div>
            <span>—</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── ActivityCalendar ─────────────────────────────────────────────
function ActivityCalendar({ data }: { data: DailyUsage[] }) {
  const today = new Date();
  const numDays = 365;
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - numDays + 1);
  const map = new Map(data.map((d) => [d.date, d.requests]));
  let maxReq = 0;
  for (const r of map.values()) if (r > maxReq) maxReq = r;

  const calendarDays: { date: string; requests: number; month: string; isFirstOfMonth: boolean }[] = [];
  for (let i = 0; i < numDays; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    calendarDays.push({
      date: dateStr,
      requests: map.get(dateStr) || 0,
      month: d.toLocaleString("default", { month: "short" }),
      isFirstOfMonth: d.getDate() === 1,
    });
  }

  const paddedDays: (typeof calendarDays[0] | null)[] = [];
  for (let i = 0; i < startDate.getDay(); i++) paddedDays.push(null);
  paddedDays.push(...calendarDays);

  const months: { col: number; label: string }[] = [];
  let colIndex = 0;
  for (let i = 0; i < paddedDays.length; i += 7) {
    const first = paddedDays.slice(i, i + 7).find(d => d?.isFirstOfMonth);
    if (first) months.push({ col: colIndex, label: first.month });
    colIndex++;
  }

  return (
    <div className="flex flex-col gap-1.5 overflow-x-auto pb-1">
      <div className="flex text-[9px] uppercase tracking-wider text-foreground/30 pl-6 relative h-4">
        {months.map((m, i) => (
          <span key={i} className="absolute" style={{ left: `calc(1.5rem + ${m.col * 14}px)` }}>
            {m.label}
          </span>
        ))}
      </div>
      <div className="flex gap-1.5">
        <div className="grid grid-rows-7 gap-1 text-[9px] text-foreground/30 text-right pr-1">
          {["", "Mon", "", "Wed", "", "Fri", ""].map((l, i) => (
            <div key={i} className="h-2.5 flex items-center justify-end">{l}</div>
          ))}
        </div>
        <div className="grid grid-rows-7 gap-1 grid-flow-col">
          {paddedDays.map((day, i) => {
            if (!day) return <div key={`p${i}`} className="w-2.5 h-2.5" />;
            let bg = "bg-white/5";
            if (maxReq > 0) {
              const t = day.requests / maxReq;
              if (t > 0) bg = "bg-primary/20";
              if (t > 0.25) bg = "bg-primary/40";
              if (t > 0.5) bg = "bg-primary/70";
              if (t > 0.75) bg = "bg-primary";
            }
            return (
              <div key={day.date} className={`w-2.5 h-2.5 rounded-[2px] ${bg} relative group hover:ring-1 hover:ring-primary/50`}>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-[#111] border border-white/10 text-[9px] whitespace-nowrap rounded opacity-0 group-hover:opacity-100 pointer-events-none z-10">
                  <span className="text-primary font-bold">{day.requests}</span> req · {day.date}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────
export default function Activity() {
  const [range, setRange] = useState<RangeKey>("1d");
  const [groupBy, setGroupBy] = useState<GroupBy>("model");
  const [modelUsage, setModelUsage] = useState<ModelUsage[]>([]);
  const [keyUsage, setKeyUsage] = useState<KeyUsage[]>([]);
  const [dailyUsage, setDailyUsage] = useState<DailyUsage[]>([]);
  const [totalCost, setTotalCost] = useState(0);
  const [totalRequests, setTotalRequests] = useState(0);
  const [totalTokens, setTotalTokens] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sporaKeys, setSporaKeys] = useState<SporaKey[]>([]);

  useEffect(() => {
    keysApi.listSporaKeys().then(setSporaKeys).catch(() => {});
    analyticsApi.getDailyUsage(null, null).then(setDailyUsage).catch(() => {});
  }, []);

  useEffect(() => { loadData(); }, [range]);

  async function loadData() {
    setLoading(true);
    const { from, to } = resolveRange(range);
    try {
      const [stats, mu, ku] = await Promise.all([
        analyticsApi.getUsageStats(from, to),
        analyticsApi.getModelUsage(from, to),
        analyticsApi.getKeyUsage(from, to),
      ]);
      setTotalCost(stats.totalCostUsd);
      setTotalRequests(stats.totalRequests);
      setTotalTokens(stats.totalTokens);
      setModelUsage(mu);
      setKeyUsage(ku);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function fmtTokens(n: number) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
    return `${n}`;
  }

  const keyLabel = (id: string | null) =>
    sporaKeys.find(k => k.id === id)?.label ?? id ?? "Unknown";

  const isModel = groupBy === "model";

  const spendItems = (isModel ? modelUsage : keyUsage)
    .slice().sort((a, b) => b.costUsd - a.costUsd)
    .map((m, i) => ({
      label: isModel ? (m as ModelUsage).model : keyLabel((m as KeyUsage).sporaKeyId),
      value: `$${m.costUsd.toFixed(2)}`,
      color: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
    }));

  const requestItems = (isModel ? modelUsage : keyUsage)
    .slice().sort((a, b) => b.requests - a.requests)
    .map((m, i) => ({
      label: isModel ? (m as ModelUsage).model : keyLabel((m as KeyUsage).sporaKeyId),
      value: `${m.requests}`,
      color: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
    }));

  const tokenItems = isModel
    ? modelUsage.slice().sort((a, b) => b.tokens - a.tokens)
        .map((m, i) => ({ label: m.model, value: fmtTokens(m.tokens), color: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }))
    : keyUsage.slice().sort((a, b) => (b.tokens ?? 0) - (a.tokens ?? 0))
        .map((k, i) => ({ label: keyLabel(k.sporaKeyId), value: fmtTokens(k.tokens ?? 0), color: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }));

  const spendChart  = spendItems.map(x => ({ name: x.label, value: parseFloat(x.value.replace("$", "")) }));
  const reqChart    = requestItems.map(x => ({ name: x.label, value: parseInt(x.value) }));
  const tokenChart  = isModel
    ? modelUsage.map((m, i) => ({ name: m.model, value: m.tokens, color: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }))
    : keyUsage.map((k, i) => ({ name: keyLabel(k.sporaKeyId), value: k.tokens ?? 0, color: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }));

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="px-8 py-6 space-y-6 max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground tracking-tight">Activity</h1>
            <p className="text-sm text-foreground/40 mt-0.5">Your usage across models on Spora Gateway</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              className="w-8 h-8 flex items-center justify-center rounded-md border border-white/10 bg-white/5 text-foreground/40 hover:text-foreground/70 hover:bg-white/10 transition-all"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
            <button className="w-8 h-8 flex items-center justify-center rounded-md border border-white/10 bg-white/5 text-foreground/40 hover:text-foreground/70 hover:bg-white/10 transition-all">
              <SlidersHorizontal size={14} />
            </button>
            <TimeframePicker value={range} onChange={setRange} />
            <GroupByPicker value={groupBy} onChange={setGroupBy} />
          </div>
        </div>

        <p className="text-[11px] text-foreground/30 -mt-2">{formatDateRange(range)}</p>

        {/* Metric cards */}
        <div className="flex gap-5">
          <MetricCard
            title="Spend"
            total={`$${totalCost.toFixed(totalCost < 0.01 ? 4 : 2)}`}
            items={spendItems}
            chartData={spendChart}
          />
          <MetricCard
            title="Requests"
            total={totalRequests.toLocaleString()}
            items={requestItems}
            chartData={reqChart}
          />
          <MetricCard
            title="Tokens"
            total={fmtTokens(totalTokens)}
            items={tokenItems}
            chartData={tokenChart}
          />
        </div>

        {/* Activity calendar */}
        <div className="rounded-xl border border-white/8 bg-white/2 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[11px] uppercase tracking-wider text-foreground/50">Daily Request Activity</h3>
          </div>
          <ActivityCalendar data={dailyUsage} />
          <div className="flex items-center justify-end gap-2 text-[9px] uppercase tracking-wider text-foreground/30 mt-3">
            <span>Less</span>
            <div className="flex gap-1">
              {["bg-white/5", "bg-primary/20", "bg-primary/40", "bg-primary/70", "bg-primary"].map((c, i) => (
                <div key={i} className={`w-2.5 h-2.5 rounded-[2px] ${c}`} />
              ))}
            </div>
            <span>More</span>
          </div>
        </div>
      </div>
    </div>
  );
}
