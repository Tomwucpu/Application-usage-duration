import { useEffect, useRef, useState } from "react";
import { useStore } from "../../stores/useStore";
import { useT } from "../../i18n";
import { ToastStack, type ToastMessage, type ToastTone } from "../shared/ToastStack";
import { CategoryTable } from "./CategoryTable";
import { CreateCategoryDialog } from "./CreateCategoryDialog";
import type { CategoryItem } from "../../types";

export function CategoryManagement() {
  const { t } = useT();
  const loadCategories = useStore((s) => s.loadCategories);
  const ensureAppIconsLoaded = useStore((s) => s.ensureAppIconsLoaded);
  const [data, setData] = useState<CategoryItem[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
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
      await Promise.all([loadCategories(true), ensureAppIconsLoaded(true)]);
      setData(useStore.getState().categories);
    } catch {
      pushToast("error", t("categoryManagement.saveFailed"));
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <ToastStack messages={toasts} onClose={removeToast} />
      <CreateCategoryDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreated={fetchData}
        pushToast={pushToast}
        t={t as (key: string) => string}
      />
      <div className="bg-white dark:bg-[#27272b] border border-slate-200 dark:border-[#3f3f41] rounded-lg p-6 shadow-sm dark:shadow-none">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100">
            {t("categoryManagement.title")}
          </h2>
          <button
            onClick={() => setShowCreateDialog(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-[#3f3f41] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1d1d20] transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            {t("categoryManagement.add")}
          </button>
        </div>

        <div className="relative mb-4">
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
            placeholder={t("categoryManagement.search")}
            className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 dark:border-[#3f3f41] rounded-lg bg-white dark:bg-[#1d1d20] text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1369ea]"
          />
        </div>

        {initialLoading ? (
          <div className="text-center text-slate-500 py-12">{t("loading")}</div>
        ) : (
          <CategoryTable
            data={data}
            search={search}
            t={t as (key: string) => string}
            pushToast={pushToast}
            onRefresh={fetchData}
          />
        )}
      </div>
    </div>
  );
}
