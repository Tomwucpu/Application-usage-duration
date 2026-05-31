import { memo, useState, useCallback, useMemo } from "react";
import { useT } from "../../i18n";
import type { UsageRankingItem } from "../../types";

interface Props {
  items: UsageRankingItem[];
  totalSeconds: number;
  loading: boolean;
  title: string;
  colorMap: Record<string, string>;
}

const PAGE_SIZES = [10, 15, 20, 30];

function RankingIcon({ icon, name }: { icon?: string | null; name: string }) {
  if (icon) {
    if (icon.startsWith("/")) {
      return (
        <img
          src={icon}
          alt={name}
              className="w-8 h-8 rounded-md flex-shrink-0"
        />
      );
    }
    return (
      <img
        src={`data:image/png;base64,${icon}`}
        alt={name}
        className="w-8 h-8 rounded-md flex-shrink-0 mt-1"
      />
    );
  }
  return (
    <div className="w-8 h-8 rounded-md flex-shrink-0 bg-slate-700 flex items-center justify-center text-sm text-slate-400 font-bold">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export const AppRanking = memo(function AppRanking({ items, totalSeconds, loading, title, colorMap }: Props) {
  const { t, locale } = useT();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(items.length / pageSize)), [items.length, pageSize]);
  const safePage = Math.min(currentPage, totalPages);
  const startIdx = (safePage - 1) * pageSize;
  const paginatedItems = items.slice(startIdx, startIdx + pageSize);
  const globalStartIndex = startIdx + 1;

  const handlePageSizeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setPageSize(Number(e.target.value));
    setCurrentPage(1);
  }, []);

  const handlePrev = useCallback(() => {
    setCurrentPage((p) => Math.max(1, p - 1));
  }, []);

  const handleNext = useCallback(() => {
    setCurrentPage((p) => Math.min(totalPages, p + 1));
  }, [totalPages]);

  const formatDuration = useCallback((seconds: number) => {
    const total = Math.round(seconds);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h > 0) return t("ranking.duration.hms").replace("{h}", String(h)).replace("{m}", String(m)).replace("{s}", String(s));
    if (m > 0) return t("ranking.duration.ms").replace("{m}", String(m)).replace("{s}", String(s));
    return t("ranking.duration.s").replace("{s}", String(s));
  }, [t]);

  return (
    <div className="bg-white dark:bg-[#27272b] border border-slate-200 dark:border-[#3f3f41] rounded-lg p-6 shadow-sm dark:shadow-none">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">{title}</h2>

      {items.length === 0 && (
        <div className="text-center text-slate-500 dark:text-slate-400 py-12">
          {loading ? t("loading") : t("breakdown.noData")}
        </div>
      )}

      {items.length > 0 && (
        <>
          <div className="space-y-4">
            {paginatedItems.map((item, i) => {
              const pct = totalSeconds > 0
                ? Math.round((item.total_seconds / totalSeconds) * 100)
                : 0;

              return (
                <div key={item.key} className="flex items-center gap-3 group">
                  <span className="w-4 text-right text-[16px] text-slate-500 tabular-nums mt-1">
                    {globalStartIndex + i}
                  </span>

                  <RankingIcon icon={item.icon} name={item.label} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-base text-slate-800 dark:text-slate-200 truncate">
                        {item.label}
                      </span>
                      <span className="text-sm text-slate-500 dark:text-slate-400 ml-2 flex-shrink-0 mr-11">
                        {formatDuration(item.total_seconds)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-slate-100 dark:bg-[#1d1d20] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.max(pct, 2)}%`,
                            backgroundColor: colorMap[item.label],
                          }}
                        />
                      </div>
                      <span className="w-8 text-sm leading-none text-center text-slate-500 dark:text-slate-400 tabular-nums flex-shrink-0">
                        {pct}%
                      </span>
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
                    <option key={s} value={s}>
                      {s}{t("ranking.page")}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handlePrev}
                  disabled={safePage <= 1}
                  className="px-2 py-1 rounded text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1d1d20] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  aria-label={locale === "zh-CN" ? "上一页" : "Previous page"}
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
                  onClick={handleNext}
                  disabled={safePage >= totalPages}
                  className="px-2 py-1 rounded text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1d1d20] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  aria-label={locale === "zh-CN" ? "下一页" : "Next page"}
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
})
