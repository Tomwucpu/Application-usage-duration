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

export interface TrackerState {
  is_running: boolean;
  is_afk: boolean;
  current_app: string;
  current_title: string;
  current_icon: string;
  today_total_seconds: number;
}

export interface HourlyAppBreakdown {
  hour: number;
  app_name: string;
  total_seconds: number;
  percentage: number;
}

export interface DailyAppBreakdown {
  date: string;
  app_name: string;
  total_seconds: number;
  percentage: number;
}

export type ViewMode = "daily" | "weekly" | "monthly" | "custom";
