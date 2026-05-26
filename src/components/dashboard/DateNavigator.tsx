import { useMemo } from "react";
import { useT } from "../../i18n";
import type { ViewMode } from "../../types";
import { addDays, addMonths, getMonthRange, getTodayString, getWeekRange, parseDate } from "../../utils/dates";
import { DateRangePicker } from "../breakdown/DateRangePicker";
import { DatePicker } from "./DatePicker";

interface DateNavigatorProps {
  selectedDate: string;
  viewMode: ViewMode;
  customStartDate: string | null;
  customEndDate: string | null;
  onDateChange: (date: string) => void | Promise<void>;
  onViewModeChange: (mode: ViewMode) => void;
  onCustomRangeChange: (start: string, end: string) => void;
}

export function formatWeekLabel(start: string, end: string, locale: "zh-CN" | "en-US") {
  const startDate = parseDate(start);
  const endDate = parseDate(end);
  if (locale === "zh-CN") {
    return `${startDate.getFullYear()}年${startDate.getMonth() + 1}月${startDate.getDate()}日 - ${endDate.getFullYear()}年${endDate.getMonth() + 1}月${endDate.getDate()}日`;
  }
  const formatter = new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric" });
  return `${formatter.format(startDate)} - ${formatter.format(endDate)}`;
}

function formatMonthLabel(date: string, locale: "zh-CN" | "en-US") {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
  }).format(parseDate(date));
}

export function DateNavigator({
  selectedDate,
  viewMode,
  customStartDate,
  customEndDate,
  onDateChange,
  onViewModeChange,
  onCustomRangeChange,
}: DateNavigatorProps) {
  const { t, locale } = useT();
  const today = getTodayString();

  const weekRange = useMemo(() => getWeekRange(selectedDate), [selectedDate]);
  const monthRange = useMemo(() => getMonthRange(selectedDate), [selectedDate]);
  const currentWeekRange = useMemo(() => getWeekRange(today), [today]);
  const currentMonthRange = useMemo(() => getMonthRange(today), [today]);

  const weeklyLabel = useMemo(
    () => formatWeekLabel(weekRange.start, weekRange.end, locale),
    [weekRange.start, weekRange.end, locale],
  );
  const monthlyLabel = useMemo(
    () => formatMonthLabel(selectedDate, locale),
    [selectedDate, locale],
  );

  const showRangeControls = viewMode === "weekly" || viewMode === "monthly";
  const periodLabel = viewMode === "weekly" ? weeklyLabel : monthlyLabel;
  const jumpLabel = viewMode === "weekly"
    ? t("date.navigator.thisWeek")
    : t("date.navigator.thisMonth");
  const previousLabel = viewMode === "weekly"
    ? t("date.navigator.previousWeek")
    : t("date.navigator.previousMonth");
  const nextLabel = viewMode === "weekly"
    ? t("date.navigator.nextWeek")
    : t("date.navigator.nextMonth");
  const currentSelected = viewMode === "weekly"
    ? weekRange.start === currentWeekRange.start && weekRange.end === currentWeekRange.end
    : monthRange.start === currentMonthRange.start && monthRange.end === currentMonthRange.end;

  return (
    <div className="flex items-center justify-end gap-3 flex-wrap">
      {viewMode === "daily" && (
        <DatePicker value={selectedDate} onChange={onDateChange} locale={locale} />
      )}

      {showRangeControls && (
        <>
          <div className="date-strip flex items-center rounded-2xl border border-slate-200/80 bg-white px-2 py-1 shadow-sm shadow-slate-200/70 dark:border-[#3f3f41] dark:bg-[#1d1d20] dark:shadow-black/20">
            <button
              type="button"
              onClick={() => void onDateChange(viewMode === "weekly" ? addDays(selectedDate, -7) : addMonths(selectedDate, -1))}
              className="date-strip-arrow"
              aria-label={previousLabel}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>

            <div className="date-strip-display cursor-default whitespace-nowrap">
              {periodLabel}
            </div>

            <button
              type="button"
              onClick={() => void onDateChange(viewMode === "weekly" ? addDays(selectedDate, 7) : addMonths(selectedDate, 1))}
              className="date-strip-arrow"
              aria-label={nextLabel}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>
          </div>

          <button
            type="button"
            onClick={() => void onDateChange(today)}
            disabled={currentSelected}
            className="date-strip-today"
          >
            {jumpLabel}
          </button>
        </>
      )}

      {viewMode === "custom" && (
        <DateRangePicker
          startDate={customStartDate}
          endDate={customEndDate}
          onChange={onCustomRangeChange}
          locale={locale}
          compact
        />
      )}

      <div className="inline-flex w-fit rounded-2xl border border-slate-200/80 bg-white p-1 shadow-sm shadow-slate-200/70 dark:border-[#3f3f41] dark:bg-[#1d1d20] dark:shadow-black/20">
        {(["daily", "weekly", "monthly", "custom"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => onViewModeChange(mode)}
            className={`px-3 py-1.5 text-sm font-medium rounded-xl transition-all duration-200 whitespace-nowrap ${
              viewMode === mode
                ? "bg-[#0060df] text-white shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#27272b]"
            }`}
          >
            {t(`breakdown.${mode}`)}
          </button>
        ))}
      </div>
    </div>
  );
}
