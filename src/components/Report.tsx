import { useState, useEffect, useMemo, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useStore } from "../stores/useStore";
import { useT } from "../i18n";
import type { DailyAppBreakdown, DailyCategoryBreakdown } from "../types";
import { getTodayString, addDays } from "../utils/dates";
import {
  type ReportPeriod,
  type ReportOverview,
  type AppRankingItem,
  type CategoryRankingItem,
  getReportPeriodRange,
  getPeriodLabel,
  buildAppRanking,
  buildCategoryRanking,
  buildOverview,
} from "../utils/reportCalculations";
import { ReportPeriodSwitcher } from "./report/ReportPeriodSwitcher";
import { ReportOverviewCards } from "./report/ReportOverviewCards";
import { ReportRanking } from "./report/ReportRanking";
import { UsageHeatmap } from "./report/UsageHeatmap";
import { BUILTIN_CATEGORY_ICONS } from "./CategoryIcons";

export function Report() {
  const { locale } = useT();
  const appIcons = useStore((s) => s.appIcons);
  const ensureAppIconsLoaded = useStore((s) => s.ensureAppIconsLoaded);
  const categories = useStore((s) => s.categories);
  const categoryFileIcons = useStore((s) => s.categoryFileIcons);
  const ensureCategoryFileIconsLoaded = useStore((s) => s.ensureCategoryFileIconsLoaded);

  const [period, setPeriod] = useState<ReportPeriod>("day");
  const [anchorDate, setAnchorDate] = useState<string>(getTodayString());
  const [appBreakdown, setAppBreakdown] = useState<DailyAppBreakdown[]>([]);
  const [prevAppBreakdown, setPrevAppBreakdown] = useState<DailyAppBreakdown[]>([]);
  const [catBreakdown, setCatBreakdown] = useState<DailyCategoryBreakdown[]>([]);
  const [prevCatBreakdown, setPrevCatBreakdown] = useState<DailyCategoryBreakdown[]>([]);
  const [yearlyBreakdown, setYearlyBreakdown] = useState<DailyAppBreakdown[]>([]);
  const [heatmapYear, setHeatmapYear] = useState<number>(() => new Date().getFullYear());
  const [minYear, setMinYear] = useState<number>(() => new Date().getFullYear());
  const [maxYear] = useState<number>(() => new Date().getFullYear());
  const [minYearLoaded, setMinYearLoaded] = useState(false);
  const [loading, setLoading] = useState(true);

  const range = useMemo(() => getReportPeriodRange(anchorDate, period), [anchorDate, period]);
  const periodLabel = useMemo(() => getPeriodLabel(anchorDate, period, locale), [anchorDate, period, locale]);

  useEffect(() => {
    let cancelled = false;
    async function detectMinYear() {
      const currentYear = new Date().getFullYear();
      let foundYear = currentYear;
      let emptyCount = 0;

      for (let y = currentYear - 1; y >= 2000; y--) {
        try {
          const data = await invoke<DailyAppBreakdown[]>("get_daily_app_breakdown", {
            startDate: `${y}-01-01`,
            endDate: `${y}-12-31`,
          });
          if (data.length > 0) {
            foundYear = y;
            emptyCount = 0;
          } else {
            emptyCount++;
            if (emptyCount >= 3) break;
          }
        } catch {
          emptyCount++;
          if (emptyCount >= 3) break;
        }
      }

      if (!cancelled) {
        setMinYear(foundYear);
        setHeatmapYear(currentYear);
        setMinYearLoaded(true);
      }
    }

    detectMinYear();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!minYearLoaded) return;

    const isCurrentYear = heatmapYear === maxYear;
    const yearStart = isCurrentYear ? `${heatmapYear - 1}-01-01` : `${heatmapYear}-01-01`;
    const yearEnd = `${heatmapYear}-12-31`;
    invoke<DailyAppBreakdown[]>("get_daily_app_breakdown", { startDate: yearStart, endDate: yearEnd })
      .then(setYearlyBreakdown)
      .catch((e) => console.error("Heatmap fetch error:", e));
  }, [heatmapYear, minYearLoaded]);

  const dailySeconds = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of yearlyBreakdown) {
      map.set(row.date, (map.get(row.date) || 0) + row.total_seconds);
    }
    return map;
  }, [yearlyBreakdown]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [app, prevApp, cat, prevCat] = await Promise.all([
        invoke<DailyAppBreakdown[]>("get_daily_app_breakdown", { startDate: range.start, endDate: range.end }),
        invoke<DailyAppBreakdown[]>("get_daily_app_breakdown", { startDate: range.prevStart, endDate: range.prevEnd }),
        invoke<DailyCategoryBreakdown[]>("get_daily_category_breakdown", { startDate: range.start, endDate: range.end }),
        invoke<DailyCategoryBreakdown[]>("get_daily_category_breakdown", { startDate: range.prevStart, endDate: range.prevEnd }),
      ]);
      setAppBreakdown(app);
      setPrevAppBreakdown(prevApp);
      setCatBreakdown(cat);
      setPrevCatBreakdown(prevCat);
    } catch (e) {
      console.error("Report fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const overview = useMemo<ReportOverview>(
    () => buildOverview(appBreakdown, prevAppBreakdown, catBreakdown, prevCatBreakdown, period),
    [appBreakdown, prevAppBreakdown, catBreakdown, prevCatBreakdown, period],
  );

  const appRanking = useMemo<AppRankingItem[]>(
    () => buildAppRanking(appBreakdown, prevAppBreakdown),
    [appBreakdown, prevAppBreakdown],
  );

  const categoryRanking = useMemo<CategoryRankingItem[]>(
    () => buildCategoryRanking(catBreakdown, prevCatBreakdown),
    [catBreakdown, prevCatBreakdown],
  );

  useEffect(() => {
    const names = appRanking.map((item) => item.key);
    if (names.length > 0) {
      void ensureAppIconsLoaded(names.filter((n) => !appIcons[n]));
    }
  }, [appRanking, appIcons, ensureAppIconsLoaded]);

  useEffect(() => {
    const fileIconIds = categories
      .filter((c) => c.icon_source === "file")
      .map((c) => c.id);
    if (fileIconIds.length > 0) {
      void ensureCategoryFileIconsLoaded(fileIconIds);
    }
  }, [categories, ensureCategoryFileIconsLoaded]);

  const categoryIcons = useMemo(() => {
    const catMap = new Map(categories.map((c) => [c.id, c]));
    const result: Record<number, string> = {};
    for (const item of categoryRanking) {
      const cat = catMap.get(item.key);
      if (!cat) continue;
      if (cat.icon_source === "builtin" && cat.builtin_icon_key) {
        const def = BUILTIN_CATEGORY_ICONS.find((i) => i.key === cat.builtin_icon_key);
        if (def) result[item.key] = def.svg;
      } else if (cat.icon_source === "file" && categoryFileIcons[item.key]) {
        result[item.key] = categoryFileIcons[item.key];
      }
    }
    return result;
  }, [categories, categoryRanking, categoryFileIcons]);

  const handlePrev = useCallback(() => {
    if (period === "day") {
      setAnchorDate((d) => addDays(d, -1));
    } else if (period === "week") {
      setAnchorDate((d) => addDays(d, -7));
    } else if (period === "month") {
      const [y, m] = anchorDate.split("-").map(Number);
      const d = new Date(y, m - 2, 1);
      setAnchorDate(d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-01");
    } else {
      const y = parseInt(anchorDate.split("-")[0], 10) - 1;
      setAnchorDate(`${y}-01-01`);
    }
  }, [period, anchorDate]);

  const handleNext = useCallback(() => {
    if (period === "day") {
      setAnchorDate((d) => addDays(d, 1));
    } else if (period === "week") {
      setAnchorDate((d) => addDays(d, 7));
    } else if (period === "month") {
      const [y, mon] = anchorDate.split("-").map(Number);
      const d = new Date(y, mon, 1);
      setAnchorDate(d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-01");
    } else {
      const y = parseInt(anchorDate.split("-")[0], 10) + 1;
      setAnchorDate(`${y}-01-01`);
    }
  }, [period, anchorDate]);

  const handlePeriodChange = useCallback((newPeriod: ReportPeriod) => {
    setPeriod(newPeriod);
    setAnchorDate(getTodayString());
  }, []);

  const handleHeatmapYearChange = useCallback((newYear: number) => {
    setHeatmapYear(newYear);
  }, []);

  return (
    <div className="space-y-6">
      <ReportPeriodSwitcher
        anchorDate={anchorDate}
        period={period}
        periodLabel={periodLabel}
        onPeriodChange={handlePeriodChange}
        onPrev={handlePrev}
        onNext={handleNext}
      />

      <ReportOverviewCards overview={overview} period={period} />

      <ReportRanking
        appItems={appRanking}
        categoryItems={categoryRanking}
        loading={loading}
        appIcons={appIcons}
        categoryIcons={categoryIcons}
        totalSeconds={overview.totalSeconds}
      />

      <UsageHeatmap
        year={heatmapYear}
        minYear={minYear}
        maxYear={maxYear}
        dailySeconds={dailySeconds}
        onYearChange={handleHeatmapYearChange}
      />
    </div>
  );
}
