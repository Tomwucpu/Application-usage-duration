import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { enable, isEnabled, disable } from "@tauri-apps/plugin-autostart";
import type { DailySummary, TrackerState, HourlyAppBreakdown, DailyAppBreakdown, UsageRecord } from "../types";

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
  appIcons: Record<string, string>;
  autoStartEnabled: boolean;
  init: () => Promise<() => void>;
  setDate: (date: string) => Promise<void>;
  refresh: () => Promise<void>;
  setActiveTab: (tab: TabId) => void;
  setTheme: (theme: Theme) => void;
  loadHourlyBreakdown: (date: string, force?: boolean) => Promise<void>;
  loadDailyBreakdown: (force?: boolean) => Promise<void>;
  ensureAppIconsLoaded: (force?: boolean) => Promise<void>;
  checkAutoStart: () => Promise<void>;
  toggleAutoStart: () => Promise<void>;
}

function getLast7Days(): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 6);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(end) };
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
  appIcons: {},
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
    const [summary] = await Promise.all([
      invoke<DailySummary>("get_daily_summary", { date: get().selectedDate }),
      get().ensureAppIconsLoaded(),
    ]);
    set({ summary, loading: false });
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
  },

  loadHourlyBreakdown: async (date: string, force = false) => {
    const state = get();
    if (!force && state.hourlyBreakdownDate === date && state.hourlyBreakdown.length > 0) {
      return;
    }

    const [data] = await Promise.all([
      invoke<HourlyAppBreakdown[]>("get_hourly_app_breakdown", { date }),
      get().ensureAppIconsLoaded(),
    ]);
    set({ hourlyBreakdown: data, hourlyBreakdownDate: date });
  },

  loadDailyBreakdown: async (force = false) => {
    const { start, end } = getLast7Days();
    const state = get();
    if (
      !force
      && state.dailyBreakdownRange
      && state.dailyBreakdownRange.start === start
      && state.dailyBreakdownRange.end === end
      && state.dailyBreakdown.length > 0
    ) {
      return;
    }

    const [data] = await Promise.all([
      invoke<DailyAppBreakdown[]>("get_daily_app_breakdown", { startDate: start, endDate: end }),
      get().ensureAppIconsLoaded(),
    ]);
    set({ dailyBreakdown: data, dailyBreakdownRange: { start, end } });
  },

  ensureAppIconsLoaded: async (force = false) => {
    const state = get();
    if (!force && Object.keys(state.appIcons).length > 0) {
      return;
    }

    const icons = await api.getAllAppIcons();
    if (icons && Object.keys(icons).length > 0) {
      set({ appIcons: { ...state.appIcons, ...icons } });
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
