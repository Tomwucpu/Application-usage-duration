import { useState, useEffect } from "react";
import { api } from "../../stores/useStore";
import type { ToastTone } from "../shared/ToastStack";

interface RetentionProps {
  t: (key: string) => string;
  pushToast: (tone: ToastTone, message: string) => void;
}

export function Retention({ t, pushToast }: RetentionProps) {
  const [retentionMode, setRetentionMode] = useState<"permanent" | "custom">("permanent");
  const [retentionDays, setRetentionDays] = useState<number>(30);

  useEffect(() => {
    (async () => {
      try {
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
      } catch {
        // ignore
      }
    })();
  }, []);

  const handleModeChange = (mode: "permanent" | "custom") => {
    setRetentionMode(mode);
    if (mode === "permanent") {
      api.setSetting("retention_days", "0");
    }
  };

  const saveRetention = async () => {
    try {
      if (retentionMode === "permanent") {
        await api.setSetting("retention_days", "0");
      } else {
        await api.setSetting("retention_days", String(retentionDays));
      }
      pushToast("success", t("settings.retention.save_success"));
    } catch {
      pushToast("error", t("settings.retention.save_failed"));
    }
  };

  return (
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
          <input type="radio" name="retention" checked={retentionMode === "permanent"} onChange={() => handleModeChange("permanent")} />
          <div className="flex-1">
            <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{t("settings.retention.permanent")}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{t("settings.retention.permanent.desc")}</div>
          </div>
        </label>
        <label className="flex items-center gap-3 p-3 rounded-md bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors">
          <input type="radio" name="retention" checked={retentionMode === "custom"} onChange={() => handleModeChange("custom")} />
          <div className="flex-1">
            <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{t("settings.retention.custom")}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{t("settings.retention.custom.desc")}</div>
          </div>
        </label>
        {retentionMode === "custom" && (
          <div className="mt-3 p-3 rounded-md bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 flex items-center gap-2">
            <span className="text-sm text-indigo-900 dark:text-indigo-300">{t("settings.retention.keep")}</span>
            <input type="text" inputMode="numeric" pattern="[0-9]*" value={retentionDays} onChange={(e) => { const v = e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, ""); setRetentionDays(v ? Number(v) : 0); }} className="w-16 px-2 py-1.5 rounded border border-indigo-300 dark:border-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm" aria-label={t("settings.retention.custom")} />
            <span className="text-sm text-indigo-900 dark:text-indigo-300">{t("settings.retention.days")}</span>
            <button type="button" onClick={saveRetention} className="ml-auto px-3 py-1.5 rounded-md text-sm font-medium bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white transition-colors cursor-pointer">{t("settings.retention.save")}</button>
          </div>
        )}
      </div>
    </div>
  );
}
