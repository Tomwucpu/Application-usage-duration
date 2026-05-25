import { useState, useEffect, useRef } from "react";
import { useStore, api } from "../../stores/useStore";
import { useT } from "../../i18n";
import { ToastStack, type ToastMessage, type ToastTone } from "../shared/ToastStack";
import { AppTable } from "./AppTable";
import type { AppMetadataItem } from "../../types";

export function AppManagement() {
  const { t } = useT();
  const appIcons = useStore((s) => s.appIcons);
  const categories = useStore((s) => s.categories);
  const ensureAppIconsLoaded = useStore((s) => s.ensureAppIconsLoaded);
  const loadCategories = useStore((s) => s.loadCategories);
  const [data, setData] = useState<AppMetadataItem[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [search, setSearch] = useState("");
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

  const fetchData = async () => {
    try {
      const [list] = await Promise.all([
        api.getAppMetadataList(),
        ensureAppIconsLoaded(true),
        loadCategories(true),
      ]);
      setData(list);
    } catch {
      pushToast("error", t("appManagement.saveFailed"));
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="">
      <ToastStack messages={toasts} onClose={removeToast} />
      <div className="bg-white dark:bg-[#27272b] border border-slate-200 dark:border-[#3f3f41] rounded-lg p-6 shadow-sm dark:shadow-none">
        <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-4">
          {t("appManagement.title")}
        </h2>

        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
              clipRule="evenodd"
            />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("appManagement.search")}
            className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 dark:border-[#3f3f41] rounded-lg bg-white dark:bg-[#1d1d20] text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1369ea]"
          />
        </div>

        {initialLoading ? (
          <div className="text-center text-slate-500 py-12">{t("loading")}</div>
        ) : (
          <AppTable
            data={data}
            categories={categories}
            search={search}
            t={t as (key: string) => string}
            pushToast={pushToast}
            onRefresh={fetchData}
            appIcons={appIcons}
          />
        )}
      </div>
    </div>
  );
}
