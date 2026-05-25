import { useEffect, useMemo, lazy, Suspense } from "react";
import { useStore } from "../stores/useStore";
import { useShallow } from "zustand/react/shallow";
import { useT } from "../i18n";
import type { Locale } from "../i18n";
import type { AppSummary, CategorySummaryItem, UsageRankingItem } from "../types";
import { AppRanking } from "./dashboard/AppRanking";
import { getDisplayName } from "./AppNames";
import { BUILTIN_CATEGORY_ICONS } from "./CategoryIcons";
import { getBreakdownRange } from "../utils/dates";

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

export function Dashboard() {
  const {
    tracker,
    summary,
    categorySummary,
    selectedDate,
    loading,
    groupBy,
    appIcons,
    categoryFileIcons,
    hourlyBreakdown,
    rangeBreakdown,
    rangeBreakdownRange,
    hourlyCategoryBreakdown,
    rangeCategoryBreakdown,
    viewMode,
    customStartDate,
    customEndDate,
    loadHourlyBreakdown,
    loadRangeBreakdown,
    loadCategorySummary,
    loadHourlyCategoryBreakdown,
    loadRangeCategoryBreakdown,
    setGroupBy,
  } = useStore(useShallow(
    (s) => ({
      tracker: s.tracker,
      summary: s.summary,
      categorySummary: s.categorySummary,
      selectedDate: s.selectedDate,
      loading: s.loading,
      groupBy: s.groupBy,
      appIcons: s.appIcons,
      categoryFileIcons: s.categoryFileIcons,
      hourlyBreakdown: s.hourlyBreakdown,
      rangeBreakdown: s.rangeBreakdown,
      rangeBreakdownRange: s.rangeBreakdownRange,
      hourlyCategoryBreakdown: s.hourlyCategoryBreakdown,
      rangeCategoryBreakdown: s.rangeCategoryBreakdown,
      viewMode: s.viewMode,
      customStartDate: s.customStartDate,
      customEndDate: s.customEndDate,
      loadHourlyBreakdown: s.loadHourlyBreakdown,
      loadRangeBreakdown: s.loadRangeBreakdown,
      loadCategorySummary: s.loadCategorySummary,
      loadHourlyCategoryBreakdown: s.loadHourlyCategoryBreakdown,
      loadRangeCategoryBreakdown: s.loadRangeCategoryBreakdown,
      setGroupBy: s.setGroupBy,
    }),
  ));
  const { t, locale } = useT();

  useEffect(() => {
    if (viewMode === "daily") {
      loadHourlyBreakdown(selectedDate);
      loadHourlyCategoryBreakdown(selectedDate);
    }

    loadCategorySummary(selectedDate);

    const range = getBreakdownRange(viewMode, selectedDate, customStartDate, customEndDate);
    if (range) {
      loadRangeBreakdown(range.start, range.end);
      loadRangeCategoryBreakdown(range.start, range.end);
    }
  }, [
    viewMode,
    selectedDate,
    customStartDate,
    customEndDate,
    loadHourlyBreakdown,
    loadRangeBreakdown,
    loadCategorySummary,
    loadHourlyCategoryBreakdown,
    loadRangeCategoryBreakdown,
  ]);

  const appDisplaySummary = useMemo(() => {
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

  const categoryDisplaySummary = useMemo(() => {
    if (viewMode === "daily") {
      const total = categorySummary.reduce((sum, item) => sum + item.total_seconds, 0);
      return {
        total_seconds: total,
        items: categorySummary,
      };
    }
    if (!rangeCategoryBreakdown || rangeCategoryBreakdown.length === 0) {
      return { total_seconds: 0, items: [] as CategorySummaryItem[] };
    }

    const categoryMap = new Map<number, CategorySummaryItem>();
    let totalSecs = 0;
    for (const item of rangeCategoryBreakdown) {
      totalSecs += item.total_seconds;
      const existing = categoryMap.get(item.category_id);
      if (existing) {
        existing.total_seconds += item.total_seconds;
      } else {
        categoryMap.set(item.category_id, {
          category_id: item.category_id,
          category_name: item.category_name,
          icon_source: item.icon_source,
          builtin_icon_key: item.builtin_icon_key,
          custom_icon_path: item.custom_icon_path,
          total_seconds: item.total_seconds,
          percentage: 0,
        });
      }
    }

    const items = [...categoryMap.values()]
      .map((item) => ({
        ...item,
        percentage: totalSecs > 0 ? (item.total_seconds / totalSecs) * 100 : 0,
      }))
      .sort((a, b) => b.total_seconds - a.total_seconds);

    return {
      total_seconds: totalSecs,
      items,
    };
  }, [viewMode, categorySummary, rangeCategoryBreakdown]);

  const rankingItems = useMemo<UsageRankingItem[]>(() => {
    if (groupBy === "app") {
      return (appDisplaySummary?.apps || []).map((app) => ({
        key: app.app_name,
        label: getDisplayName(app.app_name),
        icon: appIcons[app.app_name] || null,
        total_seconds: app.total_seconds,
        percentage: app.percentage,
      }));
    }

    return categoryDisplaySummary.items.map((category) => {
      let icon: string | null = null;
      if (category.icon_source === "file") {
        icon = categoryFileIcons[category.category_id] || null;
      } else if (category.icon_source === "builtin" && category.builtin_icon_key) {
        const iconDef = BUILTIN_CATEGORY_ICONS.find((i) => i.key === category.builtin_icon_key);
        if (iconDef) icon = iconDef.svg;
      }
      return {
        key: String(category.category_id),
        label: category.category_name,
        icon,
        total_seconds: category.total_seconds,
        percentage: category.percentage,
      };
    });
  }, [groupBy, appDisplaySummary, appIcons, categoryDisplaySummary, categoryFileIcons]);

  const totalSeconds = groupBy === "app"
    ? (appDisplaySummary?.total_seconds || 0)
    : categoryDisplaySummary.total_seconds;
  const count = groupBy === "app"
    ? (appDisplaySummary?.apps.length || 0)
    : categoryDisplaySummary.items.length;

  return (
    <div className="space-y-6">
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

      <div className="flex items-center gap-2">
        <button
          onClick={() => setGroupBy("app")}
          className={`px-3 py-1.5 text-sm rounded-lg border ${groupBy === "app" ? "bg-[#1369ea] text-white border-[#1369ea]" : "border-slate-200 dark:border-[#3f3f41] hover:bg-slate-100 dark:hover:bg-[#27272b]"}`}
        >
          {t("groupBy.app")}
        </button>
        <button
          onClick={() => setGroupBy("category")}
          className={`px-3 py-1.5 text-sm rounded-lg border ${groupBy === "category" ? "bg-[#1369ea] text-white border-[#1369ea]" : "border-slate-200 dark:border-[#3f3f41] hover:bg-slate-100 dark:hover:bg-[#27272b]"}`}
        >
          {t("groupBy.category")}
        </button>
      </div>

      {(groupBy === "app" ? appDisplaySummary : categoryDisplaySummary) ? (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white dark:bg-[#27272b] border border-slate-200 dark:border-[#3f3f41] rounded-lg px-4 py-3 shadow-sm dark:shadow-none">
              <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">{t("summary.total")}</div>
              <div className="text-3xl font-bold text-slate-900 dark:text-white tabular-nums">
                {formatDuration(totalSeconds, locale)}
              </div>
            </div>
            <div className="bg-white dark:bg-[#27272b] border border-slate-200 dark:border-[#3f3f41] rounded-lg px-4 py-3 shadow-sm dark:shadow-none">
              <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                {groupBy === "app" ? t("summary.apps") : t("summary.categories")}
              </div>
              <div className="text-3xl font-bold text-slate-900 dark:text-white tabular-nums">
                {count}
              </div>
            </div>
          </div>

          <Suspense fallback={<div className="text-center text-slate-500 py-8">{t("loading")}</div>}>
            <StackedBarChart
              groupBy={groupBy}
              hourlyData={hourlyBreakdown}
              dailyData={rangeBreakdown}
              hourlyCategoryData={hourlyCategoryBreakdown}
              dailyCategoryData={rangeCategoryBreakdown}
            />
          </Suspense>

          <AppRanking
            items={rankingItems}
            totalSeconds={totalSeconds}
            loading={loading}
            title={groupBy === "app" ? t("chart.ranking") : t("chart.categoryRanking")}
          />
        </>
      ) : (
        <div className="text-center text-slate-500 py-12">{t("loading")}</div>
      )}
    </div>
  );
}
