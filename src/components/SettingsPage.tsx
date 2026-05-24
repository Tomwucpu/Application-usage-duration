import { useState, useRef, useEffect } from "react";
import { useStore } from "../stores/useStore";
import { useT } from "../i18n";
import { ToastStack, type ToastMessage, type ToastTone } from "./shared/ToastStack";
import { UpdateChecker } from "./settings/UpdateChecker";
import { IdleThreshold } from "./settings/IdleThreshold";
import { IgnoredApps } from "./settings/IgnoredApps";
import { DataIO } from "./settings/DataIO";
import { Retention } from "./settings/Retention";
import { LanguageSelect } from "./settings/LanguageSelect";
import { Switch } from "./shared/Switch";

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
    <div className="">
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
            <LanguageSelect />
          </div>

          {/* AutoStart */}
          <div className="flex items-center justify-between h-[36px]">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {t("autostart.label")}
            </span>
            <Switch
              checked={autoStartEnabled}
              onChange={toggleAutoStart}
              ariaLabel={t("autostart.label")}
            />
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
