import { useT } from "../../i18n";
import type { Locale } from "../../i18n";
import { CHART_COLORS } from "../../themes/colors";
import type { UsageRankingItem } from "../../types";

interface Props {
  items: UsageRankingItem[];
  totalSeconds: number;
  loading: boolean;
  title: string;
}

function formatDuration(seconds: number, locale: Locale): string {
  const m = Math.floor(seconds / 60);
  if (locale === "zh-CN") {
    if (m >= 60) return `${Math.floor(m / 60)} 小时 ${m % 60} 分钟`;
    return `${m} 分钟`;
  }
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return `${m}m`;
}

function RankingIcon({ icon, name }: { icon?: string | null; name: string }) {
  if (icon) {
    if (icon.startsWith("/")) {
      return (
        <img
          src={icon}
          alt={name}
          className="w-6 h-6 rounded-md flex-shrink-0"
        />
      );
    }
    return (
      <img
        src={`data:image/png;base64,${icon}`}
        alt={name}
        className="w-6 h-6 rounded-md flex-shrink-0 mt-1"
      />
    );
  }
  return (
    <div className="w-6 h-6 rounded-md flex-shrink-0 bg-slate-700 flex items-center justify-center text-xs text-slate-400 font-bold">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export function AppRanking({ items, totalSeconds, loading, title }: Props) {
  const { t, locale } = useT();
  const topItems = items.slice(0, 15);

  return (
    <div className="bg-white dark:bg-[#27272b] border border-slate-200 dark:border-[#3f3f41] rounded-lg p-5 shadow-sm dark:shadow-none">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">{title}</h2>

      {topItems.length === 0 && (
        <div className="text-center text-slate-500 dark:text-slate-400 py-8">
          {loading ? t("loading") : t("breakdown.noData")}
        </div>
      )}

      <div className="space-y-3">
        {topItems.map((item, i) => {
          const pct = totalSeconds > 0
            ? Math.round((item.total_seconds / totalSeconds) * 100)
            : 0;

          return (
            <div key={item.key} className="flex items-center gap-4 group">
              <span className="w-6 text-right text-xs text-slate-500 tabular-nums mt-1">
                {i + 1}
              </span>

              <RankingIcon icon={item.icon} name={item.label} />

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-sm text-slate-800 dark:text-slate-200 truncate">
                    {item.label}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 ml-2 flex-shrink-0">
                    {formatDuration(item.total_seconds, locale)}
                  </span>
                </div>
                <div className="h-1.5 bg-slate-100 dark:bg-[#1d1d20] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.max(pct, 2)}%`,
                      backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                    }}
                  />
                </div>
              </div>

              <span className="w-10 text-xs text-slate-500 dark:text-slate-400 tabular-nums text-right">
                {pct}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
