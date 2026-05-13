import { useEffect } from "react";
import { useStore } from "../stores/useStore";
import { useT } from "../i18n";
import type { Locale } from "../i18n";
import { AppRanking } from "./AppRanking";
import { UsageCharts } from "./UsageCharts";
import { StackedBarChart } from "./StackedBarChart";

function formatDuration(seconds: number, locale: Locale): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (locale === "zh-CN") {
    if (h > 0) return `${h} 小时 ${m} 分钟`;
    if (m > 0) return `${m} 分钟`;
    return `${seconds} 秒`;
  }
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${seconds}s`;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const TABS = [
  { id: "dashboard", key: "tab.dashboard" },
  { id: "breakdown", key: "tab.breakdown" },
] as const;

export function Dashboard() {
  const tracker = useStore((s) => s.tracker);
  const summary = useStore((s) => s.summary);
  const selectedDate = useStore((s) => s.selectedDate);
  const loading = useStore((s) => s.loading);
  const activeTab = useStore((s) => s.activeTab);
  const hourlyBreakdown = useStore((s) => s.hourlyBreakdown);
  const dailyBreakdown = useStore((s) => s.dailyBreakdown);
  const autoStartEnabled = useStore((s) => s.autoStartEnabled);
  const setDate = useStore((s) => s.setDate);
  const refresh = useStore((s) => s.refresh);
  const setActiveTab = useStore((s) => s.setActiveTab);
  const loadHourlyBreakdown = useStore((s) => s.loadHourlyBreakdown);
  const loadDailyBreakdown = useStore((s) => s.loadDailyBreakdown);
  const toggleAutoStart = useStore((s) => s.toggleAutoStart);
  const { t, locale } = useT();

  useEffect(() => {
    if (activeTab === "breakdown") {
      if (hourlyBreakdown.length === 0) {
        loadHourlyBreakdown(selectedDate);
      }
      if (dailyBreakdown.length === 0) {
        loadDailyBreakdown();
      }
    }
  }, [activeTab, hourlyBreakdown.length, dailyBreakdown.length, loadHourlyBreakdown, loadDailyBreakdown, selectedDate]);

  useEffect(() => {
    if (activeTab === "breakdown") {
      loadHourlyBreakdown(selectedDate);
    }
  }, [selectedDate]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Status bar */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span
            className={`h-3 w-3 rounded-full ${
              tracker.is_running ? "bg-green-500" : "bg-red-500"
            }`}
          />
          <span className="text-sm text-slate-400">
            {tracker.is_running ? t("status.tracking") : t("status.stopped")}
          </span>
        </div>
        {tracker.is_afk && (
          <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded">
            {t("status.afk")}
          </span>
        )}
        <div className="text-sm text-slate-400 flex items-center gap-1.5">
          {t("status.current")}:{" "}
          {tracker.current_icon && (
            <img
              src={`data:image/png;base64,${tracker.current_icon}`}
              alt=""
              className="w-4 h-4 rounded-sm"
            />
          )}
          <span className="text-slate-200">
            {tracker.current_app || "—"}
          </span>
          {tracker.current_title && (
            <span className="text-slate-500 ml-1">— {tracker.current_title}</span>
          )}
        </div>

        {/* Auto-start toggle */}
        <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer ml-auto select-none">
          <span>{t("autostart.label")}</span>
          <button
            role="switch"
            aria-checked={autoStartEnabled}
            onClick={toggleAutoStart}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              autoStartEnabled ? "bg-indigo-600" : "bg-slate-700"
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                autoStartEnabled ? "translate-x-4" : "translate-x-1"
              }`}
            />
          </button>
        </label>

        <div className="text-sm text-slate-400">
          {t("status.today")}:{" "}
          <span className="text-slate-200 font-mono">
            {formatTime(tracker.today_total_seconds)}
          </span>
        </div>
      </div>

      {/* Date picker + refresh + date label */}
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setDate(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm text-slate-200"
        />
        <button
          onClick={() => refresh()}
          disabled={loading}
          className="bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors disabled:opacity-50"
        >
          {loading ? t("refresh.loading") : t("refresh")}
        </button>
      </div>

      {/* Tab navigation */}
      <div className="flex border-b border-slate-800">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? "text-indigo-400 border-indigo-500"
                : "text-slate-500 border-transparent hover:text-slate-300"
            }`}
          >
            {t(tab.key)}
          </button>
        ))}
      </div>

      {/* Dashboard tab content */}
      {activeTab === "dashboard" && (
        <>
          {summary && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
                  <div className="text-sm text-slate-400 mb-1">{t("summary.total")}</div>
                  <div className="text-3xl font-bold text-white tabular-nums">
                    {formatDuration(summary.total_seconds, locale)}
                  </div>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
                  <div className="text-sm text-slate-400 mb-1">{t("summary.apps")}</div>
                  <div className="text-3xl font-bold text-white tabular-nums">
                    {summary.apps.length}
                  </div>
                </div>
              </div>

              <UsageCharts
                apps={summary.apps}
                totalSeconds={summary.total_seconds}
                hourly={summary.hourly}
              />

              <AppRanking apps={summary.apps} totalSeconds={summary.total_seconds} />
            </>
          )}

          {!summary && (
            <div className="text-center text-slate-500 py-12">{t("loading")}</div>
          )}
        </>
      )}

      {/* Breakdown tab content */}
      {activeTab === "breakdown" && (
        <StackedBarChart
          hourlyData={hourlyBreakdown}
          dailyData={dailyBreakdown}
        />
      )}
    </div>
  );
}
