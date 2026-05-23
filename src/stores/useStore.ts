import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { enable, isEnabled, disable } from "@tauri-apps/plugin-autostart";
import type { DailySummary, TrackerState, HourlyAppBreakdown, DailyAppBreakdown, UsageRecord, ViewMode, ImportBatchResult, ImportRecord, AppMetadataItem } from "../types";

const shouldLogBaseline = typeof location !== "undefined" && location.hostname === "localhost";

function logBaseline(message: string) {
  if (shouldLogBaseline) {
    console.debug(message);
  }
}

export const api = {
  getSetting: async (key: string) => {
    const t0 = performance.now();
    const res = await invoke<string | null>("get_setting", { key });
    const t1 = Math.round(performance.now() - t0);
    try {
      const size = res ? JSON.stringify(res).length : 0;
      logBaseline(`[baseline] get_setting ${key} ${t1}ms size=${size}`);
    } catch {
      logBaseline(`[baseline] get_setting ${key} ${t1}ms`);
    }
    return res;
  },
  setSetting: async (key: string, value: string) => {
    const t0 = performance.now();
    const res = await invoke<void>("set_setting", { key, value });
    const t1 = Math.round(performance.now() - t0);
    logBaseline(`[baseline] set_setting ${key} ${t1}ms`);
    return res;
  },
  getAllAppNames: async () => {
    const t0 = performance.now();
    const res = await invoke<string[]>("get_all_app_names");
    const t1 = Math.round(performance.now() - t0);
    try {
      logBaseline(`[baseline] get_all_app_names ${t1}ms size=${JSON.stringify(res).length}`);
    } catch {
      logBaseline(`[baseline] get_all_app_names ${t1}ms`);
    }
    return res;
  },
  getAllAppIcons: async () => {
    const t0 = performance.now();
    const res = await invoke<Record<string, string>>("get_all_app_icons");
    const t1 = Math.round(performance.now() - t0);
    try {
      logBaseline(`[baseline] get_all_app_icons ${t1}ms size=${Object.keys(res || {}).length}`);
    } catch {
      logBaseline(`[baseline] get_all_app_icons ${t1}ms`);
    }
    return res;
  },
  getAllRecords: async () => {
    const t0 = performance.now();
    const res = await invoke<UsageRecord[]>("get_all_records");
    const t1 = Math.round(performance.now() - t0);
    try {
      logBaseline(`[baseline] get_all_records ${t1}ms size=${JSON.stringify(res).length}`);
    } catch {
      logBaseline(`[baseline] get_all_records ${t1}ms`);
    }
    return res;
  },
  getRecordsRange: async (startDate: string, endDate: string, offset: number, limit: number) => {
    const res = await invoke<UsageRecord[]>("get_records_range", {
      startDate,
      endDate,
      offset,
      limit,
    });
    return res;
  },
  getRecordCount: async (startDate: string, endDate: string) => {
    const res = await invoke<number>("get_record_count", { startDate, endDate });
    return res;
  },
  importRecordsBatch: async (records: ImportRecord[]) => {
    const res = await invoke<ImportBatchResult>("import_records_batch", { records });
    return res;
  },
  getAppMetadataList: async () => {
    const t0 = performance.now();
    const res = await invoke<AppMetadataItem[]>("get_all_app_metadata_list");
    const t1 = Math.round(performance.now() - t0);
    try {
      logBaseline(`[baseline] get_all_app_metadata_list ${t1}ms size=${JSON.stringify(res).length}`);
    } catch {
      logBaseline(`[baseline] get_all_app_metadata_list ${t1}ms`);
    }
    return res;
  },
  setAppDisplayName: async (appName: string, displayName: string | null) => {
    await invoke<void>("set_app_display_name", { appName, displayName });
  },
  setAppCustomIcon: async (appName: string, customIconPath: string | null) => {
    await invoke<void>("set_app_custom_icon", { appName, customIconPath });
  },
  resetAppDisplayName: async (appName: string) => {
    await invoke<void>("reset_app_display_name", { appName });
  },
  resetAppCustomIcon: async (appName: string) => {
    await invoke<void>("reset_app_custom_icon", { appName });
  },
  deleteRecordsByApp: async (appName: string) => {
    await invoke<number>("delete_records_by_app", { appName });
  },
  renameApp: async (oldName: string, newName: string) => {
    await invoke<void>("rename_app", { oldName, newName });
  },
  getAppDisplayNames: async () => {
    const res = await invoke<Record<string, string>>("get_app_display_names");
    return res;
  },
};

