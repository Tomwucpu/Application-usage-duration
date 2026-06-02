import { useState, useMemo, useCallback } from "react";
import { useT } from "../../i18n";
import type { AppRankingItem, CategoryRankingItem, ChangeInfo, RankChange } from "../../utils/reportCalculations";
import { formatDurationFull } from "../../utils/reportCalculations";
import { getDisplayName } from "../AppNames";

interface Props {
  appItems: AppRankingItem[];
  categoryItems: CategoryRankingItem[];
  loading: boolean;
  appIcons: Record<string, string>;
  totalSeconds: number;
}

type TabMode = "app" | "category";
const PAGE_SIZES = [10, 15, 20, 30];

function ChangeBadge({ change }: { change: ChangeInfo }) {
  let color = "text-slate-400 dark:text-slate-500";
  if (change.direction === "up") color = "text-green-500";
  else if (change.direction === "down") color = "text-red-500";
  else if (change.direction === "new") color = "text-blue-500";
  return <span className={`text-xs font-medium ${color}`}>{change.text}</span>;
}

function RankBadge({ change }: { change: RankChange }) {
  let color = "text-slate-400 dark:text-slate-500";
  if (change.direction === "up") color = "text-green-500";
  else if (change.direction === "down") color = "text-red-500";
  else if (change.direction === "new") color = "text-blue-500";
  return <span className={`text-xs ${color}`}>{change.text}</span>;
}

export function ReportRanking({ appItems, categoryItems, loading, appIcons, totalSeconds: _totalSeconds }: Props) {
  const { t, locale } = useT();
  const [tab, setTab] = useState<TabMode>("app");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const items = tab === "app" ? appItems : categoryItems;
  const totalPages = useMemo(() => Math.max(1, Math.ceil(items.length / pageSize)), [items.length, pageSize]);
  const safePage = Math.min(currentPage, totalPages);
  const startIdx = (safePage - 1) * pageSize;
  const paginatedItems = items.slice(startIdx, startIdx + pageSize);
  const globalStartIndex = startIdx + 1;

  const handlePageSizeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setPageSize(Number(e.target.value));
    setCurrentPage(1);
  }, []);

  if (loading) {
    return (
      <div className="bg-white dark:bg-[#27272b] border border-slate-200 dark:border-[#3f3f41] rounded-lg p-6 shadow-sm dark:shadow-none">
        <div className="text-center text-slate-500 dark:text-slate-400 py-12">{t("loading")}</div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#27272b] border border-slate-200 dark:border-[#3f3f41] rounded-lg p-6 shadow-sm dark:shadow-none">
      <div className="flex items-center gap-4 mb-4">
        <button
          onClick={() => { setTab("app"); setCurrentPage(1); }}
          className={`pb-1.5 text-sm font-medium border-b-2 transition-colors ${
            tab === "app"
              ? "border-[#1369ea] text-[#1369ea]"
              : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          {t("report.appRanking")}
        </button>
        <button
          onClick={() => { setTab("category"); setCurrentPage(1); }}
          className={`pb-1.5 text-sm font-medium border-b-2 transition-colors ${
            tab === "category"
              ? "border-[#1369ea] text-[#1369ea]"
              : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          {t("report.categoryRanking")}
        </button>
      </div>

      {items.length === 0 ? (
        <div className="text-center text-slate-500 dark:text-slate-400 py-12">{t("report.noData")}</div>
      ) : (
        <>
          <div className="space-y-3">
            {paginatedItems.map((item, i) => {
              const displayLabel = tab === "app" ? getDisplayName((item as AppRankingItem).key) : item.label;
              const icon = tab === "app" ? appIcons[(item as AppRankingItem).key] || null : null;
              const isGone = item.total_seconds === 0 && item.change.direction === "same";

              return (
                <div key={String(tab === "app" ? (item as AppRankingItem).key : (item as CategoryRankingItem).key)} className={`flex items-center gap-3 ${isGone ? "opacity-40" : ""}`}>
                  <span className="w-5 text-right text-sm text-slate-500 dark:text-slate-400 tabular-nums">
                    {globalStartIndex + i}
                  </span>

                  {tab === "app" && icon ? (
                    <img src={`data:image/png;base64,${icon}`} alt="" className="w-7 h-7 rounded-md flex-shrink-0" />
                  ) : tab === "app" ? (
                    <div className="w-7 h-7 rounded-md flex-shrink-0 bg-slate-300 dark:bg-slate-600 flex items-center justify-center text-xs text-slate-500 font-bold">
                      {displayLabel.charAt(0).toUpperCase()}
                    </div>
                  ) : (
                    <div className="w-7 h-7 rounded-md flex-shrink-0 bg-slate-200 dark:bg-slate-600 flex items-center justify-center text-xs text-slate-500">
                      {displayLabel.charAt(0)}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-800 dark:text-slate-200 truncate">{displayLabel}</span>
                      <span className="text-sm text-slate-500 dark:text-slate-400 ml-2 flex-shrink-0">
                        {formatDurationFull(item.total_seconds, locale)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <ChangeBadge change={item.change} />
                    <RankBadge change={item.rankChange} />
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                <span className="text-xs tabular-nums">
                  {startIdx + 1}–{Math.min(startIdx + pageSize, items.length)} / {items.length}
                </span>
                <select
                  value={pageSize}
                  onChange={handlePageSizeChange}
                  className="bg-slate-100 dark:bg-[#1d1d20] border border-slate-200 dark:border-[#3f3f41] rounded px-1.5 py-0.5 text-xs text-slate-600 dark:text-slate-300 outline-none cursor-pointer"
                >
                  {PAGE_SIZES.map((s) => (
                    <option key={s} value={s}>{s}{t("ranking.page")}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  className="px-2 py-1 rounded text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1d1d20] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
                <span className="px-2 text-xs text-slate-600 dark:text-slate-400 tabular-nums select-none">
                  {safePage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  className="px-2 py-1 rounded text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1d1d20] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
