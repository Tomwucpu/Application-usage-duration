import { useStore } from "../stores/useStore";
import { useT } from "../i18n";

export function SettingsPage() {
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const autoStartEnabled = useStore((s) => s.autoStartEnabled);
  const toggleAutoStart = useStore((s) => s.toggleAutoStart);
  const { t } = useT();

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 shadow-sm dark:shadow-none">
        <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-6">{t("settings.title")}</h2>

        <div className="space-y-6">
          {/* Theme */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {t("settings.theme")}
            </span>
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-md">
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

          {/* AutoStart */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {t("autostart.label")}
            </span>
            <button
              role="switch"
              aria-checked={autoStartEnabled}
              onClick={toggleAutoStart}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                autoStartEnabled ? "bg-indigo-600" : "bg-slate-300 dark:bg-slate-700"
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                  autoStartEnabled ? "translate-x-4" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