type TabId = "dashboard" | "breakdown";
type Theme = "light" | "dark";

interface Store {
  tracker: TrackerState;
  summary: DailySummary | null;
  selectedDate: string;
  loading: boolean;
  activeTab: TabId;
  theme: Theme;
  hourlyBreakdown: HourlyAppBreakdown[];
  hourlyBreakdownDate: string | null;
  dailyBreakdown: DailyAppBreakdown[];
  dailyBreakdownRange: { start: string; end: string } | null;
  rangeBreakdown: DailyAppBreakdown[];
  rangeBreakdownRange: { start: string; end: string } | null;
  viewMode: ViewMode;
  customStartDate: string | null;
  customEndDate: string | null;
  appIcons: Record<string, string>;
  displayNames: Record<string, string>;
  autoStartEnabled: boolean;
  init: () => Promise<() => void>;
  setDate: (date: string) => Promise<void>;
  refresh: () => Promise<void>;
  setActiveTab: (tab: TabId) => void;
  setTheme: (theme: Theme) => void;
  setViewMode: (mode: ViewMode) => void;
  setCustomRange: (start: string, end: string) => void;
  loadHourlyBreakdown: (date: string, force?: boolean) => Promise<void>;
  loadDailyBreakdown: (date: string, force?: boolean) => Promise<void>;
  loadRangeBreakdown: (start: string, end: string, force?: boolean) => Promise<void>;
  ensureAppIconsLoaded: (force?: boolean) => Promise<void>;
  checkAutoStart: () => Promise<void>;
  toggleAutoStart: () => Promise<void>;
}

