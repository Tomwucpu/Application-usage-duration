import { useT } from "../../i18n";
import type { ReportPeriod } from "../../utils/reportCalculations";

interface Props {
  anchorDate: string;
  period: ReportPeriod;
  periodLabel: string;
  onPeriodChange: (period: ReportPeriod) => void;
  onPrev: () => void;
  onNext: () => void;
}

const PERIODS: ReportPeriod[] = ["day", "week", "month", "year"];

export function ReportPeriodSwitcher({ period, periodLabel, onPeriodChange, onPrev, onNext }: Props) {
  const { t } = useT();

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onPrev}
        className="p-2 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#27272b] hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 18-6-6 6-6"/>
        </svg>
      </button>

      <span className="text-lg font-semibold text-slate-900 dark:text-slate-100 min-w-[200px] text-center select-none">
        {periodLabel}
      </span>

      <button
        onClick={onNext}
        className="p-2 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#27272b] hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m9 18 6-6-6-6"/>
        </svg>
      </button>

      <div className="flex items-center gap-1 ml-4 bg-slate-100 dark:bg-[#1d1d20] rounded-lg p-1">
        {PERIODS.map((p) => (
          <button
            key={p}
            onClick={() => onPeriodChange(p)}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              period === p
                ? "bg-white dark:bg-[#27272b] text-[#1369ea] shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            {t(`report.${p}` as (keyof typeof import("../../i18n/zh-CN.json")))}
          </button>
        ))}
      </div>
    </div>
  );
}
