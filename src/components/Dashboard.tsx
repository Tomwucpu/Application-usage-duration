import { useEffect, useMemo, lazy, Suspense } from "react";
import { useStore } from "../stores/useStore";
import { useShallow } from "zustand/react/shallow";
import { useT } from "../i18n";
import type { Locale } from "../i18n";
import type { AppSummary } from "../types";
import { AppRanking } from "./dashboard/AppRanking";
import { DatePicker } from "./dashboard/DatePicker";

const StackedBarChart = lazy(async () => {
  const mod = await import("./StackedBarChart");
  return { default: mod.StackedBarChart };
});

function formatDuration(seconds: number, locale: Locale): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (locale === "zh-CN") {
    if (h > 0) return `${h} 小时 ${m} 分钟`;
    if (m > 0) return `${m} 分钟`;
    return `${seconds} 秒`;
  }
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${seconds}s`;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function fmtLocalDate(dt: Date): string {
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getWeekRange(dateStr: string): { start: string; end: string } {
  const d = new Date(dateStr + "T00:00:00");
  const dayOfWeek = d.getDay();
  const offsetToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(d);
  monday.setDate(d.getDate() + offsetToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: fmtLocalDate(monday), end: fmtLocalDate(sunday) };
}

function getMonthRange(dateStr: string): { start: string; end: string } {
  const d = new Date(dateStr + "T00:00:00");
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { start: fmtLocalDate(first), end: fmtLocalDate(last) };
}

export function Dashboard() {
  const {
    tracker,
    summary,
    selectedDate,
    loading,
    hourlyBreakdown,
    rangeBreakdown,
    rangeBreakdownRange,
    viewMode,
    customStartDate,
    customEndDate,
    setDate,
    refresh,
    loadHourlyBreakdown,
    loadRangeBreakdown,
  } = useStore(useShallow(
    (s) => ({
      tracker: s.tracker,
      summary: s.summary,
      selectedDate: s.selectedDate,
      loading: s.loading,
      hourlyBreakdown: s.hourlyBreakdown,
      rangeBreakdown: s.rangeBreakdown,
      rangeBreakdownRange: s.rangeBreakdownRange,
      viewMode: s.viewMode,
      customStartDate: s.customStartDate,
      customEndDate: s.customEndDate,
      setDate: s.setDate,
      refresh: s.refresh,
      loadHourlyBreakdown: s.loadHourlyBreakdown,
      loadRangeBreakdown: s.loadRangeBreakdown,
    }),
  ));
  const { t, locale } = useT();

  useEffect(() => {
    if (viewMode === "daily") {
      loadHourlyBreakdown(selectedDate);
      const { start, end } = getWeekRange(selectedDate);
      loadRangeBreakdown(start, end);
    } else if (viewMode === "weekly") {
      const { start, end } = getWeekRange(selectedDate);
      loadRangeBreakdown(start, end);
    } else if (viewMode === "monthly") {
      const { start, end } = getMonthRange(selectedDate);
      loadRangeBreakdown(start, end);
    } else if (viewMode === "custom" && customStartDate && customEndDate) {
      loadRangeBreakdown(customStartDate, customEndDate);
    }
  }, [viewMode, selectedDate, customStartDate, customEndDate, loadHourlyBreakdown, loadRangeBreakdown]);

  const displaySummary = useMemo(() => {
    if (viewMode === "daily") {
      return summary || null;
    }
    if (!rangeBreakdownRange) {
      return null;
    }
    if (!rangeBreakdown || rangeBreakdown.length === 0) {
      return { total_seconds: 0, apps: [], hourly: [] };
    }
    const appMap = new Map<string, number>();
    let totalSecs = 0;
    for (const item of rangeBreakdown) {
      appMap.set(item.app_name, (appMap.get(item.app_name) || 0) + item.total_seconds);
      totalSecs += item.total_seconds;
    }
    const apps: AppSummary[] = [...appMap.entries()]
      .map(([app_name, total_seconds]) => ({
        app_name,
        total_seconds,
        percentage: totalSecs > 0 ? (total_seconds / totalSecs) * 100 : 0,
      }))
      .sort((a, b) => b.total_seconds - a.total_seconds);

    return {
      total_seconds: totalSecs,
      apps,
      hourly: [],
    };
  }, [viewMode, summary, rangeBreakdown, rangeBreakdownRange]);

  return (
    <div className="space-y-6">
      {/* Status bar */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span
            className={`h-3 w-3 rounded-full ${
              tracker.is_running ? "bg-green-500" : "bg-red-500"
            }`}
          />
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {tracker.is_running ? t("status.tracking") : t("status.stopped")}
          </span>
        </div>
        {tracker.is_afk && (
          <span className="text-xs bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded">
            {t("status.afk")}
          </span>
        )}
        <div className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
          {t("status.current")}:{" "}
          {tracker.current_icon && (
            <img
              src={`data:image/png;base64,${tracker.current_icon}`}
              alt=""
              className="w-4 h-4 rounded-sm"
            />
          )}
          <span className="text-slate-800 dark:text-slate-200">
            {tracker.current_app || "—"}
          </span>
          {tracker.current_title && (
            <span className="text-slate-400 dark:text-slate-500 ml-1">— {tracker.current_title}</span>
          )}
        </div>

        <div className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5 ml-auto">
          {t("status.today")}:{" "}
          <span className="text-slate-800 dark:text-slate-200 font-mono">
            {formatTime(tracker.today_total_seconds)}
          </span>
        </div>
      </div>

      {/* Date picker + refresh */}
      <div className="relative z-50 flex items-center justify-between gap-3 rounded-3xl border border-slate-200/70 bg-slate-100/60 p-2 shadow-white/70 backdrop-blur dark:border-[#3f3f41] dark:bg-[#27272b]">
        <DatePicker value={selectedDate} onChange={setDate} locale={locale} />
        <button
          onClick={() => refresh()}
          disabled={loading}
          className="rounded-2xl border border-slate-200/80 bg-white/95 px-4 py-2.5 text-sm font-semibold text-slate-700 shrink-0 transition-colors duration-200 disabled:opacity-50 dark:border-[#3f3f41] dark:bg-[#1d1d20] dark:text-slate-300"
        >
          {loading ? t("refresh.loading") : t("refresh")}
        </button>
      </div>

      {/* Dashboard content */}
      <>
        {displaySummary ? (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white dark:bg-[#27272b] border border-slate-200 dark:border-[#3f3f41] rounded-lg px-4 py-3 shadow-sm dark:shadow-none">
                <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">{t("summary.total")}</div>
                <div className="text-3xl font-bold text-slate-900 dark:text-white tabular-nums">
                  {formatDuration(displaySummary.total_seconds, locale)}
                </div>
              </div>
              <div className="bg-white dark:bg-[#27272b] border border-slate-200 dark:border-[#3f3f41] rounded-lg px-4 py-3 shadow-sm dark:shadow-none">
                <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">{t("summary.apps")}</div>
                <div className="text-3xl font-bold text-slate-900 dark:text-white tabular-nums">
                  {displaySummary.apps.length}
                </div>
              </div>
            </div>

            <Suspense fallback={<div className="text-center text-slate-500 py-8">{t("loading")}</div>}>
              <StackedBarChart
                hourlyData={hourlyBreakdown}
                dailyData={rangeBreakdown}
              />
            </Suspense>

            <AppRanking apps={displaySummary.apps} totalSeconds={displaySummary.total_seconds} loading={loading} />
          </>
        ) : (
          <div className="text-center text-slate-500 py-12">{t("loading")}</div>
        )}
      </>
    </div>
  );
}
