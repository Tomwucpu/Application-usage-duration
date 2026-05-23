import { useState, useRef, useEffect } from "react";
import { useStore } from "../stores/useStore";
import { useT, type Locale } from "../i18n";
import { ToastStack, type ToastMessage, type ToastTone } from "./shared/ToastStack";
import { UpdateChecker } from "./settings/UpdateChecker";
import { IdleThreshold } from "./settings/IdleThreshold";
import { IgnoredApps } from "./settings/IgnoredApps";
import { DataIO } from "./settings/DataIO";
import { Retention } from "./settings/Retention";

const localeOptions: { value: Locale; labelKey: "settings.language.zh-CN" | "settings.language.en-US" }[] = [
  { value: "zh-CN", labelKey: "settings.language.zh-CN" },
  { value: "en-US", labelKey: "settings.language.en-US" },
];

function LocaleSelect() {
  const { t, locale, setLocale } = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selected = localeOptions.find((o) => o.value === locale)!;

  return (
    // 下拉菜单组件
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 min-w-[100px] justify-between text-sm bg-slate-100 dark:bg-[#1d1d20] border border-slate-200 dark:border-[#3f3f41] rounded-md px-3 py-1.5 text-[#0f172a] dark:text-[#ffffff] dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1369ea] cursor-pointer"
      >
        <span>{t(selected.labelKey)}</span>
        <svg
          className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 p-1 bg-[#f1f5f9] dark:bg-[#1d1d20] border border-slate-200 dark:border-[#3f3f41] rounded-md shadow-lg z-10 min-w-full">
          {localeOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                setLocale(opt.value);
                setOpen(false);
              }}
              className={`w-full text-left mb-0.5 px-3 py-1.5 text-sm rounded-lg ${
                locale === opt.value
                  ? "text-[#ffffff] dark:text-[#ffffff] bg-[#1369ea] dark:bg-[#1369ea]"
                  : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#262c36]"
              }`}
            >
              {t(opt.labelKey)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function SettingsPage() {
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const autoStartEnabled = useStore((s) => s.autoStartEnabled);
  const toggleAutoStart = useStore((s) => s.toggleAutoStart);
  const { t } = useT();
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toastTimerRef = useRef<number[]>([]);
  const toastIdRef = useRef(0);
  useEffect(() => {
    return () => {
      toastTimerRef.current.forEach((timerId) => window.clearTimeout(timerId));
      toastTimerRef.current = [];
    };
  }, []);

  const removeToast = (id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  };

  const pushToast = (tone: ToastTone, message: string) => {
    const id = toastIdRef.current + 1;
    toastIdRef.current = id;

    setToasts((current) => [...current, { id, tone, message }]);

    const timerId = window.setTimeout(() => {
      removeToast(id);
      toastTimerRef.current = toastTimerRef.current.filter((existingId) => existingId !== timerId);
    }, 2800);

    toastTimerRef.current.push(timerId);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <ToastStack messages={toasts} onClose={removeToast} />
      <div className="bg-white dark:bg-[#27272b] border border-slate-200 dark:border-[#3f3f41] rounded-lg p-6 shadow-sm dark:shadow-none">
        <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-6">{t("settings.title")}</h2>

        <div className="space-y-6">
          {/* Theme */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {t("settings.theme")}
            </span>
            <div className="flex bg-slate-100 dark:bg-[#1d1d20] border border-slate-200 dark:border-[#3f3f41] p-1 rounded-md">
              <button
                className={`px-3 py-1 text-sm rounded ${theme === "light" ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white" : "text-slate-500 dark:text-slate-400"}`}
                onClick={() => setTheme("light")}
              >
                {t("settings.theme.light")}
              </button>
              <button
                className={`px-3 py-1 text-sm rounded ${theme === "dark" ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white" : "text-slate-500 dark:text-slate-400"}`}
                onClick={() => setTheme("dark")}
              >
                {t("settings.theme.dark")}
              </button>
            </div>
          </div>

          {/* Language */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {t("settings.language")}
            </span>
            <LocaleSelect />
          </div>

          {/* AutoStart */}
          <div className="flex items-center justify-between h-[36px]">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {t("autostart.label")}
            </span>
            <button
              role="switch"
              aria-checked={autoStartEnabled}
              onClick={toggleAutoStart}
              className={`relative inline-flex h-5 w-[38px] items-center rounded-full transition-colors ${
                autoStartEnabled ? "bg-[#1170ff]" : "bg-slate-300 dark:bg-slate-700"
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                  autoStartEnabled ? "translate-x-5" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Auto Update */}
          <UpdateChecker t={t as (key: string) => string} pushToast={pushToast} />

          {/* Data Export & Import */}
          <DataIO t={t as (key: string) => string} pushToast={pushToast} />

          {/* Idle Threshold */}
          <IdleThreshold t={t as (key: string) => string} pushToast={pushToast} />

          {/* Retention */}
          <Retention t={t as (key: string) => string} pushToast={pushToast} />

          {/* Ignored apps */}
          <IgnoredApps t={t as (key: string) => string} />
        </div>
      </div>
    </div>
  );
}
