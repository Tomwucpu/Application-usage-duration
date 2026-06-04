import type { DailyAppBreakdown, DailyCategoryBreakdown } from "../types";
import { fmtLocalDate, parseDate, getWeekRange, getMonthRange, addDays, getTodayString } from "./dates";

export type ReportPeriod = "day" | "week" | "month" | "year";

export interface ReportPeriodRange {
  start: string;
  end: string;
  prevStart: string;
  prevEnd: string;
}

export interface ChangeInfo {
  text: string;
  direction: "up" | "down" | "same" | "new";
  diffText?: string;
}

export interface RankChange {
  text: string;
  direction: "up" | "down" | "same" | "new";
}

export interface AppRankingItem {
  key: string;
  label: string;
  total_seconds: number;
  percentage: number;
  rank: number;
  prevRank: number | null;
  rankChange: RankChange;
  change: ChangeInfo;
  prevTotalSeconds: number | null;
}

export interface CategoryRankingItem {
  key: number;
  label: string;
  total_seconds: number;
  percentage: number;
  rank: number;
  prevRank: number | null;
  rankChange: RankChange;
  change: ChangeInfo;
  prevTotalSeconds: number | null;
}

export interface ReportOverview {
  totalSeconds: number;
  activeApps: number;
  activeCategories: number;
  dailyAverage: number;
  hourlyAverage: number;
  totalSecondsChange: ChangeInfo;
  activeAppsChange: ChangeInfo;
  activeCategoriesChange: ChangeInfo;
  dailyAverageChange: ChangeInfo;
  hourlyAverageChange: ChangeInfo;
  daysCount: number;
}

function getYearRange(dateStr: string, offset = 0): { start: string; end: string } {
  const d = parseDate(dateStr);
  const y = d.getFullYear() + offset;
  return { start: fmtLocalDate(new Date(y, 0, 1)), end: fmtLocalDate(new Date(y, 11, 31)) };
}

function splitHMS(seconds: number) {
  return {
    h: Math.floor(seconds / 3600),
    m: Math.floor((seconds % 3600) / 60),
    s: seconds % 60,
  };
}

export function getReportPeriodRange(anchorDate: string, period: ReportPeriod): ReportPeriodRange {
  switch (period) {
    case "day": {
      const prevDate = addDays(anchorDate, -1);
      return {
        start: anchorDate,
        end: anchorDate,
        prevStart: prevDate,
        prevEnd: prevDate,
      };
    }
    case "week": {
      const current = getWeekRange(anchorDate);
      const prevMonday = addDays(current.start, -7);
      const prevSunday = addDays(current.end, -7);
      return {
        start: current.start,
        end: current.end,
        prevStart: prevMonday,
        prevEnd: prevSunday,
      };
    }
    case "month": {
      const current = getMonthRange(anchorDate);
      const anchorDateObj = parseDate(anchorDate);
      const prevMonthDate = new Date(anchorDateObj.getFullYear(), anchorDateObj.getMonth() - 1, 1);
      const prevRange = getMonthRange(fmtLocalDate(prevMonthDate));
      return {
        start: current.start,
        end: current.end,
        prevStart: prevRange.start,
        prevEnd: prevRange.end,
      };
    }
    case "year": {
      return {
        start: getYearRange(anchorDate).start,
        end: getYearRange(anchorDate).end,
        prevStart: getYearRange(anchorDate, -1).start,
        prevEnd: getYearRange(anchorDate, -1).end,
      };
    }
  }
}

