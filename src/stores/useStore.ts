import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { enable, isEnabled, disable } from "@tauri-apps/plugin-autostart";
import type { DailySummary, TrackerState, HourlyAppBreakdown, DailyAppBreakdown, UsageRecord } from "../types";

export const api = {
  getSetting: (key: string) => invoke<string | null>("get_setting", { key }),
  setSetting: (key: string, value: string) => invoke<void>("set_setting", { key, value }),
  getAllAppNames: () => invoke<string[]>("get_all_app_names"),
  getAllAppIcons: () => invoke<Record<string, string>>("get_all_app_icons"),
  getAllRecords: () => invoke<UsageRecord[]>("get_all_records"),
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
  dailyBreakdown: DailyAppBreakdown[];
  autoStartEnabled: boolean;
  init: () => Promise<() => void>;
  setDate: (date: string) => Promise<void>;
  refresh: () => Promise<void>;
  setActiveTab: (tab: TabId) => void;
  setTheme: (theme: Theme) => void;
  loadHourlyBreakdown: (date: string) => Promise<void>;
  loadDailyBreakdown: () => Promise<void>;
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
  dailyBreakdown: [],
  autoStartEnabled: false,

  init: async () => {
    // Apply theme on load
    const currentTheme = get().theme;
    if (currentTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    const unlisten = await listen<TrackerState>("tracker-state", (event) => {
      set({ tracker: event.payload });
    });

    await invoke("start_tracking");

    const summary = await invoke<DailySummary>("get_daily_summary", {
      date: get().selectedDate,
    });
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
    const summary = await invoke<DailySummary>("get_daily_summary", { date });
    set({ summary });
  },

  refresh: async () => {
    set({ loading: true });
    const summary = await invoke<DailySummary>("get_daily_summary", {
      date: get().selectedDate,
    });
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

  loadHourlyBreakdown: async (date: string) => {
    const data = await invoke<HourlyAppBreakdown[]>(
      "get_hourly_app_breakdown",
      { date },
    );
    set({ hourlyBreakdown: data });
  },

  loadDailyBreakdown: async () => {
    const { start, end } = getLast7Days();
    const data = await invoke<DailyAppBreakdown[]>(
      "get_daily_app_breakdown",
      { startDate: start, endDate: end },
    );
    set({ dailyBreakdown: data });
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
