export interface UsageRecord {
  id: number;
  app_name: string;
  app_path: string | null;
  window_title: string | null;
  start_time: string;
  end_time: string;
  duration_seconds: number;
  date: string;
  hour: number;
}

export interface ImportRecord {
  app_name: string;
  app_path: string | null;
  window_title: string | null;
  start_time: string;
  end_time: string;
  duration_seconds: number;
  date: string;
  hour: number;
}

export interface ImportBatchResult {
  imported: number;
  skipped: number;
}

export interface ImportPreview {
  totalRecords: number;
  dateRange: { earliest: string; latest: string } | null;
  uniqueApps: number;
  errors: string[];
}

export interface AppSummary {
  app_name: string;
  total_seconds: number;
  percentage: number;
}

export interface HourlySummary {
  hour: number;
  total_seconds: number;
}

export interface DailySummary {
  total_seconds: number;
  apps: AppSummary[];
  hourly: HourlySummary[];
}

export interface CategorySummaryItem {
  category_id: number;
  category_name: string;
  icon_source: "builtin" | "file";
  builtin_icon_key: string | null;
  custom_icon_path: string | null;
  total_seconds: number;
  percentage: number;
}

export interface TrackerState {
  is_running: boolean;
  is_afk: boolean;
  current_title: string;
  today_total_seconds: number;
}

export interface HourlyAppBreakdown {
  hour: number;
  app_name: string;
  total_seconds: number;
}

export interface DailyAppBreakdown {
  date: string;
  app_name: string;
  total_seconds: number;
}

export interface HourlyCategoryBreakdown {
  hour: number;
  category_id: number;
  category_name: string;
  icon_source: "builtin" | "file";
  builtin_icon_key: string | null;
  custom_icon_path: string | null;
  total_seconds: number;
}

export interface DailyCategoryBreakdown {
  date: string;
  category_id: number;
  category_name: string;
  icon_source: "builtin" | "file";
  builtin_icon_key: string | null;
  custom_icon_path: string | null;
  total_seconds: number;
}

export type ViewMode = "daily" | "weekly" | "monthly" | "custom";
export type GroupBy = "app" | "category";
export type CategoryIconSource = "builtin" | "file";
export type PageView = "dashboard" | "settings" | "appManagement" | "categoryManagement";

export interface AppMetadataItem {
  app_name: string;
  app_path: string | null;
  display_name: string | null;
  custom_icon_path: string | null;
  default_icon_path: string | null;
  category_id: number | null;
  category_name: string | null;
  category_icon_source: CategoryIconSource | null;
  category_builtin_icon_key: string | null;
  category_custom_icon_path: string | null;
  total_seconds: number;
  record_count: number;
}

export interface AppFilterOption {
  app_name: string;
  display_name: string | null;
  category_id: number | null;
  category_name: string | null;
}

export interface CategoryItem {
  id: number;
  key: string | null;
  name: string;
  icon_source: CategoryIconSource;
  builtin_icon_key: string | null;
  custom_icon_path: string | null;
  is_default: boolean;
  is_builtin: boolean;
  sort_order: number;
  app_count: number;
  total_seconds: number;
}

export interface UsageRankingItem {
  key: string;
  label: string;
  icon?: string | null;
  total_seconds: number;
  percentage: number;
}
