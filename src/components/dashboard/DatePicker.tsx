import { useEffect, useMemo, useRef, useState, memo } from "react";
import type { Locale } from "../../i18n";
import { addDays, fmtLocalDate, parseDate, shiftCalendarMonth } from "../../utils/dates";

interface DatePickerProps {
  value: string;
  onChange: (date: string) => void | Promise<void>;
  locale: Locale;
}

const WEEKDAYS: Record<Locale, string[]> = {
  "zh-CN": ["日", "一", "二", "三", "四", "五", "六"],
  "en-US": ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
};

const TODAY_LABEL: Record<Locale, string> = {
  "zh-CN": "今天",
  "en-US": "Today",
};


function isSameDay(a: Date, b: Date): boolean {
  return fmtLocalDate(a) === fmtLocalDate(b);
}

function formatMonthTitle(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
  }).format(date);
}

function formatSelectedDisplay(date: Date, locale: Locale): string {
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "short" }).format(date);
  return locale === "zh-CN"
    ? `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${weekday}`
    : new Intl.DateTimeFormat(locale, {
        year: "numeric",
        month: "numeric",
        day: "numeric",
        weekday: "short",
      }).format(date);
}

export const DatePicker = memo(function DatePicker({ value, onChange, locale }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selectedDate = useMemo(() => parseDate(value), [value]);
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1),
  );
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setVisibleMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
  }, [selectedDate]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
    const start = new Date(firstDay);
    start.setDate(firstDay.getDate() - firstDay.getDay());

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }, [visibleMonth]);

  const chooseDate = async (date: Date) => {
    await onChange(fmtLocalDate(date));
    setOpen(false);
  };

  const changeByDays = (days: number) => {
    void onChange(addDays(value, days));
  };

  const goToday = () => {
    void onChange(fmtLocalDate(new Date()));
  };

  const isTodaySelected = value === fmtLocalDate(new Date());

  return (
    // 单日期选择
    <div ref={containerRef} className="relative z-50 flex items-center">
     <div className="date-strip flex min-w-0 w-fit items-center rounded-2xl border border-slate-200/80 bg-white px-2 py-1 shadow-sm shadow-slate-200/70 dark:border-[#3f3f41] dark:bg-[#1d1d20] dark:shadow-black/20">
        <button
          type="button"
          onClick={() => changeByDays(-1)}
          className="date-strip-arrow"
          aria-label={locale === "zh-CN" ? "前一天" : "Previous day"}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>

        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="date-strip-display whitespace-nowrap"
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          {formatSelectedDisplay(selectedDate, locale)}
        </button>

        <button
          type="button"
          onClick={() => changeByDays(1)}
          className="date-strip-arrow"
          aria-label={locale === "zh-CN" ? "后一天" : "Next day"}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </div>

      <button
        type="button"
        onClick={goToday}
        disabled={isTodaySelected}
        className="date-strip-today"
      >
        {TODAY_LABEL[locale]}
      </button>


      {open && (
        <div
          role="dialog"
          aria-label={locale === "zh-CN" ? "选择日期" : "Select date"}
          className="date-calendar-popover absolute left-0 top-[calc(100%+0.75rem)] z-50 w-[336px] rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl shadow-slate-300 dark:border-[#3f3f41] dark:bg-[#28282c] dark:shadow-black"
        >
          <div className="flex items-center justify-between px-1">
            <button
              type="button"
              onClick={() => setVisibleMonth((month) => shiftCalendarMonth(month, -1))}
              className="calendar-month-button"
              aria-label={locale === "zh-CN" ? "上个月" : "Previous month"}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>
            <div className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">
              {formatMonthTitle(visibleMonth, locale)}
            </div>
            <button
              type="button"
              onClick={() => setVisibleMonth((month) => shiftCalendarMonth(month, 1))}
              className="calendar-month-button"
              aria-label={locale === "zh-CN" ? "下个月" : "Next month"}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>
          </div>

          <div className="relative mt-4 grid grid-cols-7 gap-1 text-center">
            {WEEKDAYS[locale].map((weekday) => (
              <div key={weekday} className="py-2 text-[12px] font-medium tracking-wide text-[#71717a] dark:text-[#a1a1aa]">
                {weekday}
              </div>
            ))}
            {calendarDays.map((date) => {
              const dateValue = fmtLocalDate(date);
              const selected = dateValue === value;
              const currentMonth = date.getMonth() === visibleMonth.getMonth();
              const currentToday = isSameDay(date, new Date());

              return (
                <button
                  key={dateValue}
                  type="button"
                  onClick={() => chooseDate(date)}
                  className={`calendar-day-button ${selected ? "calendar-day-selected" : ""} ${!currentMonth ? "calendar-day-muted" : ""}`}
                >
                  <span className="relative z-10">{date.getDate()}</span>
                  {currentToday && !selected && <span className="absolute bottom-1.5 h-1 w-1 rounded-full bg-sky-500 dark:bg-sky-400" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
})
