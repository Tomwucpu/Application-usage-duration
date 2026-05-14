import { useState, useRef, useEffect } from "react";
import { useStore, api } from "../stores/useStore";
import { useT, type Locale } from "../i18n";

const localeOptions: { value: Locale; labelKey: "settings.language.zh-CN" | "settings.language.en-US" }[] = [
  { value: "zh-CN", labelKey: "settings.language.zh-CN" },
  { value: "en-US", labelKey: "settings.language.en-US" },
];

function parseIgnoredApps(value: string | null): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

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
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 min-w-[100px] justify-between text-sm bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-3 py-1.5 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
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
        <div className="absolute right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-lg py-0.5 z-10 min-w-full">
          {localeOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                setLocale(opt.value);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-1.5 text-sm ${
                locale === opt.value
                  ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10"
                  : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
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
  const [appNames, setAppNames] = useState<string[]>([]);
  const [ignored, setIgnored] = useState<string[]>([]);
  const [ignoredEnabled, setIgnoredEnabled] = useState(false);
  const [retentionMode, setRetentionMode] = useState<"permanent" | "custom">("permanent");
  const [retentionDays, setRetentionDays] = useState<number>(30);

  useEffect(() => {
    (async () => {
      try {
        const names = await api.getAllAppNames();
        setAppNames(names || []);
        const ignoredVal = await api.getSetting("ignored_apps");
        const ignoredList = parseIgnoredApps(ignoredVal);
        setIgnored(ignoredList);

        const ignoredEnabledVal = await api.getSetting("ignored_apps_enabled");
        setIgnoredEnabled(
          ignoredEnabledVal ? ignoredEnabledVal === "true" : ignoredList.length > 0,
        );

        const retention = await api.getSetting("retention_days");
        if (retention) {
          if (retention === "0") {
            setRetentionMode("permanent");
          } else {
            setRetentionMode("custom");
            const d = parseInt(retention, 10);
            if (!Number.isNaN(d)) setRetentionDays(d);
          }
        }
      } catch (e) {
        // ignore
      }
    })();
  }, []);

  // auto-save retention when switching to permanent
  useEffect(() => {
    if (retentionMode === "permanent") {
      // fire-and-forget
      api.setSetting("retention_days", "0");
    }
  }, [retentionMode]);

  const toggleIgnored = async (name: string) => {
    const next = ignored.includes(name) ? ignored.filter((n) => n !== name) : [...ignored, name];
    setIgnored(next);
    await api.setSetting("ignored_apps", JSON.stringify(next));
  };

  const toggleIgnoredEnabled = async () => {
    const next = !ignoredEnabled;
    setIgnoredEnabled(next);
    await api.setSetting("ignored_apps_enabled", String(next));
  };

  const saveRetention = async () => {
    if (retentionMode === "permanent") {
      await api.setSetting("retention_days", "0");
    } else {
      await api.setSetting("retention_days", String(retentionDays));
    }
  };

  const exportJson = async () => {
    const records = await api.getAllRecords();
    const blob = new Blob([JSON.stringify(records, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `usage-export-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const exportCsv = async () => {
    const records = await api.getAllRecords();
    const header = ["id","app_name","app_path","window_title","start_time","end_time","duration_seconds","date","hour"];
    const rows = records.map((r) => header.map((h) => {
      const v = (r as any)[h];
      if (v === null || v === undefined) return "";
      const s = String(v).replace(/"/g, '""');
      return `"${s}"`;
    }).join(","));
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `usage-export-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

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

          {/* Language */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {t("settings.language")}
            </span>
            <LocaleSelect />
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

          {/* Data Export */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t("settings.export.title")}</h3>
            <div className="flex gap-2">
              <button onClick={exportJson} className="px-3 py-1.5 rounded bg-slate-100 dark:bg-slate-800 border">{t("settings.export.json")}</button>
              <button onClick={exportCsv} className="px-3 py-1.5 rounded bg-slate-100 dark:bg-slate-800 border">{t("settings.export.csv")}</button>
            </div>
          </div>

          {/* Retention */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t("settings.retention.title")}</h3>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input type="radio" name="retention" checked={retentionMode === "permanent"} onChange={() => setRetentionMode("permanent")} />
                <span className="ml-1">{t("settings.retention.permanent")}</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="retention" checked={retentionMode === "custom"} onChange={() => setRetentionMode("custom")} />
                <span className="ml-1">{t("settings.retention.custom")}</span>
              </label>
              {retentionMode === "custom" && (
                <div className="flex items-center gap-2">
                  <input type="number" min={1} value={retentionDays} onChange={(e) => setRetentionDays(Number(e.target.value))} className="w-24 px-2 py-1 border rounded" aria-label={t("settings.retention.custom")} />
                  <button type="button" onClick={saveRetention} className="px-3 py-1.5 rounded bg-slate-100 dark:bg-slate-800 border hover:bg-indigo-50 dark:hover:bg-indigo-500/10">{t("settings.retention.save")}</button>
                </div>
              )}
            </div>
          </div>

          {/* Ignored apps */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">{t("settings.ignored.title")}</h3>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600 dark:text-slate-400">
                {t("settings.ignored.enabled")}
              </span>
              <button
                role="switch"
                aria-checked={ignoredEnabled}
                onClick={toggleIgnoredEnabled}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  ignoredEnabled ? "bg-indigo-600" : "bg-slate-300 dark:bg-slate-700"
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                    ignoredEnabled ? "translate-x-4" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
            {ignoredEnabled && (
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-auto mt-3">
                {appNames.map((n) => (
                  <label key={n} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-50 dark:hover:bg-slate-700">
                    <input type="checkbox" checked={ignored.includes(n)} onChange={() => toggleIgnored(n)} aria-label={`Ignore ${n}`} />
                    <span className="text-sm ml-1">{n}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
