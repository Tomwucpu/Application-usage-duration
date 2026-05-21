import { useState, useRef, useEffect } from "react";
import { useStore, api } from "../stores/useStore";
import { check } from "@tauri-apps/plugin-updater";
import { useT, type Locale } from "../i18n";
import { ToastStack, type ToastMessage, type ToastTone } from "./shared/ToastStack";
import {
  buildCsvHeader,
  buildCsvRow,
  getExportFileName,
  type ExportFormat,
} from "../utils/exportUtils";
import { ImportDialog } from "./settings/ImportDialog";
import { parseImportFile } from "../utils/importUtils";
import type { ImportRecord } from "../types";

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

type WindowWithSaveFilePicker = Window & {
  showSaveFilePicker?: (
    options?: {
      suggestedName?: string;
      types?: Array<{
        description?: string;
        accept: Record<string, string[]>;
      }>;
    },
  ) => Promise<FileSystemFileHandle>;
}

type WindowWithOpenFilePicker = Window & {
  showOpenFilePicker?: (
    options?: {
      types?: Array<{
        description?: string;
        accept: Record<string, string[]>;
      }>;
      multiple?: boolean;
    },
  ) => Promise<FileSystemFileHandle[]>;
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
  const appIcons = useStore((s) => s.appIcons);
  const ensureAppIconsLoaded = useStore((s) => s.ensureAppIconsLoaded);
  const { t } = useT();
  const [appNames, setAppNames] = useState<string[]>([]);
  const [ignored, setIgnored] = useState<string[]>([]);
  const [ignoredEnabled, setIgnoredEnabled] = useState(false);
  const [retentionMode, setRetentionMode] = useState<"permanent" | "custom">("permanent");
  const [retentionDays, setRetentionDays] = useState<number>(30);
  const [updating, setUpdating] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<string>("");
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toastTimerRef = useRef<number[]>([]);
  const toastIdRef = useRef(0);
  const [importRecords, setImportRecords] = useState<ImportRecord[] | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const names = await api.getAllAppNames();
        setAppNames(names || []);
        await ensureAppIconsLoaded();
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
  }, [ensureAppIconsLoaded]);

  useEffect(() => {
    return () => {
      toastTimerRef.current.forEach((timerId) => window.clearTimeout(timerId));
      toastTimerRef.current = [];
    };
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
    try {
      if (retentionMode === "permanent") {
        await api.setSetting("retention_days", "0");
      } else {
        await api.setSetting("retention_days", String(retentionDays));
      }
      pushToast("success", t("settings.retention.save_success"));
    } catch (e) {
      pushToast("error", t("settings.retention.save_failed"));
    }
  };

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

  const handleExport = async (format: ExportFormat) => {
    const pickerWindow = window as WindowWithSaveFilePicker;

    if (typeof pickerWindow.showSaveFilePicker !== "function") {
      pushToast("error", t("settings.export.unsupported"));
      return;
    }

    try {
      const startDate = "2020-01-01";
      const now = new Date();
      const endDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

      const handle = await pickerWindow.showSaveFilePicker({
        suggestedName: getExportFileName(format),
        types: [
          {
            description: format === "csv" ? "CSV Files" : "JSON Files",
            accept:
              format === "csv"
                ? { "text/csv": [".csv"] }
                : { "application/json": [".json"] },
          },
        ],
      });
      const writable = await handle.createWritable();

      const PAGE_SIZE = 500;
      let offset = 0;
      let isFirstChunk = true;

      if (format === "csv") {
        await writable.write(buildCsvHeader() + "\n");
      } else {
        await writable.write("[\n");
      }

      const totalCount = await api.getRecordCount(startDate, endDate);

      for (;;) {
        const records = await api.getRecordsRange(startDate, endDate, offset, PAGE_SIZE);
        if (records.length === 0) break;

        if (format === "csv") {
          const chunk = records
            .map((r) => buildCsvRow(r))
            .join("\n");
          await writable.write(chunk + (offset + records.length < totalCount ? "\n" : ""));
        } else {
          const prefix = isFirstChunk ? "  " : ",\n  ";
          const chunk = records
            .map((r) => JSON.stringify(r))
            .join(",\n  ");
          await writable.write(prefix + chunk);
          isFirstChunk = false;
        }

        offset += PAGE_SIZE;
        if (offset >= totalCount) break;
      }

      if (format === "json") {
        await writable.write("\n]\n");
      }

      await writable.close();
      pushToast("success", t("settings.export.success"));
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        pushToast("info", t("settings.export.cancelled"));
        return;
      }

      pushToast("error", t("settings.export.failed"));
    }
  };

  const handleImport = async () => {
    const pickerWindow = window as WindowWithOpenFilePicker;

    if (typeof pickerWindow.showOpenFilePicker !== "function") {
      pushToast("error", t("settings.import.unsupported"));
      return;
    }

    try {
      const [handle] = await pickerWindow.showOpenFilePicker({
        types: [
          {
            description: "CSV or JSON",
            accept: {
              "text/csv": [".csv"],
              "application/json": [".json"],
            },
          },
        ],
        multiple: false,
      });

      if (!handle) {
        pushToast("info", t("settings.import.cancelled"));
        return;
      }

      const file = await handle.getFile();
      const result = await parseImportFile(file);
      if (!result.ok) {
        pushToast("error", `${t("settings.import.failed")} ${result.error}`);
        return;
      }

      setImportRecords(result.records);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        pushToast("info", t("settings.import.cancelled"));
        return;
      }
      pushToast("error", t("settings.import.failed"));
    }
  };

  const handleCheckUpdates = async () => {
    setUpdating(true);
    setUpdateStatus(t("settings.update.checking"));

    try {
      const update = await check();
      if (!update) {
        setUpdateStatus(t("settings.update.latest"));
        return;
      }

      const version = (update as { version?: string }).version || "";
      setUpdateStatus(
        version
          ? `${t("settings.update.available")} ${version}`
          : t("settings.update.available"),
      );

      await update.downloadAndInstall();
      setUpdateStatus(t("settings.update.installed"));
      pushToast("info", t("settings.update.restart_hint"));
    } catch {
      setUpdateStatus(t("settings.update.failed"));
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <ToastStack messages={toasts} onClose={removeToast} />
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
          <div className="flex items-center justify-between h-[36px]">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {t("autostart.label")}
            </span>
            <button
              role="switch"
              aria-checked={autoStartEnabled}
              onClick={toggleAutoStart}
              className={`relative inline-flex h-5 w-[38px] items-center rounded-full transition-colors ${
                autoStartEnabled ? "bg-indigo-600" : "bg-slate-300 dark:bg-slate-700"
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
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {t("settings.update.title")}
              </span>
              <button
                onClick={() => void handleCheckUpdates()}
                disabled={updating}
                className="px-3 py-1.5 rounded-md text-sm font-medium bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-60 text-white transition-colors"
              >
                {updating ? t("settings.update.checking") : t("settings.update.action")}
              </button>
            </div>
            {updateStatus && (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{updateStatus}</p>
            )}
          </div>

          {/* Data Export */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-4 h-4 text-indigo-600 dark:text-indigo-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t("settings.export.title")}</h3>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => void handleExport("csv")}
                className="flex-1 px-4 py-2.5 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 active:bg-slate-300 dark:active:bg-slate-600 text-slate-900 dark:text-slate-100 font-medium text-sm transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
              >
                {t("settings.export.csv")}
              </button>
              <button
                onClick={() => void handleExport("json")}
                className="flex-1 px-4 py-2.5 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 active:bg-slate-300 dark:active:bg-slate-600 text-slate-900 dark:text-slate-100 font-medium text-sm transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
              >
                {t("settings.export.json")}
              </button>
            </div>
          </div>

          {/* Data Import */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-4 h-4 text-indigo-600 dark:text-indigo-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t("settings.import.title")}</h3>
              </div>
            </div>
            <button
              onClick={() => void handleImport()}
              className="px-4 py-2.5 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 active:bg-slate-300 dark:active:bg-slate-600 text-slate-900 dark:text-slate-100 font-medium text-sm transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
            >
              {t("settings.import.button")}
            </button>
          </div>

          {/* Retention */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-4 h-4 text-indigo-600 dark:text-indigo-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                  <polyline points="17 21 17 13 7 13 7 21" />
                  <polyline points="7 5 7 13 17 13" />
                </svg>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t("settings.retention.title")}</h3>
              </div>
            </div>
            <div className="space-y-3">
              <label className="flex items-center gap-3 p-3 rounded-md bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors">
                <input type="radio" name="retention" checked={retentionMode === "permanent"} onChange={() => setRetentionMode("permanent")} />
                <div className="flex-1">
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{t("settings.retention.permanent")}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{t("settings.retention.permanent.desc")}</div>
                </div>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-md bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors">
                <input type="radio" name="retention" checked={retentionMode === "custom"} onChange={() => setRetentionMode("custom")} />
                <div className="flex-1">
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{t("settings.retention.custom")}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{t("settings.retention.custom.desc")}</div>
                </div>
              </label>
              {retentionMode === "custom" && (
                <div className="mt-3 p-3 rounded-md bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 flex items-center gap-2">
                  <span className="text-sm text-indigo-900 dark:text-indigo-300">{t("settings.retention.keep")}</span>
                  <input type="number" min={1} value={retentionDays} onChange={(e) => setRetentionDays(Number(e.target.value))} className="w-16 px-2 py-1.5 rounded border border-indigo-300 dark:border-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm" aria-label={t("settings.retention.custom")} />
                  <span className="text-sm text-indigo-900 dark:text-indigo-300">{t("settings.retention.days")}</span>
                  <button type="button" onClick={saveRetention} className="ml-auto px-3 py-1.5 rounded-md text-sm font-medium bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white transition-colors cursor-pointer">{t("settings.retention.save")}</button>
                </div>
              )}
            </div>
          </div>

          {/* Ignored apps */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">{t("settings.ignored.title")}</h3>
              <button
                role="switch"
                aria-checked={ignoredEnabled}
                onClick={toggleIgnoredEnabled}
                className={`relative inline-flex h-5 w-[38px] items-center rounded-full transition-colors ${
                  ignoredEnabled ? "bg-indigo-600" : "bg-slate-300 dark:bg-slate-700"
                }`}
                aria-label={t("settings.ignored.title")}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                    ignoredEnabled ? "translate-x-5" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
            <div
              className={`grid grid-cols-2 gap-2 overflow-hidden transition-[max-height,opacity,transform] duration-300 ease-in-out ${
                ignoredEnabled
                  ? "mt-3 opacity-100 translate-y-0 pointer-events-auto"
                  : "max-h-0 opacity-0 -translate-y-1 pointer-events-none"
              }`}
            >
              {appNames.map((n) => (
                <label
                  key={n}
                  className="flex items-center gap-4 rounded px-2 py-1 transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  <input
                    type="checkbox"
                    checked={ignored.includes(n)}
                    onChange={() => toggleIgnored(n)}
                    aria-label={`Ignore ${n}`}
                  />
                  {appIcons[n] ? (
                    <img src={`data:image/png;base64,${appIcons[n]}`} alt={n} className="w-5 h-5 rounded-md mt-0.5 flex-shrink-0" />
                  ) : (
                    <div className="w-5 h-5 rounded-md flex-shrink-0 bg-slate-700 flex items-center justify-center text-[10px] text-slate-400 font-bold">
                      {n.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="text-sm">{n}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
      {importRecords && (
        <ImportDialog
          records={importRecords}
          onClose={() => setImportRecords(null)}
          pushToast={pushToast}
          t={t as (key: string) => string}
        />
      )}
    </div>
  );
}
