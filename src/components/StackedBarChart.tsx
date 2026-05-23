import { useMemo, useState } from "react";
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
import { useStore } from "../stores/useStore";
import { DateRangePicker } from "./breakdown/DateRangePicker";
import { CHART_COLORS, CHART_OTHER_COLOR } from "../themes/colors";

const TOP_N = 10;

function fmtLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

interface Props {
  hourlyData: HourlyAppBreakdown[];
  dailyData: DailyAppBreakdown[];
}

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
  const topAppSet = new Set(topApps);
  const hasOthers = sortedApps.length > TOP_N;

  const colorMap: Record<string, string> = {};
  topApps.forEach((name, i) => {
    colorMap[name] = CHART_COLORS[i % CHART_COLORS.length];
  });
  if (hasOthers) colorMap[othersLabel] = CHART_OTHER_COLOR;

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
        if (!topAppSet.has(app)) othersSum += secs;
      }
      entry[othersLabel] = othersSum;
    }
    chartData.push(entry);
  }

  return { chartData, appNames: hasOthers ? [...topApps, othersLabel] : topApps, colorMap };
}

function buildRangeChartData(
  dailyData: DailyAppBreakdown[],
  othersLabel: string,
  dates: { date: string; label: string }[],
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
  const topAppSet = new Set(topApps);
  const hasOthers = sortedApps.length > TOP_N;

  const colorMap: Record<string, string> = {};
  topApps.forEach((name, i) => {
    colorMap[name] = CHART_COLORS[i % CHART_COLORS.length];
  });
  if (hasOthers) colorMap[othersLabel] = CHART_OTHER_COLOR;

  const chartData = dates.map(({ date, label }) => {
    const entry: Record<string, string | number> = { dateLabel: label };
    const dayMap = dayApps.get(date) || new Map();
    for (const app of topApps) {
      entry[app] = dayMap.get(app) || 0;
    }
    if (hasOthers) {
      let othersSum = 0;
      for (const [app, secs] of dayMap) {
        if (!topAppSet.has(app)) othersSum += secs;
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
  hoveredApp,
}: {
  active?: boolean;
  payload?: { name: string; value: number }[];
  label?: string;
  colorMap: Record<string, string>;
  hoveredApp: string | null;
}) {
  if (!active || !payload || !label) return null;

  const sorted = payload
    .filter((p) => p.value > 0)
    .sort((a, b) => b.value - a.value);

  if (sorted.length === 0) return null;

  const total = sorted.reduce((sum, p) => sum + p.value, 0);

  return (
    // tooltip 的内容容器，显示在鼠标悬停时
    <div className="bg-white dark:bg-[#1d1d20] border border-slate-200 dark:border-[#3f3f41] rounded-lg px-3 py-2 shadow-xl">
      <div className="text-slate-800 dark:text-slate-200 font-medium text-sm mb-1">{label}</div>
      <div className="space-y-0.5">
        {sorted.map((p) => {
          const pct = total > 0 ? ((p.value / total) * 100).toFixed(1) : "0";
          const isHovered = hoveredApp === p.name;
          return (
            <div
              key={p.name}
              className={`flex items-center gap-1.5 text-xs transition-opacity duration-150 ${
                hoveredApp && !isHovered ? "opacity-40" : ""
              }`}
            >
              <span
                className={`rounded-sm shrink-0 transition-all duration-150 ${
                  isHovered ? "w-2.5 h-2.5 ring-2 ring-offset-1 ring-slate-400 dark:ring-slate-500" : "w-2 h-2"
                }`}
                style={{ backgroundColor: colorMap[p.name] || CHART_OTHER_COLOR }}
              />
              <span className={`text-slate-700 dark:text-slate-300 truncate max-w-[100px] ${isHovered ? "font-semibold" : ""}`}>
                {p.name}
              </span>
              <span className={`ml-auto tabular-nums ${isHovered ? "font-semibold text-slate-700 dark:text-slate-200" : "text-slate-500 dark:text-slate-400"}`}>
                {formatDuration(p.value)}
              </span>
              <span className={`w-10 text-right tabular-nums ${isHovered ? "font-semibold text-slate-700 dark:text-slate-200" : "text-slate-500 dark:text-slate-400"}`}>
                {pct}%
              </span>
            </div>
          );
        })}
      </div>
      <div className="border-t border-slate-200 dark:border-slate-700 mt-1.5 pt-1 text-xs text-slate-500 dark:text-slate-400 flex justify-between">
        <span>Total</span>
        <span className="tabular-nums">{formatDuration(total)}</span>
      </div>
    </div>
  );
}

export function StackedBarChart({ hourlyData, dailyData }: Props) {
  const { t, locale } = useT();
  const selectedDate = useStore((s) => s.selectedDate);
  const viewMode = useStore((s) => s.viewMode);
  const setViewMode = useStore((s) => s.setViewMode);
  const customStartDate = useStore((s) => s.customStartDate);
  const customEndDate = useStore((s) => s.customEndDate);
  const setCustomRange = useStore((s) => s.setCustomRange);
  const othersLabel = t("chart.others");
  const [hoveredApp, setHoveredApp] = useState<string | null>(null);

  const dateList = useMemo(() => {
    if (viewMode === "daily") return [];
    const dates: { date: string; label: string }[] = [];
    let start: Date;
    let end: Date;
    if (viewMode === "weekly") {
      const ref = new Date(selectedDate + "T00:00:00");
      const refDay = ref.getDay();
      const offsetToMonday = refDay === 0 ? -6 : 1 - refDay;
      start = new Date(ref);
      start.setDate(ref.getDate() + offsetToMonday);
      end = new Date(start);
      end.setDate(start.getDate() + 6);
    } else if (viewMode === "monthly") {
      const ref = new Date(selectedDate + "T00:00:00");
      start = new Date(ref.getFullYear(), ref.getMonth(), 1);
      end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
    } else {
      // custom - use the dates from dailyData directly
      return [];
    }
    const showWeekday = viewMode === "weekly";
    const d = new Date(start);
    while (d <= end) {
      const iso = fmtLocalDate(d);
      const label = d.toLocaleDateString(locale === "zh-CN" ? "zh-CN" : "en-US", {
        weekday: showWeekday ? "short" : undefined,
        month: "numeric",
        day: "numeric",
      });
      dates.push({ date: iso, label });
      d.setDate(d.getDate() + 1);
    }
    return dates;
  }, [viewMode, selectedDate, locale]);

  const customDates = useMemo(() => {
    if (viewMode !== "custom" || !customStartDate || !customEndDate) return [];
    const dates: { date: string; label: string }[] = [];
    const start = new Date(customStartDate + "T00:00:00");
    const end = new Date(customEndDate + "T00:00:00");
    const d = new Date(start);
    while (d <= end) {
      const iso = fmtLocalDate(d);
      const label = d.toLocaleDateString(locale === "zh-CN" ? "zh-CN" : "en-US", {
        month: "short",
        day: "numeric",
      });
      dates.push({ date: iso, label });
      d.setDate(d.getDate() + 1);
    }
    return dates;
  }, [viewMode, customStartDate, customEndDate, locale]);

  const rangeTitle = useMemo(() => {
    if (viewMode !== "custom" || !customStartDate || !customEndDate) return "";
    const fmt = (d: Date) =>
      d.toLocaleDateString(locale === "zh-CN" ? "zh-CN" : "en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    const start = new Date(customStartDate + "T00:00:00");
    const end = new Date(customEndDate + "T00:00:00");
    const dash = "\u2009\u2013\u2009";
    return `${fmt(start)}${dash}${fmt(end)}`;
  }, [viewMode, customStartDate, customEndDate, locale]);

  const { chartData, appNames, colorMap } = useMemo(() => {
    if (viewMode === "daily") {
      return buildDailyChartData(hourlyData, othersLabel);
    }
    const dates = viewMode === "custom" ? customDates : dateList;
    if (dates.length === 0) {
      return { chartData: [], appNames: [], colorMap: {} };
    }
    return buildRangeChartData(dailyData, othersLabel, dates);
  }, [viewMode, hourlyData, dailyData, othersLabel, locale, dateList, customDates]);

  const dayCount = viewMode === "daily" ? 24 : (viewMode === "custom" ? customDates.length : dateList.length);
  const xInterval = (() => {
    if (viewMode === "daily") return 3;
    if (viewMode === "weekly") return 0;
    if (dayCount <= 7) return 0;
    if (dayCount <= 14) return 1;
    if (dayCount <= 31) return Math.max(1, Math.floor(dayCount / 8));
    return Math.max(2, Math.floor(dayCount / 10));
  })();

  const hasEntries = chartData.length > 0;

  if (!hasEntries) {
    return (
      <div className="bg-white dark:bg-[#27272b] border border-slate-200 dark:border-[#3f3f41] rounded-lg p-5 flex flex-col space-y-5 shadow-sm dark:shadow-none">
        {/* View title + switcher */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {t("breakdown.title")}
            </h2>
            {rangeTitle && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{rangeTitle}</p>
            )}
          </div>
          <div className="inline-flex bg-slate-100 dark:bg-slate-950/50 rounded-lg p-1 border border-slate-200 dark:border-slate-800/60">
            {(["daily", "weekly", "monthly", "custom"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                  viewMode === mode
                    ? "bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800/50"
                }`}
              >
                {t(`breakdown.${mode}`)}
              </button>
            ))}
          </div>
        </div>

        {viewMode === "custom" && (
          <DateRangePicker
            startDate={customStartDate}
            endDate={customEndDate}
            onChange={setCustomRange}
            locale={locale}
          />
        )}

        <div className="text-center text-slate-500 dark:text-slate-400 py-12">
          {t("breakdown.noData")}
        </div>
      </div>
    );
  }

  return (
    // 应用使用分布组件
    <div className="bg-white dark:bg-[#27272b] border border-slate-200 dark:border-[#3f3f41] rounded-lg p-5 flex flex-col space-y-5 shadow-sm dark:shadow-none">
      {/* View title + switcher */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {t("breakdown.title")}
          </h2>
          {rangeTitle && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{rangeTitle}</p>
          )}
        </div>
        {/* 视图切换 */}
        <div className="inline-flex bg-slate-100 dark:bg-[#1d1d20] rounded-lg p-1 border border-slate-200 dark:border-[#3f3f41]">
          {(["daily", "weekly", "monthly", "custom"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                viewMode === mode
                  ? "bg-[#0060df] dark:bg-[#0060df] text-[#ffffff] dark:text-[#ffffff] shadow-sm"
                  : "text-[#a9a9af] dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#27272b]"
              }`}
            >
              {t(`breakdown.${mode}`)}
            </button>
          ))}
        </div>
      </div>

      {viewMode === "custom" && (
        <DateRangePicker
          startDate={customStartDate}
          endDate={customEndDate}
          onChange={setCustomRange}
          locale={locale}
        />
      )}

      {/* Chart */}
      <div className="w-full h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            key={`${viewMode}-${selectedDate}-${customStartDate}-${customEndDate}`}
            data={chartData}
            margin={{ top: 10, right: 4, bottom: 4, left: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-chart-grid)" />
            <XAxis
              dataKey={viewMode === "daily" ? "hour" : "dateLabel"}
              tick={{ fill: "var(--color-chart-tick)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              interval={xInterval}
            />
            <YAxis
              tick={{ fill: "var(--color-chart-tick)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `${Math.round(v / 60)}`}
              width={35}
            />
            <Tooltip
              content={
                <CustomTooltip colorMap={colorMap} hoveredApp={hoveredApp} />
              }
              cursor={{ fill: "var(--color-chart-cursor)" }}
            />
            {appNames.map((appName) => (
              <Bar
                key={appName}
                dataKey={appName}
                stackId="stack"
                fill={colorMap[appName]}
                radius={[0, 0, 0, 0]}
                isAnimationActive={true}
                animationDuration={500}
                animationEasing="ease-out"
                onMouseEnter={() => setHoveredApp(appName)}
                onMouseLeave={() => setHoveredApp(null)}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 图例和注释 */}
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 px-1 pt-2">
        {appNames.map((name) => (
          <div key={name} className="flex items-center gap-1.5">
            <span
              className="w-3 h-3 rounded-sm shrink-0"
              style={{ backgroundColor: colorMap[name] }}
            />
            <span className="text-xs text-slate-600 dark:text-slate-300 truncate max-w-[120px]">
              {name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
