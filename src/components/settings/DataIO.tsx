import { useState } from "react";
import { api } from "../../stores/useStore";
import type { ToastTone } from "../shared/ToastStack";
import {
  buildCsvHeader,
  buildCsvRow,
  getExportFileName,
  type ExportFormat,
} from "../../utils/exportUtils";
import { ImportDialog } from "./ImportDialog";
import { parseImportFile } from "../../utils/importUtils";
import type { ImportRecord } from "../../types";

interface DataIOProps {
  t: (key: string) => string;
  pushToast: (tone: ToastTone, message: string) => void;
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

export function DataIO({ t, pushToast }: DataIOProps) {
  const [importRecords, setImportRecords] = useState<ImportRecord[] | null>(null);

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

  return (
    <>
      {/* Data Export */}
      <div className="pt-4 border-t border-slate-100 dark:border-[#3f3f41]">
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-4 h-4 text-[#1369eb] dark:text-[#1369eb]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
            className="flex-1 px-4 py-2.5 rounded-md bg-slate-100 dark:bg-[#1170ff] hover:bg-slate-200 dark:hover:bg-[#1369eb] active:bg-slate-300 dark:active:bg-slate-600 text-slate-900 dark:text-slate-100 font-medium text-sm transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
          >
            {t("settings.export.csv")}
          </button>
          <button
            onClick={() => void handleExport("json")}
            className="flex-1 px-4 py-2.5 rounded-md bg-slate-100 dark:bg-[#1170ff] hover:bg-slate-200 dark:hover:bg-[#1369eb] active:bg-slate-300 dark:active:bg-slate-600 text-slate-900 dark:text-slate-100 font-medium text-sm transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
          >
            {t("settings.export.json")}
          </button>
        </div>
      </div>

      {/* Data Import */}
      <div className="pt-4 border-t border-slate-100 dark:border-[#3f3f41]">
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-4 h-4 text-[#1369eb] dark:text-[#1369eb]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t("settings.import.title")}</h3>
          </div>
        </div>
        <button
          onClick={() => void handleImport()}
          className="px-4 py-2.5 rounded-md bg-slate-100 dark:bg-[#1170ff] hover:bg-slate-200 dark:hover:bg-[#1369eb] active:bg-slate-300 dark:active:bg-slate-600 text-slate-900 dark:text-slate-100 font-medium text-sm transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
        >
          {t("settings.import.button")}
        </button>
      </div>

      {importRecords && (
        <ImportDialog
          records={importRecords}
          onClose={() => setImportRecords(null)}
          pushToast={pushToast}
          t={t}
        />
      )}
    </>
  );
}
