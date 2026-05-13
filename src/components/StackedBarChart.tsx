import { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { HourlyAppBreakdown, DailyAppBreakdown } from "../types";
import { useT } from "../i18n";

const COLORS = [
  "#6366f1", "#8b5cf6", "#a855f7", "#d946ef",
  "#ec4899", "#f43f5e", "#f97316", "#eab308",
  "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6",
];
const OTHER_COLOR = "#475569";
const TOP_N = 10;

interface Props {
  hourlyData: HourlyAppBreakdown[];
  dailyData: DailyAppBreakdown[];
}

type ViewMode = "daily" | "weekly";

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${seconds}s`;
}

interface ChartData {
  chartData: Record<string, string | number>[];
  appNames: string[];
  colorMap: Record<string, string>;
}

function buildDailyChartData(
  hourlyData: HourlyAppBreakdown[],
  othersLabel: string,
): ChartData {
  const hourApps: Map<number, Map<string, number>> = new Map();
  const appTotals: Map<string, number> = new Map();

  for (const item of hourlyData) {
    if (!hourApps.has(item.hour)) hourApps.set(item.hour, new Map());
    const current = hourApps.get(item.hour)!.get(item.app_name) || 0;
    hourApps.get(item.hour)!.set(item.app_name, current + item.total_seconds);
    appTotals.set(
      item.app_name,
      (appTotals.get(item.app_name) || 0) + item.total_seconds,
    );
  }

  const sortedApps = [...appTotals.entries()]
    .sort((a, b) => b[1] - a[1]);
  const topApps = sortedApps.slice(0, TOP_N).map(([name]) => name);
  const hasOthers = sortedApps.length > TOP_N;

  const colorMap: Record<string, string> = {};
  topApps.forEach((name, i) => {
    colorMap[name] = COLORS[i % COLORS.length];
  });
  if (hasOthers) colorMap[othersLabel] = OTHER_COLOR;

  const chartData = [];
  for (let h = 0; h < 24; h++) {
    const entry: Record<string, string | number> = {
      hour: `${String(h).padStart(2, "0")}:00`,
    };
    const hourMap = hourApps.get(h) || new Map();
    for (const app of topApps) {
      entry[app] = hourMap.get(app) || 0;
    }
    if (hasOthers) {
      let othersSum = 0;
      for (const [app, secs] of hourMap) {
        if (!topApps.includes(app)) othersSum += secs;
      }
      entry[othersLabel] = othersSum;
    }
    chartData.push(entry);
  }

  return { chartData, appNames: hasOthers ? [...topApps, othersLabel] : topApps, colorMap };
}

function buildWeeklyChartData(
  dailyData: DailyAppBreakdown[],
  othersLabel: string,
  locale: string,
): ChartData {
  const dayApps: Map<string, Map<string, number>> = new Map();
  const appTotals: Map<string, number> = new Map();

  for (const item of dailyData) {
    if (!dayApps.has(item.date)) dayApps.set(item.date, new Map());
    const name = item.app_name;
    const current = dayApps.get(item.date)!.get(name) || 0;
    dayApps.get(item.date)!.set(name, current + item.total_seconds);
    appTotals.set(name, (appTotals.get(name) || 0) + item.total_seconds);
  }

  const sortedApps = [...appTotals.entries()]
    .sort((a, b) => b[1] - a[1]);
  const topApps = sortedApps.slice(0, TOP_N).map(([name]) => name);
  const hasOthers = sortedApps.length > TOP_N;

  const colorMap: Record<string, string> = {};
  topApps.forEach((name, i) => {
    colorMap[name] = COLORS[i % COLORS.length];
  });
  if (hasOthers) colorMap[othersLabel] = OTHER_COLOR;

  // Generate last 7 days
  const days: { date: string; label: string }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString(locale === "zh-CN" ? "zh-CN" : "en-US", {
      weekday: "short",
      month: "numeric",
      day: "numeric",
    });
    days.push({ date: iso, label });
  }

  const chartData = days.map(({ date, label }) => {
    const entry: Record<string, string | number> = { dateLabel: label };
    const dayMap = dayApps.get(date) || new Map();
    for (const app of topApps) {
      entry[app] = dayMap.get(app) || 0;
    }
    if (hasOthers) {
      let othersSum = 0;
      for (const [app, secs] of dayMap) {
        if (!topApps.includes(app)) othersSum += secs;
      }
      entry[othersLabel] = othersSum;
    }
    return entry;
  });

  return { chartData, appNames: hasOthers ? [...topApps, othersLabel] : topApps, colorMap };
}

function CustomTooltip({
  active,
  payload,
  label,
  colorMap,
}: {
  active?: boolean;
  payload?: { name: string; value: number }[];
  label?: string;
  colorMap: Record<string, string>;
}) {
  if (!active || !payload || !label) return null;

  const sorted = payload
    .filter((p) => p.value > 0)
    .sort((a, b) => b.value - a.value);

  if (sorted.length === 0) return null;

  const total = sorted.reduce((sum, p) => sum + p.value, 0);

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 shadow-xl">
      <div className="text-slate-200 font-medium text-sm mb-1">{label}</div>
      <div className="space-y-0.5">
        {sorted.map((p) => {
          const pct = total > 0 ? ((p.value / total) * 100).toFixed(1) : "0";
          return (
            <div key={p.name} className="flex items-center gap-1.5 text-xs">
              <span
                className="w-2 h-2 rounded-sm shrink-0"
                style={{ backgroundColor: colorMap[p.name] || OTHER_COLOR }}
              />
              <span className="text-slate-300 truncate max-w-[100px]">
                {p.name}
              </span>
              <span className="text-slate-400 ml-auto tabular-nums">
                {formatDuration(p.value)}
              </span>
              <span className="text-slate-500 w-10 text-right tabular-nums">
                {pct}%
              </span>
            </div>
          );
        })}
      </div>
      <div className="border-t border-slate-700 mt-1.5 pt-1 text-xs text-slate-400 flex justify-between">
        <span>Total</span>
        <span className="tabular-nums">{formatDuration(total)}</span>
      </div>
    </div>
  );
}

export function StackedBarChart({ hourlyData, dailyData }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>("daily");
  const { t, locale } = useT();
  const othersLabel = t("chart.others");

  const { chartData, appNames, colorMap } = useMemo(() => {
    if (viewMode === "daily") {
      return buildDailyChartData(hourlyData, othersLabel);
    }
    return buildWeeklyChartData(dailyData, othersLabel, locale);
  }, [viewMode, hourlyData, dailyData, othersLabel, locale]);

  const hasData = chartData.some((d) => {
    return appNames.some((name) => (d[name] as number) > 0);
  });

  if (!hasData) {
    return (
      <div className="text-center text-slate-500 py-12">
        {t("breakdown.noData")}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* View title + switcher */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-300">
          {t("breakdown.title")}
        </h3>
        <div className="inline-flex bg-slate-800 rounded-lg p-0.5">
          {(["daily", "weekly"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                viewMode === mode
                  ? "bg-indigo-600 text-white"
                  : "text-slate-400 hover:text-slate-300"
              }`}
            >
              {t(`breakdown.${mode}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
        <ResponsiveContainer width="100%" height={400}>
          <BarChart
            data={chartData}
            margin={{ top: 4, right: 4, bottom: 4, left: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis
              dataKey={viewMode === "daily" ? "hour" : "dateLabel"}
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              interval={viewMode === "daily" ? 3 : 0}
            />
            <YAxis
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `${Math.round(v / 60)}`}
              width={35}
            />
            <Tooltip
              content={
                <CustomTooltip colorMap={colorMap} />
              }
              cursor={{ fill: "rgba(148, 163, 184, 0.08)" }}
            />
            {appNames.map((appName, i) => (
              <Bar
                key={appName}
                dataKey={appName}
                stackId="stack"
                fill={colorMap[appName]}
                radius={
                  i === appNames.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]
                }
                maxBarSize={viewMode === "daily" ? 16 : 40}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {appNames.map((name) => (
          <div key={name} className="flex items-center gap-1">
            <span
              className="w-2.5 h-2.5 rounded-sm shrink-0"
              style={{ backgroundColor: colorMap[name] }}
            />
            <span className="text-[10px] text-slate-400 truncate max-w-[80px]">
              {name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
