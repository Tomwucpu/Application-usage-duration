import type {
  AppSummary,
  CategorySummaryItem,
  DailyAppBreakdown,
  DailyCategoryBreakdown,
  DailySummary,
  HourlyAppBreakdown,
  HourlyCategoryBreakdown,
} from "../../types";

export const DASHBOARD_APP_FILTER_STORAGE_KEY = "dashboardSelectedAppNames";
export const DASHBOARD_CATEGORY_FILTER_STORAGE_KEY = "dashboardSelectedCategoryIds";

type AppBreakdownRow = HourlyAppBreakdown | DailyAppBreakdown;
type CategoryBreakdownRow = HourlyCategoryBreakdown | DailyCategoryBreakdown;

export interface CategoryDisplaySummary {
  total_seconds: number;
  items: CategorySummaryItem[];
}

function uniqueValues<T extends string | number>(values: T[]): T[] {
  return [...new Set(values)];
}

export function parseStoredStringArray(raw: string | null): string[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return uniqueValues(
      parsed.filter((value): value is string => typeof value === "string" && value.length > 0),
    );
  } catch {
    return [];
  }
}

export function parseStoredNumberArray(raw: string | null): number[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return uniqueValues(
      parsed.filter(
        (value): value is number => typeof value === "number" && Number.isFinite(value),
      ),
    );
  } catch {
    return [];
  }
}

export function getDashboardFilterLabel<T extends string | number>(
  selectedValues: T[],
  options: Array<{ value: T; label: string }>,
  defaultLabel: string,
  selectedCountLabel: string,
): string {
  if (selectedValues.length === 0) {
    return defaultLabel;
  }

  const labelMap = new Map(options.map((option) => [option.value, option.label]));
  const labels = uniqueValues(selectedValues)
    .map((value) => labelMap.get(value))
    .filter((label): label is string => Boolean(label));

  if (labels.length === 0) {
    return defaultLabel;
  }

  if (labels.length === 1) {
    return labels[0];
  }

  return selectedCountLabel.replace("{count}", String(labels.length));
}

export function filterAppSummary(
  summary: DailySummary | null,
  selectedAppNames: string[],
): DailySummary | null {
  if (!summary || selectedAppNames.length === 0) {
    return summary;
  }

  const selected = new Set(selectedAppNames);
  const apps = summary.apps.filter((app) => selected.has(app.app_name));
  const total_seconds = apps.reduce((sum, app) => sum + app.total_seconds, 0);

  return {
    total_seconds,
    apps: apps.map((app) => ({
      ...app,
      percentage: total_seconds > 0 ? (app.total_seconds / total_seconds) * 100 : 0,
    })),
    hourly: summary.hourly,
  };
}

export function filterBreakdownRowsByApps<T extends AppBreakdownRow>(
  rows: T[],
  selectedAppNames: string[],
): T[] {
  if (selectedAppNames.length === 0) {
    return rows;
  }

  const selected = new Set(selectedAppNames);
  return rows.filter((row) => selected.has(row.app_name));
}

export function buildAppSummaryFromRangeRows(rows: DailyAppBreakdown[]): DailySummary {
  if (rows.length === 0) {
    return { total_seconds: 0, apps: [], hourly: [] };
  }

  const totals = new Map<string, number>();
  let total_seconds = 0;

  for (const row of rows) {
    totals.set(row.app_name, (totals.get(row.app_name) || 0) + row.total_seconds);
    total_seconds += row.total_seconds;
  }

  const apps: AppSummary[] = [...totals.entries()]
    .map(([app_name, appTotal]) => ({
      app_name,
      total_seconds: appTotal,
      percentage: total_seconds > 0 ? (appTotal / total_seconds) * 100 : 0,
    }))
    .sort((a, b) => b.total_seconds - a.total_seconds);

  return { total_seconds, apps, hourly: [] };
}

export function filterCategorySummaryItems(
  items: CategorySummaryItem[],
  selectedCategoryIds: number[],
): CategoryDisplaySummary {
  if (selectedCategoryIds.length === 0) {
    const total_seconds = items.reduce((sum, item) => sum + item.total_seconds, 0);
    return { total_seconds, items };
  }

  const selected = new Set(selectedCategoryIds);
  const filtered = items.filter((item) => selected.has(item.category_id));
  const total_seconds = filtered.reduce((sum, item) => sum + item.total_seconds, 0);

  return {
    total_seconds,
    items: filtered.map((item) => ({
      ...item,
      percentage: total_seconds > 0 ? (item.total_seconds / total_seconds) * 100 : 0,
    })),
  };
}

export function filterBreakdownRowsByCategories<T extends CategoryBreakdownRow>(
  rows: T[],
  selectedCategoryIds: number[],
): T[] {
  if (selectedCategoryIds.length === 0) {
    return rows;
  }

  const selected = new Set(selectedCategoryIds);
  return rows.filter((row) => selected.has(row.category_id));
}

export function buildCategorySummaryFromRangeRows(
  rows: DailyCategoryBreakdown[],
): CategoryDisplaySummary {
  if (rows.length === 0) {
    return { total_seconds: 0, items: [] };
  }

  const totals = new Map<number, CategorySummaryItem>();
  let total_seconds = 0;

  for (const row of rows) {
    total_seconds += row.total_seconds;
    const existing = totals.get(row.category_id);

    if (existing) {
      existing.total_seconds += row.total_seconds;
      continue;
    }

    totals.set(row.category_id, {
      category_id: row.category_id,
      category_name: row.category_name,
      icon_source: row.icon_source,
      builtin_icon_key: row.builtin_icon_key,
      custom_icon_path: row.custom_icon_path,
      total_seconds: row.total_seconds,
      percentage: 0,
    });
  }

  const items = [...totals.values()]
    .map((item) => ({
      ...item,
      percentage: total_seconds > 0 ? (item.total_seconds / total_seconds) * 100 : 0,
    }))
    .sort((a, b) => b.total_seconds - a.total_seconds);

  return { total_seconds, items };
}
