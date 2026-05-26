import { useMemo, useState } from "react";
import { getDisplayName } from "./AppNames";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type {
  DailyAppBreakdown,
  DailyCategoryBreakdown,
  GroupBy,
  HourlyAppBreakdown,
  HourlyCategoryBreakdown,
} from "../types";
import { useT } from "../i18n";
import { useStore } from "../stores/useStore";
import { CHART_OTHER_COLOR } from "../themes/colors";
import { getBreakdownRange, getDateList } from "../utils/dates";
import { buildSeriesColorMap, getSeriesOrder } from "../utils/chartColors";
import { DateNavigator } from "./dashboard/DateNavigator";

const TOP_N = 10;

interface Props {
  groupBy: GroupBy;
  hourlyData: HourlyAppBreakdown[];
  dailyData: DailyAppBreakdown[];
  hourlyCategoryData: HourlyCategoryBreakdown[];
  dailyCategoryData: DailyCategoryBreakdown[];
}

type ChartDatum = Record<string, string | number>;

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${seconds}s`;
}

export function calculateBucketTotalSeconds(
  datum: ChartDatum,
  axisKey: "hour" | "dateLabel",
): number {
  return Object.entries(datum).reduce((sum, [key, value]) => {
    if (key === axisKey || typeof value !== "number") {
      return sum;
    }
    return sum + value;
  }, 0);
}

export function calculateAverageBucketSeconds(
  rows: ChartDatum[],
  axisKey: "hour" | "dateLabel",
): number {
  if (rows.length === 0) {
    return 0;
  }

  const total = rows.reduce(
    (sum, row) => sum + calculateBucketTotalSeconds(row, axisKey),
    0,
  );
  return total / rows.length;
}

export function buildAverageLineLabel(label: string, seconds: number): string {
  return `${label} ${formatDuration(seconds)}`;
}

interface ChartData {
  chartData: ChartDatum[];
  appNames: string[];
  colorMap: Record<string, string>;
}

function buildChartData(
  rows: Array<{ bucket: string | number; label: string; total_seconds: number }>,
  bucketOrder: Array<{ value: string | number; label: string }>,
  bucketKey: "hour" | "dateLabel",
  othersLabel: string,
): ChartData {
  const buckets = new Map<string | number, Map<string, number>>();
  const totals = new Map<string, number>();

  for (const item of rows) {
    if (!buckets.has(item.bucket)) buckets.set(item.bucket, new Map());
    const current = buckets.get(item.bucket)!.get(item.label) || 0;
    buckets.get(item.bucket)!.set(item.label, current + item.total_seconds);
    totals.set(item.label, (totals.get(item.label) || 0) + item.total_seconds);
  }

  const orderedItems = getSeriesOrder(totals);
  const topItems = orderedItems.slice(0, TOP_N);
  const topItemSet = new Set(topItems);
  const hasOthers = orderedItems.length > TOP_N;
  const colorMap = buildSeriesColorMap(topItems, hasOthers ? othersLabel : null);

  const chartData = bucketOrder.map(({ value, label }) => {
    const entry: Record<string, string | number> = { [bucketKey]: label };
    const bucketMap = buckets.get(value) || new Map();
    for (const item of topItems) {
      entry[item] = bucketMap.get(item) || 0;
    }
    if (hasOthers) {
      let othersSum = 0;
      for (const [item, secs] of bucketMap) {
        if (!topItemSet.has(item)) othersSum += secs;
      }
      entry[othersLabel] = othersSum;
    }
    return entry;
  });

  return { chartData, appNames: hasOthers ? [...topItems, othersLabel] : topItems, colorMap };
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

function BreakdownHeader({
  title,
  rangeTitle,
  selectedDate,
  viewMode,
  customStartDate,
  customEndDate,
  onDateChange,
  onViewModeChange,
  onCustomRangeChange,
}: {
  title: string;
  rangeTitle: string;
  selectedDate: string;
  viewMode: "daily" | "weekly" | "monthly" | "custom";
  customStartDate: string | null;
  customEndDate: string | null;
  onDateChange: (date: string) => void | Promise<void>;
  onViewModeChange: (mode: "daily" | "weekly" | "monthly" | "custom") => void;
  onCustomRangeChange: (start: string, end: string) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          {title}
        </h2>
        {rangeTitle && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{rangeTitle}</p>
        )}
      </div>
      <DateNavigator
        selectedDate={selectedDate}
        viewMode={viewMode}
        customStartDate={customStartDate}
        customEndDate={customEndDate}
        onDateChange={onDateChange}
        onViewModeChange={onViewModeChange}
        onCustomRangeChange={onCustomRangeChange}
      />
    </div>
  );
}

export function StackedBarChart({ groupBy, hourlyData, dailyData, hourlyCategoryData, dailyCategoryData }: Props) {
  const { t, locale } = useT();
  const selectedDate = useStore((s) => s.selectedDate);
  const viewMode = useStore((s) => s.viewMode);
  const customStartDate = useStore((s) => s.customStartDate);
  const customEndDate = useStore((s) => s.customEndDate);
  const setDate = useStore((s) => s.setDate);
  const setViewMode = useStore((s) => s.setViewMode);
  const setCustomRange = useStore((s) => s.setCustomRange);
  const othersLabel = t("chart.others");
  const [hoveredApp, setHoveredApp] = useState<string | null>(null);

  const dateList = useMemo(() => {
    if (viewMode === "daily" || viewMode === "custom") return [];
    const range = getBreakdownRange(viewMode, selectedDate, customStartDate, customEndDate);
    if (!range) return [];
    return getDateList(range.start, range.end, locale, {
      weekday: viewMode === "weekly" ? "short" : undefined,
      month: "numeric",
      day: "numeric",
    });
  }, [viewMode, selectedDate, customStartDate, customEndDate, locale]);

  const customDates = useMemo(() => {
    if (viewMode !== "custom" || !customStartDate || !customEndDate) return [];
    return getDateList(customStartDate, customEndDate, locale, {
      month: "short",
      day: "numeric",
    });
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
    const dash = " – ";
    return `${fmt(start)}${dash}${fmt(end)}`;
  }, [viewMode, customStartDate, customEndDate, locale]);

  const { chartData, appNames, colorMap } = useMemo(() => {
    if (viewMode === "daily") {
      const rows = groupBy === "app"
        ? hourlyData.map((item) => ({
          bucket: item.hour,
          label: getDisplayName(item.app_name),
          total_seconds: item.total_seconds,
        }))
        : hourlyCategoryData.map((item) => ({
          bucket: item.hour,
          label: item.category_name,
          total_seconds: item.total_seconds,
        }));

      const bucketOrder = Array.from({ length: 24 }, (_, h) => ({
        value: h,
        label: `${String(h).padStart(2, "0")}:00`,
      }));

      return buildChartData(rows, bucketOrder, "hour", othersLabel);
    }

    const dates = viewMode === "custom" ? customDates : dateList;
    if (dates.length === 0) {
      return { chartData: [], appNames: [], colorMap: {} };
    }

    const rows = groupBy === "app"
      ? dailyData.map((item) => ({
        bucket: item.date,
        label: getDisplayName(item.app_name),
        total_seconds: item.total_seconds,
      }))
      : dailyCategoryData.map((item) => ({
        bucket: item.date,
        label: item.category_name,
        total_seconds: item.total_seconds,
      }));

    const bucketOrder = dates.map(({ date, label }) => ({ value: date, label }));
    return buildChartData(rows, bucketOrder, "dateLabel", othersLabel);
  }, [viewMode, groupBy, hourlyData, dailyData, hourlyCategoryData, dailyCategoryData, othersLabel, dateList, customDates]);

  const axisKey = viewMode === "daily" ? "hour" : "dateLabel";
  const averageSeconds = useMemo(
    () => calculateAverageBucketSeconds(chartData, axisKey),
    [chartData, axisKey],
  );
  const averageLabel = useMemo(
    () => buildAverageLineLabel(t("chart.average"), averageSeconds),
    [t, averageSeconds],
  );

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
        <BreakdownHeader
          title={groupBy === "app" ? t("breakdown.title") : t("breakdown.categoryTitle")}
          rangeTitle={rangeTitle}
          selectedDate={selectedDate}
          viewMode={viewMode}
          customStartDate={customStartDate}
          customEndDate={customEndDate}
          onDateChange={setDate}
          onViewModeChange={setViewMode}
          onCustomRangeChange={setCustomRange}
        />

        <div className="text-center text-slate-500 dark:text-slate-400 py-12">
          {t("breakdown.noData")}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#27272b] border border-slate-200 dark:border-[#3f3f41] rounded-lg p-5 flex flex-col space-y-5 shadow-sm dark:shadow-none">
      <BreakdownHeader
        title={groupBy === "app" ? t("breakdown.title") : t("breakdown.categoryTitle")}
        rangeTitle={rangeTitle}
        selectedDate={selectedDate}
        viewMode={viewMode}
        customStartDate={customStartDate}
        customEndDate={customEndDate}
        onDateChange={setDate}
        onViewModeChange={setViewMode}
        onCustomRangeChange={setCustomRange}
      />

      <div className="w-full h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            key={`${groupBy}-${viewMode}-${selectedDate}-${customStartDate}-${customEndDate}`}
            data={chartData}
            margin={{ top: 10, right: 4, bottom: 4, left: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-chart-grid)" />
            <XAxis
              dataKey={axisKey}
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
            <ReferenceLine
              y={averageSeconds}
              stroke="var(--color-chart-tick)"
              strokeDasharray="6 4"
              ifOverflow="extendDomain"
              label={{
                value: averageLabel,
                position: "insideTopRight",
                fill: "var(--color-chart-tick)",
                fontSize: 11,
              }}
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
