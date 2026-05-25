import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { enable, isEnabled, disable } from "@tauri-apps/plugin-autostart";
import type {
  AppMetadataItem,
  CategoryItem,
  CategorySummaryItem,
  DailyAppBreakdown,
  DailyCategoryBreakdown,
  DailySummary,
  GroupBy,
  HourlyAppBreakdown,
  HourlyCategoryBreakdown,
  ImportBatchResult,
  ImportRecord,
  TrackerState,
  UsageRecord,
  ViewMode,
} from "../types";
import { addDays, getBreakdownRange, getTodayString } from "../utils/dates";

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
  getCategoryFileIcons: async () => {
    const res = await invoke<Record<number, string>>("get_category_file_icons");
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
  getAllCategories: async () => {
    const res = await invoke<CategoryItem[]>("get_all_categories");
    return res;
  },
  createCategory: async (payload: {
    name: string;
    iconSource: "builtin" | "file";
    builtinIconKey: string | null;
    customIconPath: string | null;
  }) => {
    await invoke<void>("create_category", payload);
  },
  updateCategory: async (payload: {
    id: number;
    name: string;
    iconSource: "builtin" | "file";
    builtinIconKey: string | null;
    customIconPath: string | null;
  }) => {
    await invoke<void>("update_category", payload);
  },
  deleteCategory: async (id: number) => {
    await invoke<void>("delete_category", { id });
  },
  setAppCategory: async (appName: string, categoryId: number) => {
    await invoke<void>("set_app_category", { appName, categoryId });
  },
  getCategorySummary: async (date: string) => {
    return await invoke<CategorySummaryItem[]>("get_category_summary", { date });
  },
  getHourlyCategoryBreakdown: async (date: string) => {
    return await invoke<HourlyCategoryBreakdown[]>("get_hourly_category_breakdown", { date });
  },
  getDailyCategoryBreakdown: async (startDate: string, endDate: string) => {
    return await invoke<DailyCategoryBreakdown[]>("get_daily_category_breakdown", { startDate, endDate });
  },
};

type TabId = "dashboard" | "breakdown";
type Theme = "light" | "dark";

interface Store {
  tracker: TrackerState;
  summary: DailySummary | null;
  categorySummary: CategorySummaryItem[];
  selectedDate: string;
  loading: boolean;
  activeTab: TabId;
  theme: Theme;
  groupBy: GroupBy;
  hourlyBreakdown: HourlyAppBreakdown[];
  hourlyBreakdownDate: string | null;
  dailyBreakdown: DailyAppBreakdown[];
  dailyBreakdownRange: { start: string; end: string } | null;
  rangeBreakdown: DailyAppBreakdown[];
  rangeBreakdownRange: { start: string; end: string } | null;
  hourlyCategoryBreakdown: HourlyCategoryBreakdown[];
  hourlyCategoryBreakdownDate: string | null;
  rangeCategoryBreakdown: DailyCategoryBreakdown[];
  rangeCategoryBreakdownRange: { start: string; end: string } | null;
  viewMode: ViewMode;
  customStartDate: string | null;
  customEndDate: string | null;
  appIcons: Record<string, string>;
  displayNames: Record<string, string>;
  categoryFileIcons: Record<number, string>;
  categories: CategoryItem[];
  autoStartEnabled: boolean;
  init: () => Promise<() => void>;
  setDate: (date: string) => Promise<void>;
  refresh: () => Promise<void>;
  setActiveTab: (tab: TabId) => void;
  setTheme: (theme: Theme) => void;
  setViewMode: (mode: ViewMode) => void;
  setGroupBy: (groupBy: GroupBy) => void;
  setCustomRange: (start: string, end: string) => void;
  loadHourlyBreakdown: (date: string, force?: boolean) => Promise<void>;
  loadDailyBreakdown: (date: string, force?: boolean) => Promise<void>;
  loadRangeBreakdown: (start: string, end: string, force?: boolean) => Promise<void>;
  loadCategorySummary: (date: string, force?: boolean) => Promise<void>;
  loadHourlyCategoryBreakdown: (date: string, force?: boolean) => Promise<void>;
  loadRangeCategoryBreakdown: (start: string, end: string, force?: boolean) => Promise<void>;
  ensureAppIconsLoaded: (force?: boolean) => Promise<void>;
  loadCategories: (force?: boolean) => Promise<void>;
  checkAutoStart: () => Promise<void>;
  toggleAutoStart: () => Promise<void>;
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
  categorySummary: [],
  selectedDate: getTodayString(),
  loading: false,
  activeTab: "dashboard",
  theme: (localStorage.getItem("theme") as Theme) || "dark",
  groupBy: (localStorage.getItem("groupBy") as GroupBy) || "app",
  hourlyBreakdown: [],
  hourlyBreakdownDate: null,
  dailyBreakdown: [],
  dailyBreakdownRange: null,
  rangeBreakdown: [],
  rangeBreakdownRange: null,
  hourlyCategoryBreakdown: [],
  hourlyCategoryBreakdownDate: null,
  rangeCategoryBreakdown: [],
  rangeCategoryBreakdownRange: null,
  viewMode: "daily",
  customStartDate: null,
  customEndDate: null,
  appIcons: {},
  displayNames: {},
  categoryFileIcons: {},
  categories: [],
  autoStartEnabled: false,

