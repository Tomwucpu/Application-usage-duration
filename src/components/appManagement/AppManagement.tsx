import { useEffect, useMemo, useRef, useState } from "react";
import { useStore, api } from "../../stores/useStore";
import { useT } from "../../i18n";
import { ToastStack, type ToastMessage, type ToastTone } from "../shared/ToastStack";
import { DropdownMenu } from "../shared/DropdownMenu";
import { AppTable } from "./AppTable";
import { UNCATEGORIZED_FILTER_KEY } from "./filterApps";
import type { AppMetadataItem } from "../../types";

function SelectedCheckIcon({ selected }: { selected: boolean }) {
  if (!selected) {
    return <span className="h-5 w-5 shrink-0" aria-hidden="true" />;
  }

  return (
    <span
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1369ea]"
      aria-hidden="true"
    >
      <svg
        className="h-3.5 w-3.5"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M3.5 8.25L6.5 11.25L12.5 5.25"
          stroke="#ffffff"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export function AppManagement() {
  const { t } = useT();
  const appIcons = useStore((s) => s.appIcons);
  const categories = useStore((s) => s.categories);
  const ensureAppIconsLoaded = useStore((s) => s.ensureAppIconsLoaded);
  const loadCategories = useStore((s) => s.loadCategories);
  const [data, setData] = useState<AppMetadataItem[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toastTimerRef = useRef<number[]>([]);
  const toastIdRef = useRef(0);

  const selectedCategoryLabel = useMemo(() => {
    if (selectedCategoryIds.length === 0) {
      return t("appManagement.categoryFilter");
    }

    const selectedLabels = selectedCategoryIds
      .map((id) => {
        if (id === UNCATEGORIZED_FILTER_KEY) {
          return t("common.uncategorized");
        }
        return categories.find((category) => category.id === id)?.name ?? null;
      })
      .filter((label): label is string => !!label);

    if (selectedLabels.length === 0) {
      return t("appManagement.categoryFilter");
    }

    if (selectedLabels.length === 1) {
      return selectedLabels[0];
    }

    return t("common.selectedCount").replace("{count}", String(selectedLabels.length));
  }, [categories, selectedCategoryIds, t]);

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

  const handleVisibleRowsChange = (rows: AppMetadataItem[]) => {
    void ensureAppIconsLoaded(rows.map((row) => row.app_name));
  };

  return (
    <div className="">
      <ToastStack messages={toasts} onClose={removeToast} />
      <div className="bg-white dark:bg-[#27272b] border border-slate-200 dark:border-[#3f3f41] rounded-lg p-6 shadow-sm dark:shadow-none">
        <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-4">
          {t("appManagement.title")}
        </h2>

        <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
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

          <DropdownMenu
            label={selectedCategoryLabel}
            minWidthClassName="min-w-[160px]"
            buttonClassName="w-full sm:w-auto bg-white dark:bg-[#1d1d20] px-3 py-2"
            menuClassName="w-[260px]"
            scrollable
            maxHeight={280}
          >
            {() => (
              <div className="p-1">
                <button
                  type="button"
                  onClick={() => setSelectedCategoryIds([])}
                  className="mb-1 flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-[#27272b]"
                >
                  <span>{t("common.clearFilter")}</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setSelectedCategoryIds((current) =>
                      current.includes(UNCATEGORIZED_FILTER_KEY)
                        ? current.filter((id) => id !== UNCATEGORIZED_FILTER_KEY)
                        : [...current, UNCATEGORIZED_FILTER_KEY],
                    )
                  }
                  className="flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-[#27272b]"
                >
                  <span>{t("common.uncategorized")}</span>
                  <SelectedCheckIcon
                    selected={selectedCategoryIds.includes(UNCATEGORIZED_FILTER_KEY)}
                  />
                </button>

                {categories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() =>
                      setSelectedCategoryIds((current) =>
                        current.includes(category.id)
                          ? current.filter((id) => id !== category.id)
                          : [...current, category.id],
                      )
                    }
                    className="flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-[#27272b]"
                  >
                    <span>{category.name}</span>
                    <SelectedCheckIcon selected={selectedCategoryIds.includes(category.id)} />
                  </button>
                ))}
              </div>
            )}
          </DropdownMenu>
        </div>

        {initialLoading ? (
          <div className="text-center text-slate-500 py-12">{t("loading")}</div>
        ) : (
          <AppTable
            data={data}
            categories={categories}
            search={search}
            selectedCategoryIds={selectedCategoryIds}
            t={t as (key: string) => string}
            pushToast={pushToast}
            onRefresh={fetchData}
            appIcons={appIcons}
            onVisibleRowsChange={handleVisibleRowsChange}
          />
        )}
      </div>
    </div>
  );
}
