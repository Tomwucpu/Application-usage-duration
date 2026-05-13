import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { enable, isEnabled, disable } from "@tauri-apps/plugin-autostart";
import type { DailySummary, TrackerState, HourlyAppBreakdown, DailyAppBreakdown } from "../types";

type TabId = "dashboard" | "breakdown";

interface Store {
  tracker: TrackerState;
  summary: DailySummary | null;
  selectedDate: string;
  loading: boolean;
  activeTab: TabId;
  hourlyBreakdown: HourlyAppBreakdown[];
  dailyBreakdown: DailyAppBreakdown[];
  autoStartEnabled: boolean;
  init: () => Promise<void>;
  setDate: (date: string) => Promise<void>;
  refresh: () => Promise<void>;
  setActiveTab: (tab: TabId) => void;
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
  hourlyBreakdown: [],
  dailyBreakdown: [],
  autoStartEnabled: false,

  init: async () => {
    await invoke("start_tracking");

    await listen<TrackerState>("tracker-state", (event) => {
      set({ tracker: event.payload });
    });

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