function getWeekRange(dateStr: string): { start: string; end: string } {
  const d = new Date(dateStr + "T00:00:00");
  const dayOfWeek = d.getDay();
  // Monday = 1, Sunday = 0 or 7 → offset to Monday
  const offsetToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(d);
  monday.setDate(d.getDate() + offsetToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (dt: Date) => dt.toISOString().slice(0, 10);
  return { start: fmt(monday), end: fmt(sunday) };
}

function getMonthRange(dateStr: string): { start: string; end: string } {
  const d = new Date(dateStr + "T00:00:00");
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const fmt = (dt: Date) => dt.toISOString().slice(0, 10);
  return { start: fmt(first), end: fmt(last) };
}

export const useStore = create<Store>((set, get) => ({
  tracker: {
    is_running: false,
    is_afk: false,
    current_app: "",
    current_title: "",
    current_icon: "",
    today_total_seconds: 0,
  },
  summary: null,
  selectedDate: new Date().toISOString().slice(0, 10),
  loading: false,
  activeTab: "dashboard",
  theme: (localStorage.getItem("theme") as Theme) || "dark",
  hourlyBreakdown: [],
  hourlyBreakdownDate: null,
  dailyBreakdown: [],
  dailyBreakdownRange: null,
  rangeBreakdown: [],
  rangeBreakdownRange: null,
  viewMode: "daily",
  customStartDate: null,
  customEndDate: null,
  appIcons: {},
  displayNames: {},
  autoStartEnabled: false,

  init: async () => {
    // Apply theme on load
    const currentTheme = get().theme;
    if (currentTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    let lastTrackerUpdate = 0;
    const THROTTLE_MS = 1000;
    const unlisten = await listen<TrackerState>("tracker-state", (event) => {
      const now = Date.now();
      if (now - lastTrackerUpdate < THROTTLE_MS) {
        return;
      }
      lastTrackerUpdate = now;
      set({ tracker: event.payload });
    });

    await invoke("start_tracking");

    const [summary] = await Promise.all([
      invoke<DailySummary>("get_daily_summary", { date: get().selectedDate }),
      get().ensureAppIconsLoaded(),
    ]);
    set({ summary });

    // Check auto-start status
    try {
      const enabled = await isEnabled();
      set({ autoStartEnabled: enabled });
    } catch {
      // Plugin may not be available in dev
    }

    return () => {
      unlisten();
    };
  },

  setDate: async (date: string) => {
    set({ selectedDate: date });
    const [summary] = await Promise.all([
      invoke<DailySummary>("get_daily_summary", { date }),
      get().ensureAppIconsLoaded(),
    ]);
    set({ summary });
  },

  refresh: async () => {
    set({ loading: true });
    try {
      await invoke("flush_tracking");
      const state = get();
      const tasks: Promise<unknown>[] = [
        invoke<DailySummary>("get_daily_summary", { date: state.selectedDate }).then((summary) => {
          set({ summary });
        }),
        invoke<number>("get_today_total_seconds").then((seconds) => {
          set((s) => ({ tracker: { ...s.tracker, today_total_seconds: seconds } }));
        }),
        state.ensureAppIconsLoaded(),
      ];

      if (state.viewMode === "daily") {
        tasks.push(state.loadHourlyBreakdown(state.selectedDate, true));
        const { start, end } = getWeekRange(state.selectedDate);
        tasks.push(state.loadRangeBreakdown(start, end, true));
      } else if (state.viewMode === "weekly") {
        const { start, end } = getWeekRange(state.selectedDate);
        tasks.push(state.loadRangeBreakdown(start, end, true));
      } else if (state.viewMode === "monthly") {
        const { start, end } = getMonthRange(state.selectedDate);
        tasks.push(state.loadRangeBreakdown(start, end, true));
      } else if (state.viewMode === "custom" && state.customStartDate && state.customEndDate) {
        tasks.push(state.loadRangeBreakdown(state.customStartDate, state.customEndDate, true));
      }

      await Promise.all(tasks);
    } finally {
      set({ loading: false });
    }
  },

  setActiveTab: (tab: TabId) => {
    set({ activeTab: tab });
  },

  setTheme: (theme: Theme) => {
    localStorage.setItem("theme", theme);
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    set({ theme });
    invoke("update_window_theme", { theme });
  },

  loadHourlyBreakdown: async (date: string, force = false) => {
    const state = get();
    if (!force && state.hourlyBreakdownDate === date && state.hourlyBreakdown.length > 0) {
      return;
    }

    const data = await invoke<HourlyAppBreakdown[]>("get_hourly_app_breakdown", { date });
    set({ hourlyBreakdown: data, hourlyBreakdownDate: date });
  },

  setViewMode: (mode: ViewMode) => {
    const state = get();
    set({ viewMode: mode });
    // Default custom range to last 7 days if switching to custom with no range set
    if (mode === "custom" && (!state.customStartDate || !state.customEndDate)) {
      const today = new Date().toISOString().slice(0, 10);
      const weekAgo = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
      set({ customStartDate: weekAgo, customEndDate: today });
    }
  },

  setCustomRange: (start: string, end: string) => {
    // Ensure start <= end
    if (start > end) {
      set({ customStartDate: end, customEndDate: start });
    } else {
      set({ customStartDate: start, customEndDate: end });
    }
  },

  loadRangeBreakdown: async (start: string, end: string, force = false) => {
    const state = get();
    if (
      !force
      && state.rangeBreakdownRange
      && state.rangeBreakdownRange.start === start
      && state.rangeBreakdownRange.end === end
      && state.rangeBreakdown.length > 0
    ) {
      return;
    }

    const data = await invoke<DailyAppBreakdown[]>("get_daily_app_breakdown", { startDate: start, endDate: end });
    set({
      rangeBreakdown: data,
      rangeBreakdownRange: { start, end },
      dailyBreakdown: data,
      dailyBreakdownRange: { start, end },
    });
  },

  loadDailyBreakdown: async (date: string, force = false) => {
    const { start, end } = getWeekRange(date);
    await get().loadRangeBreakdown(start, end, force);
  },

  ensureAppIconsLoaded: async (force = false) => {
    const state = get();
    if (!force && Object.keys(state.appIcons).length > 0) {
      return;
    }

    const [icons, names] = await Promise.all([
      api.getAllAppIcons(),
      api.getAppDisplayNames(),
    ]);

    if (icons && Object.keys(icons).length > 0) {
      set({ appIcons: { ...state.appIcons, ...icons } });
    }
    if (names && Object.keys(names).length > 0) {
      set({ displayNames: { ...state.displayNames, ...names } });
    }
  },

  checkAutoStart: async () => {
    try {
      const enabled = await isEnabled();
      set({ autoStartEnabled: enabled });
    } catch {
      // Ignore
    }
  },

  toggleAutoStart: async () => {
    const current = get().autoStartEnabled;
    try {
      if (current) {
        await disable();
      } else {
        await enable();
      }
      set({ autoStartEnabled: !current });
    } catch {
      // Ignore
    }
  },
}));
