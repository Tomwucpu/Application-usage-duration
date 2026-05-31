import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import { useStore, api } from "../stores/useStore";
import { useShallow } from "zustand/react/shallow";
import { useT } from "../i18n";
import type { Locale } from "../i18n";
import type { AppFilterOption, UsageRankingItem } from "../types";
import { AppRanking } from "./dashboard/AppRanking";
import { getDisplayName } from "./AppNames";
import { BUILTIN_CATEGORY_ICONS } from "./CategoryIcons";
import { DropdownMenu } from "./shared/DropdownMenu";
import { getBreakdownRange } from "../utils/dates";
import { buildSeriesColorMap } from "../utils/chartColors";
import {
  DASHBOARD_APP_FILTER_STORAGE_KEY,
  DASHBOARD_CATEGORY_FILTER_STORAGE_KEY,
  buildAppSummaryFromRangeRows,
  buildCategorySummaryFromRangeRows,
  filterAppSummary,
  filterBreakdownRowsByApps,
  filterBreakdownRowsByCategories,
  filterCategorySummaryItems,
  getDashboardFilterLabel,
  parseStoredNumberArray,
  parseStoredStringArray,
} from "./dashboard/filterDashboardItems";

const StackedBarChart = lazy(async () => {
  const mod = await import("./StackedBarChart");
  return { default: mod.StackedBarChart };
});