export function getPeriodLabel(anchorDate: string, period: ReportPeriod, locale: string): string {
  switch (period) {
    case "day": {
      const d = parseDate(anchorDate);
      const formatter = new Intl.DateTimeFormat(locale, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
      return formatter.format(d);
    }
    case "week": {
      const range = getWeekRange(anchorDate);
      const start = parseDate(range.start);
      const end = parseDate(range.end);
      const formatter = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" });
      return `${formatter.format(start)} - ${formatter.format(end)}`;
    }
    case "month": {
      const d = parseDate(anchorDate);
      const formatter = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" });
      return formatter.format(d);
    }
    case "year": {
      const d = parseDate(anchorDate);
      return String(d.getFullYear());
    }
  }
}

function formatChangeText(current: number, previous: number | null, diffText?: string): ChangeInfo {
  if (previous === null || previous === 0) {
    return { text: "新增", direction: "new" as const };
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct > 0) return { text: `${Math.abs(pct)}%`, direction: "up" as const, diffText };
  if (pct < 0) return { text: `${Math.abs(pct)}%`, direction: "down" as const, diffText };
  return { text: "—", direction: "same" as const };
}

function formatDiffDuration(diffSeconds: number): string {
  const sign = diffSeconds >= 0 ? "+" : "-";
  const { h, m } = splitHMS(Math.abs(diffSeconds));
  if (h > 0) return `${sign}${h}h ${m}m`;
  if (m > 0) return `${sign}${m}m`;
  return `${sign}0m`;
}

export function formatDurationReport(seconds: number): string {
  const { h, m } = splitHMS(seconds);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return "0m";
}

export function formatDurationFull(seconds: number, locale: string): string {
  const { h, m, s } = splitHMS(seconds);
  if (locale === "zh-CN") {
    if (h > 0) return `${h} 小时 ${m} 分钟`;
    if (m > 0) return `${m} 分钟 ${s} 秒`;
    return `${s} 秒`;
  }
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatRankChangeText(currRank: number, prevRank: number | null): RankChange {
  if (prevRank === null) {
    return { text: "—", direction: "same" as const };
  }
  const diff = prevRank - currRank;
  if (diff > 0) return { text: `${diff}`, direction: "up" as const };
  if (diff < 0) return { text: `${Math.abs(diff)}`, direction: "down" as const };
  return { text: "—", direction: "same" as const };
}

export function buildAppRanking(
  currentBreakdown: DailyAppBreakdown[],
  prevBreakdown: DailyAppBreakdown[],
): AppRankingItem[] {
  const currMap = new Map<string, number>();
  let currTotal = 0;
  for (const row of currentBreakdown) {
    currMap.set(row.app_name, (currMap.get(row.app_name) || 0) + row.total_seconds);
    currTotal += row.total_seconds;
  }

  const prevMap = new Map<string, number>();
  for (const row of prevBreakdown) {
    prevMap.set(row.app_name, (prevMap.get(row.app_name) || 0) + row.total_seconds);
  }

  const currSorted = [...currMap.entries()].sort((a, b) => b[1] - a[1]);
  const prevSorted = [...prevMap.entries()].sort((a, b) => b[1] - a[1]);
  const prevRankMap = new Map<string, number>();
  prevSorted.forEach(([name], i) => prevRankMap.set(name, i + 1));

  return currSorted.map(([appName, seconds], i) => {
    const prevSeconds = prevMap.get(appName) ?? null;
    const prevRank = prevRankMap.get(appName) ?? null;
    const diffText = prevSeconds !== null ? formatDiffDuration(seconds - prevSeconds) : undefined;
    return {
      key: appName,
      label: appName,
      total_seconds: seconds,
      percentage: currTotal > 0 ? (seconds / currTotal) * 100 : 0,
      rank: i + 1,
      prevRank,
      rankChange: formatRankChangeText(i + 1, prevRank),
      change: formatChangeText(seconds, prevSeconds, diffText),
      prevTotalSeconds: prevSeconds,
    };
  });
}

export function buildCategoryRanking(
  currentBreakdown: DailyCategoryBreakdown[],
  prevBreakdown: DailyCategoryBreakdown[],
): CategoryRankingItem[] {
  const currMap = new Map<number, { seconds: number; name: string }>();
  let currTotal = 0;
  for (const row of currentBreakdown) {
    const existing = currMap.get(row.category_id);
    if (existing) {
      existing.seconds += row.total_seconds;
    } else {
      currMap.set(row.category_id, { seconds: row.total_seconds, name: row.category_name });
    }
    currTotal += row.total_seconds;
  }

  const prevMap = new Map<number, number>();
  for (const row of prevBreakdown) {
    prevMap.set(row.category_id, (prevMap.get(row.category_id) || 0) + row.total_seconds);
  }

  const currSorted = [...currMap.entries()].sort((a, b) => b[1].seconds - a[1].seconds);
  const prevSorted = [...prevMap.entries()].sort((a, b) => b[1] - a[1]);
  const prevRankMap = new Map<number, number>();
  prevSorted.forEach(([id], i) => prevRankMap.set(id, i + 1));

  return currSorted.map(([catId, info], i) => {
    const prevSeconds = prevMap.get(catId) ?? null;
    const prevRank = prevRankMap.get(catId) ?? null;
    const diffText = prevSeconds !== null ? formatDiffDuration(info.seconds - prevSeconds) : undefined;
    return {
      key: catId,
      label: info.name,
      total_seconds: info.seconds,
      percentage: currTotal > 0 ? (info.seconds / currTotal) * 100 : 0,
      rank: i + 1,
      prevRank,
      rankChange: formatRankChangeText(i + 1, prevRank),
      change: formatChangeText(info.seconds, prevSeconds, diffText),
      prevTotalSeconds: prevSeconds,
    };
  });
}

export function buildOverview(
  appBreakdown: DailyAppBreakdown[],
  prevAppBreakdown: DailyAppBreakdown[],
  catBreakdown: DailyCategoryBreakdown[],
  prevCatBreakdown: DailyCategoryBreakdown[],
  period: ReportPeriod,
): ReportOverview {
  let currSeconds = 0;
  const currApps = new Set<string>();
  for (const row of appBreakdown) {
    currSeconds += row.total_seconds;
    currApps.add(row.app_name);
  }

  let prevSeconds = 0;
  const prevApps = new Set<string>();
  for (const row of prevAppBreakdown) {
    prevSeconds += row.total_seconds;
    prevApps.add(row.app_name);
  }

  const currCats = new Set<number>();
  for (const row of catBreakdown) {
    currCats.add(row.category_id);
  }

  const prevCats = new Set<number>();
  for (const row of prevCatBreakdown) {
    prevCats.add(row.category_id);
  }

  let daysCount = 1;
  if (period === "week") daysCount = 7;
  else if (period === "month") {
    const range = getMonthRange(getTodayString());
    const first = parseDate(range.start);
    daysCount = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  } else if (period === "year") daysCount = 365;

  const dailyAvg = daysCount > 0 ? Math.round(currSeconds / daysCount) : 0;
  const prevDailyAvg = daysCount > 0 ? Math.round(prevSeconds / daysCount) : 0;
  const hourlyAvg = Math.round(currSeconds / 24);
  const prevHourlyAvg = Math.round(prevSeconds / 24);

  const fmtDurationDiff = (c: number, p: number) => formatDiffDuration(c - p);
  const fmtCountDiff = (c: number, p: number) => `${c - p >= 0 ? "+" : ""}${c - p}`;

  return {
    totalSeconds: currSeconds,
    activeApps: currApps.size,
    activeCategories: currCats.size,
    dailyAverage: dailyAvg,
    hourlyAverage: hourlyAvg,
    totalSecondsChange: formatChangeText(currSeconds, prevSeconds || null, prevSeconds ? fmtDurationDiff(currSeconds, prevSeconds) : undefined),
    activeAppsChange: formatChangeText(currApps.size, prevApps.size || null, prevApps.size ? fmtCountDiff(currApps.size, prevApps.size) : undefined),
    activeCategoriesChange: formatChangeText(currCats.size, prevCats.size || null, prevCats.size ? fmtCountDiff(currCats.size, prevCats.size) : undefined),
    dailyAverageChange: formatChangeText(dailyAvg, prevDailyAvg || null, prevDailyAvg ? fmtDurationDiff(dailyAvg, prevDailyAvg) : undefined),
    hourlyAverageChange: formatChangeText(hourlyAvg, prevHourlyAvg || null, prevHourlyAvg ? fmtDurationDiff(hourlyAvg, prevHourlyAvg) : undefined),
    daysCount,
  };
}
