import { useState, useMemo, useCallback } from "react";
import { useT } from "../../i18n";
import type { AppRankingItem, CategoryRankingItem, RankChange } from "../../utils/reportCalculations";
import { formatDurationFull } from "../../utils/reportCalculations";
import { getDisplayName } from "../AppNames";
import { ChangeBadge, DiffBadge } from "../shared/ChangeBadge";

interface Props {
  appItems: AppRankingItem[];
  categoryItems: CategoryRankingItem[];
  loading: boolean;
  appIcons: Record<string, string>;
  categoryIcons: Record<number, string>;
  totalSeconds: number;
}

type TabMode = "app" | "category";
const PAGE_SIZES = [10, 15, 20, 30];

function RankBadge({ change }: { change: RankChange }) {
  let color = "text-slate-300 dark:text-slate-600";
  if (change.direction === "up") color = "text-red-500";
  else if (change.direction === "down") color = "text-green-500";
  else if (change.direction === "new") color = "text-purple-500 font-bold";

  return (
    <span className={`text-[10px] font-medium flex items-center gap-0.5 ${color}`}>
      {change.direction === "up" && (
        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />
        </svg>
      )}
      {change.direction === "down" && (
        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3" />
        </svg>
      )}
      {change.direction === "same" && change.text === "—" && (
        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
        </svg>
      )}
      <span>{change.direction === "same" && change.text === "—" ? "" : change.text}</span>
    </span>
  );
}

export function ReportRanking({ appItems, categoryItems, loading, appIcons, categoryIcons, totalSeconds: _totalSeconds }: Props) {
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
          <div className="space-y-1">
            {paginatedItems.map((item, i) => {
              const displayLabel = tab === "app" ? getDisplayName((item as AppRankingItem).key) : item.label;
              const icon = tab === "app"
                ? appIcons[(item as AppRankingItem).key] || null
                : categoryIcons[(item as CategoryRankingItem).key] || null;
              const isGone = item.total_seconds === 0 && item.change.direction === "same";

              return (
                <div key={String(tab === "app" ? (item as AppRankingItem).key : (item as CategoryRankingItem).key)} className={`group flex items-center p-3 sm:p-3 bg-white dark:bg-[#27272b] hover:bg-slate-50 dark:hover:bg-[#2f2f33] rounded-2xl border border-transparent hover:border-slate-100 dark:hover:border-[#3f3f41] transition-all duration-200 ${isGone ? "opacity-40" : ""}`}>
                  <div className="w-16 flex flex-col items-center justify-center space-y-1">
                    <span 
                      className={`font-bold ${
                        (globalStartIndex + i) === 1 ? 'text-[#fbbf24] text-2xl drop-shadow-[0_1px_2px_rgba(251,191,36,0.3)]' :
                        (globalStartIndex + i) === 2 ? 'text-[#94a3b8] text-xl drop-shadow-[0_1px_2px_rgba(148,163,184,0.3)]' :
                        (globalStartIndex + i) === 3 ? 'text-[#b45309] text-xl drop-shadow-[0_1px_2px_rgba(180,83,9,0.3)]' :
                        'text-slate-400 text-lg dark:text-slate-500'
                      }`}
                    >
                      {globalStartIndex + i}
                    </span>
                    <RankBadge change={item.rankChange} />
                  </div>

                  <div className="flex-1 flex items-center space-x-4 pl-2 pr-4">
                    {icon ? (
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0">
                        <img
                          src={tab === "app" ? `data:image/png;base64,${icon}` : icon.startsWith("/") ? icon : `data:image/png;base64,${icon}`}
                          alt=""
                          className="w-8 h-8 rounded-md"
                        />
                      </div>
                    ) : tab === "app" ? (
                      <div className="w-12 h-12 rounded-2xl flex-shrink-0 flex items-center justify-center text-xl text-slate-500 font-bold">
                        {displayLabel.charAt(0).toUpperCase()}
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-2xl flex-shrink-0 flex items-center justify-center text-xl text-slate-500">
                        {displayLabel.charAt(0)}
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="text-base font-medium text-slate-800 dark:text-slate-200 truncate">{displayLabel}</div>
                    </div>
                  </div>

                  <div className="w-32 flex flex-col items-end justify-center space-y-1">
                    <span className="text-base font-semibold text-slate-800 dark:text-slate-200">
                      {formatDurationFull(item.total_seconds, locale)}
                    </span>
                    <div className="flex items-center gap-1">
                      <ChangeBadge change={item.change} />
                      <DiffBadge change={item.change} />
                    </div>
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
