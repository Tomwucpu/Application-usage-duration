import { useT } from "../../i18n";
import type { ReportOverview, ReportPeriod, ChangeInfo } from "../../utils/reportCalculations";
import { formatDurationFull, formatDurationReport } from "../../utils/reportCalculations";

interface Props {
  overview: ReportOverview;
  period: ReportPeriod;
}

function ChangeBadge({ change }: { change: ChangeInfo }) {
  let color = "text-slate-400 dark:text-slate-500";
  if (change.direction === "up") color = "text-green-500";
  else if (change.direction === "down") color = "text-red-500";
  else if (change.direction === "new") color = "text-blue-500";

  return (
    <span className={`text-xs font-medium ${color}`}>
      {change.text}
    </span>
  );
}

export function ReportOverviewCards({ overview, period }: Props) {
  const { t, locale } = useT();

  const cards = [
    { label: t("report.totalUsage"), value: formatDurationFull(overview.totalSeconds, locale), change: overview.totalSecondsChange, show: true },
    { label: t("report.activeApps"), value: String(overview.activeApps), change: overview.activeAppsChange, show: true },
    { label: t("report.activeCategories"), value: String(overview.activeCategories), change: overview.activeCategoriesChange, show: true },
    { label: t("report.dailyAverage"), value: formatDurationReport(overview.dailyAverage), change: overview.dailyAverageChange, show: period !== "day" },
    { label: t("report.hourlyAverage"), value: formatDurationReport(overview.hourlyAverage), change: overview.hourlyAverageChange, show: period === "day" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.filter(c => c.show).map((card) => (
        <div
          key={card.label}
          className="bg-white dark:bg-[#27272b] border border-slate-200 dark:border-[#3f3f41] rounded-lg px-4 py-3 shadow-sm dark:shadow-none"
        >
          <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">{card.label}</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
            {card.value}
          </div>
          <div className="mt-1 flex items-center gap-1">
            <ChangeBadge change={card.change} />
          </div>
        </div>
      ))}
    </div>
  );
}
