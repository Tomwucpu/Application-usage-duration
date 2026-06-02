import { useMemo } from "react";
import { fmtLocalDate, getTodayString } from "../../utils/dates";
import { useT } from "../../i18n";

interface Props {
  year: number;
  minYear: number;
  maxYear: number;
  dailySeconds: Map<string, number>;
  onYearChange: (year: number) => void;
}

const CELL_SIZE = 11;
const CELL_GAP = 2;
const LEVELS = [
  "bg-slate-100 dark:bg-[#161b22]",
  "bg-green-200 dark:bg-[#0e4429]",
  "bg-green-400 dark:bg-[#006d32]",
  "bg-green-500 dark:bg-[#26a641]",
  "bg-green-700 dark:bg-[#39d353]",
];

function getLevel(seconds: number): number {
  if (seconds <= 0) return 0;
  if (seconds < 1800) return 1;
  if (seconds < 7200) return 2;
  if (seconds < 14400) return 3;
  return 4;
}

function getLevelLabel(seconds: number, locale: string): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (locale === "zh-CN") {
    if (h > 0) return `${h}小时${m}分钟`;
    if (m > 0) return `${m}分钟`;
    return `${seconds}秒`;
  }
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${seconds}s`;
}

const MONTH_NAMES_ZH = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
const MONTH_NAMES_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function UsageHeatmap({ year, minYear, maxYear, dailySeconds, onYearChange }: Props) {
  const { t, locale } = useT();
  const todayStr = getTodayString();
  const isCurrentYear = year === maxYear;

  const { cells, monthLabels, totalCols } = useMemo(() => {
    const jan1 = new Date(year, 0, 1);
    const dec31 = new Date(year, 11, 31);
    let startDate: Date;
    let endDate: Date;
    let cols: number;

    if (isCurrentYear) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const endDay = yesterday.getDay();
      endDate = new Date(yesterday);
      endDate.setDate(yesterday.getDate() + (6 - endDay));
      startDate = new Date(endDate);
      startDate.setDate(endDate.getDate() - 52 * 7);
      cols = 53;
    } else {
      const jan1Day = jan1.getDay();
      startDate = new Date(jan1);
      startDate.setDate(jan1.getDate() - jan1Day);

      const dec31Day = dec31.getDay();
      endDate = new Date(dec31);
      endDate.setDate(dec31.getDate() + (6 - dec31Day));

      const totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
      cols = Math.ceil(totalDays / 7);
    }

    const actualEnd = isCurrentYear ? new Date() : new Date(endDate);
    if (isCurrentYear) {
      actualEnd.setDate(actualEnd.getDate() - 1);
    }

    type CellData = { date: string; seconds: number; level: number; inYear: boolean; future: boolean };
    const grid: CellData[] = [];

    for (let col = 0; col < cols; col++) {
      for (let row = 0; row < 7; row++) {
        const d = new Date(startDate);
        d.setDate(startDate.getDate() + col * 7 + row);
        const dateStr = fmtLocalDate(d);

        if (d.getTime() > actualEnd.getTime()) {
          grid.push({ date: dateStr, seconds: 0, level: 0, inYear: false, future: true });
          continue;
        }

        const isInYear = d.getFullYear() === year;
        const seconds = dailySeconds.get(dateStr) || 0;
        grid.push({ date: dateStr, seconds, level: getLevel(seconds), inYear: isInYear, future: false });
      }
    }

    const months: { label: string; col: number }[] = [];
    let lastMonth = -1;
    for (let col = 0; col < cols; col++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + col * 7);
      if (d.getMonth() !== lastMonth) {
        const labelMonths = locale === "zh-CN" ? MONTH_NAMES_ZH : MONTH_NAMES_EN;
        months.push({ label: labelMonths[d.getMonth()], col });
        lastMonth = d.getMonth();
      }
    }

    return { cells: grid, monthLabels: months, totalCols: cols };
  }, [year, dailySeconds, locale, isCurrentYear]);

  const width = totalCols * (CELL_SIZE + CELL_GAP) + 8;

  const dayNameLabels = locale === "zh-CN"
    ? ["", "一", "", "三", "", "五", ""]
    : ["", "Mon", "", "Wed", "", "Fri", ""];

  return (
    <div className="bg-white dark:bg-[#27272b] border border-slate-200 dark:border-[#3f3f41] rounded-lg p-6 shadow-sm dark:shadow-none">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t("report.heatmap.title")}</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onYearChange(year - 1)}
            disabled={year <= minYear}
            className="p-1 rounded text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#1d1d20] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title={locale === "zh-CN" ? "上一年" : "Previous year"}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6"/>
            </svg>
          </button>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300 tabular-nums min-w-[40px] text-center select-none">{year}</span>
          <button
            onClick={() => onYearChange(year + 1)}
            disabled={year >= maxYear}
            className="p-1 rounded text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#1d1d20] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title={locale === "zh-CN" ? "下一年" : "Next year"}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 18 6-6-6-6"/>
            </svg>
          </button>
        </div>
      </div>

      <div className="flex justify-center">
        <div className="inline-flex flex-col gap-1">
          <svg width={width} height={14}>
            {monthLabels.map((m, i) => (
              <text
                key={i}
                x={4 + m.col * (CELL_SIZE + CELL_GAP)}
                y={10}
                className="text-[9px] fill-slate-500 dark:fill-slate-400"
              >
                {m.label}
              </text>
            ))}
          </svg>

          <div className="flex gap-0.5">
            <div className="flex flex-col gap-0.5" style={{ paddingTop: 0 }}>
              {Array.from({ length: 7 }).map((_, rowIdx) => (
                <div
                  key={rowIdx}
                  className="text-[9px] text-slate-400 dark:text-slate-500 flex items-center justify-end"
                  style={{ width: 16, height: CELL_SIZE, lineHeight: `${CELL_SIZE}px` }}
                >
                  {dayNameLabels[rowIdx]}
                </div>
              ))}
            </div>

            <div
              className="grid grid-flow-col gap-0.5"
              style={{
                gridTemplateRows: `repeat(7, ${CELL_SIZE}px)`,
                gap: CELL_GAP,
              }}
            >
              {cells.map((cell, i) => {
                const isToday = cell.date === todayStr;
                if (cell.future) {
                  return (
                    <div
                      key={i}
                      style={{ width: CELL_SIZE, height: CELL_SIZE }}
                    />
                  );
                }
                const levelClass = LEVELS[cell.level];
                return (
                  <div
                    key={i}
                    title={`${cell.date}: ${getLevelLabel(cell.seconds, locale)}`}
                    className={`rounded-sm ${levelClass} ${
                      isToday ? "ring-1 ring-slate-400 dark:ring-slate-300" : ""
                    }`}
                    style={{ width: CELL_SIZE, height: CELL_SIZE }}
                  />
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-1 mt-2">
            <span className="text-[9px] text-slate-400 dark:text-slate-500">{locale === "zh-CN" ? "少" : "Less"}</span>
            {LEVELS.map((cls, i) => (
              <div
                key={i}
                className={`w-2.5 h-2.5 rounded-sm ${cls}`}
                title={getLevelLabel([0, 900, 3600, 10800, 18000][i], locale)}
              />
            ))}
            <span className="text-[9px] text-slate-400 dark:text-slate-500">{locale === "zh-CN" ? "多" : "More"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
