import { useState, useRef, useEffect } from "react";
import { api } from "../../stores/useStore";
import { InfoTooltip } from "../shared/InfoTooltip";
import type { ToastTone } from "../shared/ToastStack";

interface IdleThresholdProps {
  t: (key: string) => string;
  pushToast: (tone: ToastTone, message: string) => void;
}

const idlePresets = [
  { seconds: 300, key: "settings.idle.5min" },
  { seconds: 600, key: "settings.idle.10min" },
  { seconds: 900, key: "settings.idle.15min" },
  { seconds: 1800, key: "settings.idle.30min" },
] as const;

export function IdleThreshold({ t, pushToast }: IdleThresholdProps) {
  const [value, setValue] = useState(300);
  const [customOpen, setCustomOpen] = useState(false);
  const [customMinutes, setCustomMinutes] = useState("5");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const raw = await api.getSetting("afk_threshold_seconds");
      if (!raw) return;
      const seconds = parseInt(raw, 10);
      if (Number.isNaN(seconds) || seconds <= 0) return;
      setValue(seconds);
      const matched = idlePresets.find((p) => p.seconds === seconds);
      if (!matched) {
        setCustomOpen(true);
        setCustomMinutes(String(Math.round(seconds / 60)));
      }
    })();
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const save = async (seconds: number) => {
    try {
      await api.setSetting("afk_threshold_seconds", String(seconds));
      setValue(seconds);
      pushToast("success", t("settings.idle.save_success"));
    } catch {
      pushToast("error", t("settings.idle.save_failed"));
    }
  };

  const selectPreset = (seconds: number) => {
    setDropdownOpen(false);
    setCustomOpen(false);
    save(seconds);
  };

  const selectCustom = () => {
    setDropdownOpen(false);
    setCustomOpen(true);
  };

  const saveCustom = () => {
    const minutes = parseInt(customMinutes, 10);
    if (Number.isNaN(minutes) || minutes < 1) return;
    save(minutes * 60);
  };

  const displayLabel = customOpen
    ? `${t("common.custom")} (${Math.round(value / 60)} ${t("settings.idle.minutes")})`
    : t(idlePresets.find((p) => p.seconds === value)?.key ?? "settings.idle.5min");

  return (
    <div className="pt-4 border-t border-slate-100 dark:border-[#3f3f41]">
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-1">
          <svg className="w-4 h-4 text-[#1369eb] dark:text-[#1369eb]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t("settings.idle.title")}</h3>
          <InfoTooltip>{t("settings.idle.desc")}</InfoTooltip>
        </div>
      </div>

      <div ref={dropdownRef} className="relative">
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-1.5 min-w-[170px] justify-between text-sm bg-slate-100 dark:bg-[#1d1d20] border border-slate-200 dark:border-[#3f3f41] rounded-md px-3 py-1.5 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1369eb] cursor-pointer"
        >
          <span>{displayLabel}</span>
          <svg className={`w-3.5 h-3.5 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        {dropdownOpen && (
          <div className="absolute left-0 top-full mt-1 bg-white dark:bg-[#1d1d20] border border-slate-200 dark:border-[#3f3f41] rounded-md shadow-lg p-1 z-10 min-w-[170px]">
            {idlePresets.map((preset) => (
              <button
                key={preset.seconds}
                onClick={() => selectPreset(preset.seconds)}
                className={`block w-full text-left px-3 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg ${
                  value === preset.seconds && !customOpen
                    ? "text-[#ffffff] bg-[#1369eb] dark:text-[#ffffff] dark:bg-[#1369ea] font-medium"
                    : "text-slate-700 dark:text-slate-300"
                }`}
              >
                {t(preset.key)}
              </button>
            ))}
            <div className="border-t border-slate-100 dark:border-[#3f3f41] my-1" />
            <button
              onClick={selectCustom}
              className={`block w-full text-left mt-0.5 px-3 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg ${
                customOpen ? "text-[#ffffff] bg-[#1369eb] dark:text-[#ffffff] dark:bg-[#1369ea] font-medium" : "text-slate-700 dark:text-slate-300"
              }`}
            >
              {t("common.custom")}
            </button>
          </div>
        )}
      </div>

      {customOpen && (
        <div className="mt-3 p-3 rounded-md bg-[#f8fafc] dark:bg-[#1d1d20] border border-[#e2e8f0] dark:border-[#3f3f41] flex items-center gap-2">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={customMinutes}
            onChange={(e) => setCustomMinutes(e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, ""))}
            className="w-16 px-2 py-1.5 rounded border border-[#e2e8f0] dark:border-[#3f3f41] bg-white dark:bg-[#27272b] text-slate-900 dark:text-slate-100 text-sm"
            aria-label={t("common.custom")}
          />
          <span className="text-sm text-slate-700 dark:text-slate-300">{t("settings.idle.minutes")}</span>
          <button
            type="button"
            onClick={saveCustom}
            className="ml-auto px-3 py-1.5 rounded-md text-sm font-medium bg-[#1369eb] hover:bg-[#1369eb] hover:bg-opacity-90 active:bg-[#1369eb] disabled:opacity-60 text-white transition-colors cursor-pointer"
          >
            {t("common.save")}
          </button>
        </div>
      )}
    </div>
  );
}
