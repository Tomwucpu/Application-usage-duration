import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { DailySummary, TrackerState } from "../types";

interface Store {
  tracker: TrackerState;
  summary: DailySummary | null;
  selectedDate: string;
  loading: boolean;
  init: () => Promise<void>;
  setDate: (date: string) => Promise<void>;
  refresh: () => Promise<void>;
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

  init: async () => {
    await invoke("start_tracking");

    await listen<TrackerState>("tracker-state", (event) => {
      set({ tracker: event.payload });
    });

    const summary = await invoke<DailySummary>("get_daily_summary", {
      date: get().selectedDate,
    });
    set({ summary });
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
}));