function formatDuration(seconds: number, locale: Locale): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (locale === "zh-CN") {
    if (h > 0) return `${h} 小时 ${m} 分钟 ${s} 秒`;
    if (m > 0) return `${m} 分钟 ${s} 秒`;
    return `${s} 秒`;
  }
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function SelectedCheckIcon({ selected }: { selected: boolean }) {
  if (!selected) {
    return <span className="h-5 w-5 shrink-0" aria-hidden="true" />;
  }

  return (
    <span
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1369ea]"
      aria-hidden="true"
    >
      <svg
        className="h-3.5 w-3.5"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M3.5 8.25L6.5 11.25L12.5 5.25"
          stroke="#ffffff"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function reconcileSelectedValues<T extends string | number>(
  values: T[],
  validValues: Set<T>,
): T[] {
  return values.filter((value, index) => validValues.has(value) && values.indexOf(value) === index);
}

function arraysEqual<T extends string | number>(a: T[], b: T[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
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
    displayNames,
    categoryFileIcons,
    hourlyBreakdown,
    rangeBreakdown,
    rangeBreakdownRange,
    hourlyCategoryBreakdown,
    rangeCategoryBreakdown,
    rangeCategoryBreakdownRange,
    viewMode,
    customStartDate,
    customEndDate,
    categories,
    ensureAppIconsLoaded,
    ensureCategoryFileIconsLoaded,
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
      displayNames: s.displayNames,
      categoryFileIcons: s.categoryFileIcons,
      hourlyBreakdown: s.hourlyBreakdown,
      rangeBreakdown: s.rangeBreakdown,
      rangeBreakdownRange: s.rangeBreakdownRange,
      hourlyCategoryBreakdown: s.hourlyCategoryBreakdown,
      rangeCategoryBreakdown: s.rangeCategoryBreakdown,
      rangeCategoryBreakdownRange: s.rangeCategoryBreakdownRange,
      viewMode: s.viewMode,
      customStartDate: s.customStartDate,
      customEndDate: s.customEndDate,
      categories: s.categories,
      ensureAppIconsLoaded: s.ensureAppIconsLoaded,
      ensureCategoryFileIconsLoaded: s.ensureCategoryFileIconsLoaded,
      loadHourlyBreakdown: s.loadHourlyBreakdown,
      loadRangeBreakdown: s.loadRangeBreakdown,
      loadCategorySummary: s.loadCategorySummary,
      loadHourlyCategoryBreakdown: s.loadHourlyCategoryBreakdown,
      loadRangeCategoryBreakdown: s.loadRangeCategoryBreakdown,
      setGroupBy: s.setGroupBy,
    }),
  ));
  const { t, locale } = useT();
  const [allApps, setAllApps] = useState<AppFilterOption[]>([]);
  const [historicalAppsLoaded, setHistoricalAppsLoaded] = useState(false);
  const [historicalAppsRefreshTick, setHistoricalAppsRefreshTick] = useState(0);
  const [selectedAppNames, setSelectedAppNames] = useState<string[]>(
    () => parseStoredStringArray(localStorage.getItem(DASHBOARD_APP_FILTER_STORAGE_KEY)),
  );
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>(
    () => parseStoredNumberArray(localStorage.getItem(DASHBOARD_CATEGORY_FILTER_STORAGE_KEY)),
  );
  const [filterSearch, setFilterSearch] = useState("");

  useEffect(() => {
    if (viewMode === "daily") {
      loadHourlyBreakdown(selectedDate);
      loadHourlyCategoryBreakdown(selectedDate);
    }

    loadCategorySummary(selectedDate);

    if (viewMode !== "daily") {
      const range = getBreakdownRange(viewMode, selectedDate, customStartDate, customEndDate);
      if (range) {
        loadRangeBreakdown(range.start, range.end);
        loadRangeCategoryBreakdown(range.start, range.end);
      }
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

  useEffect(() => {
    localStorage.setItem(DASHBOARD_APP_FILTER_STORAGE_KEY, JSON.stringify(selectedAppNames));
  }, [selectedAppNames]);

  useEffect(() => {
    localStorage.setItem(
      DASHBOARD_CATEGORY_FILTER_STORAGE_KEY,
      JSON.stringify(selectedCategoryIds),
    );
  }, [selectedCategoryIds]);

  useEffect(() => {
    const requestRefresh = () => {
      setHistoricalAppsRefreshTick((current) => current + 1);
    };

    const handleWindowFocus = () => {
      requestRefresh();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        requestRefresh();
      }
    };

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (loading) {
      return;
    }

    let cancelled = false;
    let retryTimerId: number | null = null;

    void api.getAppFilterOptions()
      .then((apps) => {
        if (!cancelled) {
          setAllApps(apps);
          setHistoricalAppsLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          retryTimerId = window.setTimeout(() => {
            setHistoricalAppsRefreshTick((current) => current + 1);
          }, 3000);
        }
      });

    return () => {
      cancelled = true;
      if (retryTimerId !== null) {
        window.clearTimeout(retryTimerId);
      }
    };
  }, [
    selectedDate,
    viewMode,
    customStartDate,
    customEndDate,
    loading,
    historicalAppsRefreshTick,
  ]);

  const appFilterOptions = useMemo(() => {
    const seen = new Set<string>();
    const selectedSet = new Set(selectedAppNames);
    const q = filterSearch.trim().toLowerCase();

    return allApps
      .filter((item) => {
        if (seen.has(item.app_name)) {
          return false;
        }
        seen.add(item.app_name);
        return true;
      })
      .map((item) => ({
        value: item.app_name,
        label: item.display_name || getDisplayName(item.app_name),
        icon: appIcons[item.app_name] || null,
      }))
      .sort((a, b) => {
        const aSel = selectedSet.has(a.value);
        const bSel = selectedSet.has(b.value);
        if (aSel && !bSel) return -1;
        if (!aSel && bSel) return 1;
        return a.label.localeCompare(b.label, locale);
      })
      .filter((item) => {
        if (!q) return true;
        return item.label.toLowerCase().includes(q);
      });
  }, [allApps, appIcons, locale, displayNames, selectedAppNames, filterSearch]);

  const categoryFilterOptions = useMemo(() => {
    return categories.map((category) => ({
      value: category.id,
      label: category.name,
    }));
  }, [categories]);

  const appFilterReady = historicalAppsLoaded;
  const categoryFilterReady = categoryFilterOptions.length > 0;

  const reconciledSelectedAppNames = useMemo(() => {
    if (!appFilterReady) {
      return selectedAppNames;
    }

    return reconcileSelectedValues(
      selectedAppNames,
      new Set(appFilterOptions.map((option) => option.value)),
    );
  }, [appFilterOptions, appFilterReady, selectedAppNames]);

  const reconciledSelectedCategoryIds = useMemo(() => {
    if (!categoryFilterReady) {
      return selectedCategoryIds;
    }

    return reconcileSelectedValues(
      selectedCategoryIds,
      new Set(categoryFilterOptions.map((option) => option.value)),
    );
  }, [categoryFilterOptions, categoryFilterReady, selectedCategoryIds]);

  const effectiveSelectedAppNames = appFilterReady ? reconciledSelectedAppNames : [];
  const effectiveSelectedCategoryIds = categoryFilterReady ? reconciledSelectedCategoryIds : [];

  useEffect(() => {
    if (!appFilterReady) {
      return;
    }

    setSelectedAppNames((current) => {
      if (arraysEqual(current, reconciledSelectedAppNames)) {
        return current;
      }

      return reconciledSelectedAppNames;
    });
  }, [appFilterReady, reconciledSelectedAppNames]);

  useEffect(() => {
    if (!categoryFilterReady) {
      return;
    }

    setSelectedCategoryIds((current) => {
      if (arraysEqual(current, reconciledSelectedCategoryIds)) {
        return current;
      }

      return reconciledSelectedCategoryIds;
    });
  }, [categoryFilterReady, reconciledSelectedCategoryIds]);

  const currentFilterLabel = groupBy === "app"
    ? getDashboardFilterLabel(
      effectiveSelectedAppNames,
      appFilterOptions,
      t("dashboard.filterApps"),
      t("dashboard.selectedCount"),
    )
    : getDashboardFilterLabel(
      effectiveSelectedCategoryIds,
      categoryFilterOptions,
      t("dashboard.filterCategories"),
      t("dashboard.selectedCount"),
    );

  const filteredDailySummary = useMemo(() => {
    return filterAppSummary(summary, effectiveSelectedAppNames);
  }, [summary, effectiveSelectedAppNames]);

  const filteredHourlyBreakdown = useMemo(() => {
    return filterBreakdownRowsByApps(hourlyBreakdown, effectiveSelectedAppNames);
  }, [hourlyBreakdown, effectiveSelectedAppNames]);

  const filteredRangeBreakdown = useMemo(() => {
    return filterBreakdownRowsByApps(rangeBreakdown, effectiveSelectedAppNames);
  }, [rangeBreakdown, effectiveSelectedAppNames]);

  const filteredDailyCategorySummary = useMemo(() => {
    return filterCategorySummaryItems(categorySummary, effectiveSelectedCategoryIds);
  }, [categorySummary, effectiveSelectedCategoryIds]);

  const filteredHourlyCategoryBreakdown = useMemo(() => {
    return filterBreakdownRowsByCategories(hourlyCategoryBreakdown, effectiveSelectedCategoryIds);
  }, [hourlyCategoryBreakdown, effectiveSelectedCategoryIds]);

  const filteredRangeCategoryBreakdown = useMemo(() => {
    return filterBreakdownRowsByCategories(rangeCategoryBreakdown, effectiveSelectedCategoryIds);
  }, [rangeCategoryBreakdown, effectiveSelectedCategoryIds]);

  const appDisplaySummary = useMemo(() => {
    if (viewMode === "daily") {
      return filteredDailySummary;
    }

    if (!rangeBreakdownRange) {
      return null;
    }

    return buildAppSummaryFromRangeRows(filteredRangeBreakdown);
  }, [viewMode, filteredDailySummary, rangeBreakdownRange, filteredRangeBreakdown]);

  const categoryDisplaySummary = useMemo(() => {
    if (viewMode === "daily") {
      return filteredDailyCategorySummary;
    }

    if (!rangeCategoryBreakdownRange) {
      return null;
    }

    return buildCategorySummaryFromRangeRows(filteredRangeCategoryBreakdown);
  }, [
    viewMode,
    filteredDailyCategorySummary,
    filteredRangeCategoryBreakdown,
    rangeCategoryBreakdownRange,
  ]);

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

    return (categoryDisplaySummary?.items || []).map((category) => {
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
  }, [
    groupBy,
    appDisplaySummary,
    appIcons,
    displayNames,
    categoryDisplaySummary,
    categoryFileIcons,
  ]);

  useEffect(() => {
    const iconNames = new Set<string>();

    for (const item of rankingItems) {
      if (groupBy === "app") {
        const matching = allApps.find((app) => app.app_name === item.key);
        if (matching) {
          iconNames.add(matching.app_name);
        }
      }
    }

    for (const appName of effectiveSelectedAppNames) {
      iconNames.add(appName);
    }

    for (const option of appFilterOptions.slice(0, 40)) {
      iconNames.add(option.value);
    }

    const missingNames = [...iconNames].filter((n) => !appIcons[n]);
    if (missingNames.length > 0) {
      void ensureAppIconsLoaded(missingNames);
    }
  }, [
    allApps,
    appFilterOptions,
    appIcons,
    effectiveSelectedAppNames,
    ensureAppIconsLoaded,
    groupBy,
    rankingItems,
  ]);

  useEffect(() => {
    if (groupBy !== "category") {
      return;
    }

    const ids = new Set<number>();
    for (const item of categoryDisplaySummary?.items || []) {
      if (item.icon_source === "file") {
        ids.add(item.category_id);
      }
    }
    for (const id of effectiveSelectedCategoryIds) {
      ids.add(id);
    }

    const missingIds = [...ids].filter((id) => !categoryFileIcons[id]);
    if (missingIds.length > 0) {
      void ensureCategoryFileIconsLoaded(missingIds);
    }
  }, [
    categoryDisplaySummary,
    categoryFileIcons,
    effectiveSelectedCategoryIds,
    ensureCategoryFileIconsLoaded,
    groupBy,
  ]);

  const rankingColorMap = useMemo(() => {
    return buildSeriesColorMap(rankingItems.map((item) => item.label), null);
  }, [rankingItems]);

  const totalSeconds = groupBy === "app"
    ? (appDisplaySummary?.total_seconds || 0)
    : (categoryDisplaySummary?.total_seconds || 0);
  const count = groupBy === "app"
    ? (appDisplaySummary?.apps.length || 0)
    : (categoryDisplaySummary?.items.length || 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 flex-wrap">
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

        <DropdownMenu
          label={currentFilterLabel}
          minWidthClassName="min-w-[160px]"
          buttonClassName="bg-white dark:bg-[#1d1d20] px-3 py-1.5"
          menuClassName="w-[280px]"
          scrollable
          maxHeight={320}
        >
          {() => (
            <div className="p-1">
              {groupBy === "app" && (
                <div className="px-1 pt-1 pb-1.5">
                  <div className="relative">
                    <svg
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-slate-500"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <input
                      type="text"
                      value={filterSearch}
                      onChange={(e) => setFilterSearch(e.target.value)}
                      placeholder={t("dashboard.searchApps")}
                      autoFocus
                      className="w-full pl-8 pr-7 py-1.5 text-xs border border-slate-200 dark:border-[#3f3f41] rounded-md bg-white dark:bg-[#1d1d20] text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1369ea]"
                    />
                    {filterSearch && (
                      <button
                        onClick={() => setFilterSearch("")}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      >
                        <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  if (groupBy === "app") {
                    setSelectedAppNames([]);
                    setFilterSearch("");
                    return;
                  }
                  setSelectedCategoryIds([]);
                }}
                className="mb-1 flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-[#27272b]"
              >
                <span>{t("dashboard.clearFilter")}</span>
              </button>

              {groupBy === "app"
                ? appFilterOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      setSelectedAppNames(
                        effectiveSelectedAppNames.includes(option.value)
                          ? effectiveSelectedAppNames.filter((value) => value !== option.value)
                          : [...effectiveSelectedAppNames, option.value],
                      )
                    }
                    className="flex w-full items-center justify-between gap-3 rounded px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-[#27272b]"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      {option.icon ? (
                        <img
                          src={`data:image/png;base64,${option.icon}`}
                          alt=""
                          className="h-4 w-4 rounded-sm shrink-0"
                        />
                      ) : (
                        <span className="h-4 w-4 rounded-sm bg-slate-300 dark:bg-slate-600 shrink-0" />
                      )}
                      <span className="truncate">{option.label}</span>
                    </span>
                    <SelectedCheckIcon selected={effectiveSelectedAppNames.includes(option.value)} />
                  </button>
                ))
                : categoryFilterOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      setSelectedCategoryIds(
                        effectiveSelectedCategoryIds.includes(option.value)
                          ? effectiveSelectedCategoryIds.filter((value) => value !== option.value)
                          : [...effectiveSelectedCategoryIds, option.value],
                      )
                    }
                    className="flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-[#27272b]"
                  >
                    <span>{option.label}</span>
                    <SelectedCheckIcon selected={effectiveSelectedCategoryIds.includes(option.value)} />
                  </button>
                ))}
            </div>
          )}
        </DropdownMenu>

        <div className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5 ml-auto">
          {t("status.today")}:{" "}
          <span className="text-slate-800 dark:text-slate-200 font-mono">
            {formatTime(tracker.today_total_seconds)}
          </span>
        </div>
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
              hourlyData={filteredHourlyBreakdown}
              dailyData={filteredRangeBreakdown}
              hourlyCategoryData={filteredHourlyCategoryBreakdown}
              dailyCategoryData={filteredRangeCategoryBreakdown}
            />
          </Suspense>

          <AppRanking
            items={rankingItems}
            totalSeconds={totalSeconds}
            loading={loading}
            title={groupBy === "app" ? t("chart.ranking") : t("chart.categoryRanking")}
            colorMap={rankingColorMap}
          />
        </>
      ) : (
        <div className="text-center text-slate-500 py-12">{t("loading")}</div>
      )}
    </div>
  );
}
