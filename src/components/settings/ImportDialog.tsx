import { useState, useCallback } from "react";
import type { ImportRecord, ImportPreview } from "../../types";
import { api, useStore } from "../../stores/useStore";
import { generatePreview, filterValidRecords } from "../../utils/importUtils";
import type { ToastTone } from "../shared/ToastStack";

interface ImportDialogProps {
  records: ImportRecord[];
  onClose: () => void;
  pushToast: (tone: ToastTone, message: string) => void;
  t: (key: string) => string;
}

type Step = "preview" | "importing" | "results";

function interpolate(
  template: string,
  vars: Record<string, string | number>,
): string {
  let result = template;
  for (const [k, v] of Object.entries(vars)) {
    result = result.replace(`{{${k}}}`, String(v));
  }
  return result;
}

export function ImportDialog({ records, onClose, pushToast, t }: ImportDialogProps) {
  const preview: ImportPreview = generatePreview(records);
  const [step, setStep] = useState<Step>("preview");
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState<{
    imported: number;
    skipped: number;
  } | null>(null);

  const validRecords = filterValidRecords(records);
  const errorCount = records.length - validRecords.length;

  const handleImport = useCallback(async () => {
    setStep("importing");

    const PAGE_SIZE = 500;
    const total = validRecords.length;
    setProgress({ current: 0, total });

    let imported = 0;
    let skipped = errorCount;

    try {
      for (let offset = 0; offset < total; offset += PAGE_SIZE) {
        const chunk = validRecords.slice(offset, offset + PAGE_SIZE);
        const result = await api.importRecordsBatch(chunk);
        imported += result.imported;
        skipped += result.skipped;
        setProgress({
          current: Math.min(offset + PAGE_SIZE, total),
          total,
        });
      }
      setResults({ imported, skipped });
      setStep("results");
      useStore.getState().ensureAppIconsLoaded(
        [...new Set(validRecords.map((record) => record.app_name))],
        true,
      );
    } catch {
      pushToast("error", t("settings.import.failed"));
      onClose();
    }
  }, [validRecords, errorCount, pushToast, t, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
        <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-4">
          {t("settings.import.dialog.title")}
        </h3>

        {step === "preview" && (
          <>
            <div className="space-y-2 mb-6">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {interpolate(t("settings.import.preview.records"), {
                  count: preview.totalRecords,
                })}
              </p>
              {preview.dateRange && (
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {interpolate(t("settings.import.preview.dateRange"), {
                    start: preview.dateRange.earliest,
                    end: preview.dateRange.latest,
                  })}
                </p>
              )}
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {interpolate(t("settings.import.preview.apps"), {
                  count: preview.uniqueApps,
                })}
              </p>
              {preview.errors.length > 0 && (
                <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded">
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">
                    {interpolate(t("settings.import.preview.errors"), {
                      count:
                        preview.errors.length >= 10
                          ? `${preview.errors.length}+`
                          : preview.errors.length,
                    })}
                  </p>
                  <ul className="text-xs text-amber-600 dark:text-amber-500 space-y-0.5">
                    {preview.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-md text-sm font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 transition-colors"
              >
                {t("settings.import.cancel")}
              </button>
              <button
                onClick={() => void handleImport()}
                disabled={validRecords.length === 0}
                className="px-4 py-2 rounded-md text-sm font-medium bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-60 text-white transition-colors"
              >
                {interpolate(t("settings.import.preview.records"), {
                  count: validRecords.length,
                })}
              </button>
            </div>
          </>
        )}

        {step === "importing" && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {t("settings.import.importing")}
            </p>
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
              <div
                className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
                style={{
                  width:
                    progress.total > 0
                      ? `${Math.round(
                          (progress.current / progress.total) * 100,
                        )}%`
                      : "0%",
                }}
              />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
              {interpolate(t("settings.import.progress"), {
                current: progress.current,
                total: progress.total,
              })}
            </p>
          </div>
        )}

        {step === "results" && results && (
          <>
            <div className="space-y-2 mb-6">
              <p className="text-sm text-green-600 dark:text-green-400">
                {interpolate(t("settings.import.result.success"), {
                  imported: results.imported,
                })}
              </p>
              {results.skipped > 0 && (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {interpolate(t("settings.import.result.skipped"), {
                    skipped: results.skipped,
                  })}
                </p>
              )}
            </div>
            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-md text-sm font-medium bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white transition-colors"
              >
                {t("settings.import.close")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
