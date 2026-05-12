import { useT } from "../i18n";
import type { Locale } from "../i18n";
import { getDisplayName } from "./AppNames";
import type { AppSummary } from "../types";

interface Props {
  apps: AppSummary[];
  totalSeconds: number;
}

const COLORS = [
  "#6366f1", "#8b5cf6", "#a855f7", "#d946ef",
  "#ec4899", "#f43f5e", "#f97316", "#eab308",
  "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6",
];

function formatDuration(seconds: number, locale: Locale): string {
  const m = Math.floor(seconds / 60);
  if (locale === "zh-CN") {
    if (m >= 60) return `${Math.floor(m / 60)} 小时 ${m % 60} 分钟`;
    return `${m} 分钟`;
  }
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return `${m}m`;
}

function AppIcon({ base64, name }: { base64: string; name: string }) {
  if (base64) {
    return (
      <img
        src={`data:image/png;base64,${base64}`}
        alt={name}
        className="w-8 h-8 rounded-md flex-shrink-0"
      />
    );
  }
  return (
    <div className="w-8 h-8 rounded-md flex-shrink-0 bg-slate-700 flex items-center justify-center text-xs text-slate-400 font-bold">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export function AppRanking({ apps, totalSeconds }: Props) {
  const { t, locale } = useT();
  const topApps = apps.slice(0, 15);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
      <h2 className="text-lg font-semibold mb-4">{t("chart.ranking")}</h2>

      {topApps.length === 0 && (
        <div className="text-center text-slate-500 py-8">{t("loading")}</div>
      )}

      <div className="space-y-2">
        {topApps.map((app, i) => {
          const pct = totalSeconds > 0
            ? Math.round((app.total_seconds / totalSeconds) * 100)
            : 0;
          const displayName = getDisplayName(app.app_name, locale);

          return (
            <div key={app.app_name} className="flex items-center gap-3 group">
              {/* Rank */}
              <span className="w-6 text-right text-xs text-slate-500 tabular-nums">
                {i + 1}
              </span>

              {/* Icon */}
              <AppIcon base64={app.icon_base64} name={displayName} />

              {/* Name + bar */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-sm text-slate-200 truncate">
                    {displayName}
                  </span>
                  <span className="text-xs text-slate-400 ml-2 flex-shrink-0">
                    {formatDuration(app.total_seconds, locale)}
                  </span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.max(pct, 2)}%`,
                      backgroundColor: COLORS[i % COLORS.length],
                    }}
                  />
                </div>
              </div>

              {/* Percentage */}
              <span className="w-10 text-xs text-slate-500 tabular-nums text-right">
                {pct}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