  init: async () => {
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
      get().loadCategorySummary(get().selectedDate, true),
      get().ensureAppIconsLoaded(),
      get().loadCategories(true),
    ]);
    set({ summary });

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
      get().loadCategorySummary(date, true),
      get().ensureAppIconsLoaded(true),
      get().loadCategories(true),
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
        state.loadCategorySummary(state.selectedDate, true),
        invoke<number>("get_today_total_seconds").then((seconds) => {
          set((s) => ({ tracker: { ...s.tracker, today_total_seconds: seconds } }));
        }),
        state.ensureAppIconsLoaded(true),
        state.loadCategories(true),
      ];

      if (state.viewMode === "daily") {
        tasks.push(state.loadHourlyBreakdown(state.selectedDate, true));
        tasks.push(state.loadHourlyCategoryBreakdown(state.selectedDate, true));
      }

      const range = getBreakdownRange(
        state.viewMode,
        state.selectedDate,
        state.customStartDate,
        state.customEndDate,
      );
      if (range) {
        tasks.push(state.loadRangeBreakdown(range.start, range.end, true));
        tasks.push(state.loadRangeCategoryBreakdown(range.start, range.end, true));
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

  setGroupBy: (groupBy: GroupBy) => {
    localStorage.setItem("groupBy", groupBy);
    set({ groupBy });
  },

  loadHourlyBreakdown: async (date: string, force = false) => {
    const state = get();
    if (!force && state.hourlyBreakdownDate === date && state.hourlyBreakdown.length > 0) {
      return;
    }

    const data = await invoke<HourlyAppBreakdown[]>("get_hourly_app_breakdown", { date });
    set({ hourlyBreakdown: data, hourlyBreakdownDate: date });
  },

  loadCategorySummary: async (date: string, force = false) => {
    const state = get();
    if (!force && state.selectedDate === date && state.categorySummary.length > 0) {
      return;
    }
    const data = await api.getCategorySummary(date);
    set({ categorySummary: data });
  },

  loadHourlyCategoryBreakdown: async (date: string, force = false) => {
    const state = get();
    if (!force && state.hourlyCategoryBreakdownDate === date && state.hourlyCategoryBreakdown.length > 0) {
      return;
    }
    const data = await api.getHourlyCategoryBreakdown(date);
    set({ hourlyCategoryBreakdown: data, hourlyCategoryBreakdownDate: date });
  },

  setViewMode: (mode: ViewMode) => {
    const state = get();
    set({ viewMode: mode });
    if (mode === "custom" && (!state.customStartDate || !state.customEndDate)) {
      const today = getTodayString();
      const weekAgo = addDays(today, -6);
      set({ customStartDate: weekAgo, customEndDate: today });
    }
  },

  setCustomRange: (start: string, end: string) => {
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

  loadRangeCategoryBreakdown: async (start: string, end: string, force = false) => {
    const state = get();
    if (
      !force
      && state.rangeCategoryBreakdownRange
      && state.rangeCategoryBreakdownRange.start === start
      && state.rangeCategoryBreakdownRange.end === end
      && state.rangeCategoryBreakdown.length > 0
    ) {
      return;
    }

    const data = await api.getDailyCategoryBreakdown(start, end);
    set({
      rangeCategoryBreakdown: data,
      rangeCategoryBreakdownRange: { start, end },
    });
  },

  loadDailyBreakdown: async (date: string, force = false) => {
    const range = getBreakdownRange("daily", date, null, null);
    if (!range) return;
    await get().loadRangeBreakdown(range.start, range.end, force);
  },

  ensureAppIconsLoaded: async (force = false) => {
    const state = get();
    if (!force && Object.keys(state.appIcons).length > 0 && Object.keys(state.categoryFileIcons).length > 0) {
      return;
    }

    const [icons, names, categoryFileIcons] = await Promise.all([
      api.getAllAppIcons(),
      api.getAppDisplayNames(),
      api.getCategoryFileIcons(),
    ]);

    if (icons && Object.keys(icons).length > 0) {
      set({ appIcons: { ...state.appIcons, ...icons } });
    }
    if (names && Object.keys(names).length > 0) {
      set({ displayNames: { ...state.displayNames, ...names } });
    }
    if (categoryFileIcons) {
      set({ categoryFileIcons });
    }
  },

  loadCategories: async (force = false) => {
    const state = get();
    if (!force && state.categories.length > 0) {
      return;
    }
    const categories = await api.getAllCategories();
    set({ categories });
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
