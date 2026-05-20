import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useT } from "../i18n";
import type { Locale } from "../i18n";

interface DateRangePickerProps {
  startDate: string | null;
  endDate: string | null;
  onChange: (start: string, end: string) => void;
  locale: Locale;
}

const WEEKDAYS: Record<Locale, string[]> = {
  "zh-CN": ["日", "一", "二", "三", "四", "五", "六"],
  "en-US": ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function toDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function isSameDay(a: Date, b: Date): boolean {
  return toDateString(a) === toDateString(b);
}

function formatShortDate(dateStr: string, locale: Locale): string {
  const d = parseDate(dateStr);
  return d.toLocaleDateString(locale === "zh-CN" ? "zh-CN" : "en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatMonthTitle(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
  }).format(date);
}

export function DateRangePicker({ startDate, endDate, onChange, locale }: DateRangePickerProps) {
  const { t } = useT();
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => toDateString(today), [today]);

  const day = 86400000;
  const presets = useMemo(
    () => [
      { label: t("date.range.today"), start: todayStr, end: todayStr },
      { label: t("date.range.7days"), start: toDateString(new Date(Date.now() - 6 * day)), end: todayStr },
      { label: t("date.range.14days"), start: toDateString(new Date(Date.now() - 13 * day)), end: todayStr },
      { label: t("date.range.30days"), start: toDateString(new Date(Date.now() - 29 * day)), end: todayStr },
    ],
    [todayStr, t],
  );

  const s = startDate || todayStr;
  const e = endDate || todayStr;
  const rangeDisplay = `${formatShortDate(s, locale)} \u2013 ${formatShortDate(e, locale)}`;

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<"start" | "end">("start");

  const [draftStart, setDraftStart] = useState(s);
  const [draftStartInput, setDraftStartInput] = useState(s);
  const [draftEnd, setDraftEnd] = useState(e);
  const [draftEndInput, setDraftEndInput] = useState(e);

  const [month, setMonth] = useState(() => new Date(parseDate(s).getFullYear(), parseDate(s).getMonth(), 1));

  const containerRef = useRef<HTMLDivElement>(null);

  const openPopover = useCallback(() => {
    const ds = startDate || todayStr;
    const de = endDate || todayStr;
    setDraftStart(ds);
    setDraftStartInput(ds);
    setDraftEnd(de);
    setDraftEndInput(de);
    setActive("start");
    setMonth(new Date(parseDate(ds).getFullYear(), parseDate(ds).getMonth(), 1));
    setOpen(true);
  }, [startDate, endDate, todayStr]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const commitDraft = useCallback(() => {
    if (draftStart > draftEnd) {
      onChange(draftEnd, draftStart);
    } else {
      onChange(draftStart, draftEnd);
    }
    setOpen(false);
  }, [draftStart, draftEnd, onChange]);

  const handlePreset = useCallback(
    (start: string, end: string) => {
      onChange(start, end);
      setOpen(false);
    },
    [onChange],
  );

  const handleCalendarClick = useCallback(
    (date: Date) => {
      const val = toDateString(date);
      if (active === "start") {
        setDraftStart(val);
        setDraftStartInput(val);
      } else {
        setDraftEnd(val);
        setDraftEndInput(val);
      }
    },
    [active],
  );

  const validateAndCommit = useCallback(
    (which: "start" | "end", raw: string) => {
      const v = raw.trim();
      if (DATE_RE.test(v) && !isNaN(parseDate(v).getTime())) {
        if (which === "start") {
          setDraftStart(v);
          setDraftStartInput(v);
        } else {
          setDraftEnd(v);
          setDraftEndInput(v);
        }
      } else {
        if (which === "start") {
          setDraftStartInput(draftStart);
        } else {
          setDraftEndInput(draftEnd);
        }
      }
    },
    [draftStart, draftEnd],
  );

  const todayRef = useMemo(() => new Date(), []);
  const start = parseDate(draftStart);
  const end = parseDate(draftEnd);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
    const first = new Date(firstDay);
    first.setDate(firstDay.getDate() - firstDay.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(first);
      date.setDate(first.getDate() + index);
      return date;
    });
  }, [month]);

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-2 flex-wrap">
        {presets.map((preset) => {
          const isActive = startDate === preset.start && endDate === preset.end;
          return (
            <button
              key={preset.label}
              type="button"
              onClick={() => handlePreset(preset.start, preset.end)}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
                isActive
                  ? "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400"
                  : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              {preset.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={openPopover}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg transition-colors border ${
            open
              ? "border-indigo-300 dark:border-indigo-600 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
              : "border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          {rangeDisplay}
        </button>
      </div>

      {open && (
        <div
          role="dialog"
          aria-label={locale === "zh-CN" ? "选择日期范围" : "Select date range"}
          className="absolute left-0 top-[calc(100%+0.5rem)] z-50 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl shadow-slate-300/50 dark:border-slate-700 dark:bg-slate-950 dark:shadow-black/40"
        >
          {/* Start / End date fields */}
          <div className="flex items-center gap-2.5 mb-5">
            <DateField
              label={t("date.customStart")}
              inputValue={draftStartInput}
              onInputChange={setDraftStartInput}
              onBlur={() => validateAndCommit("start", draftStartInput)}
              isActive={active === "start"}
              onActivate={() => setActive("start")}
              onMinus={() => {
                const d = parseDate(draftStart);
                d.setDate(d.getDate() - 1);
                const v = toDateString(d);
                setDraftStart(v);
                setDraftStartInput(v);
              }}
              onPlus={() => {
                const d = parseDate(draftStart);
                d.setDate(d.getDate() + 1);
                const v = toDateString(d);
                setDraftStart(v);
                setDraftStartInput(v);
              }}
              locale={locale}
            />
            <span className="text-slate-300 dark:text-slate-600 text-sm font-light shrink-0 pt-[2px]">—</span>
            <DateField
              label={t("date.customEnd")}
              inputValue={draftEndInput}
              onInputChange={setDraftEndInput}
              onBlur={() => validateAndCommit("end", draftEndInput)}
              isActive={active === "end"}
              onActivate={() => setActive("end")}
              onMinus={() => {
                const d = parseDate(draftEnd);
                d.setDate(d.getDate() - 1);
                const v = toDateString(d);
                setDraftEnd(v);
                setDraftEndInput(v);
              }}
              onPlus={() => {
                const d = parseDate(draftEnd);
                d.setDate(d.getDate() + 1);
                const v = toDateString(d);
                setDraftEnd(v);
                setDraftEndInput(v);
              }}
              locale={locale}
            />
          </div>

          {/* Single month calendar */}
          <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
          <div className="flex justify-center">
            <div>
              <div className="flex items-center justify-between px-1 mb-2">
                <button
                  type="button"
                  onClick={() => setMonth(addMonths(month, -1))}
                  className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                  aria-label={locale === "zh-CN" ? "上个月" : "Previous month"}
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m15 18-6-6 6-6" />
                  </svg>
                </button>
                <div className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">
                  {formatMonthTitle(month, locale)}
                </div>
                <button
                  type="button"
                  onClick={() => setMonth(addMonths(month, 1))}
                  className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                  aria-label={locale === "zh-CN" ? "下个月" : "Next month"}
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-7 gap-0.5 text-center w-[336px]">
                {WEEKDAYS[locale].map((weekday) => (
                  <div key={weekday} className="py-1.5 text-[10.5px] font-medium tracking-wide text-slate-400 dark:text-slate-500">
                    {weekday}
                  </div>
                ))}
                {calendarDays.map((date) => {
                  const dateValue = toDateString(date);
                  const currentMonth = date.getMonth() === month.getMonth();
                  const isToday = isSameDay(date, todayRef);
                  const isStart = isSameDay(date, start);
                  const isEnd = isSameDay(date, end);
                  const inRange = toDateString(date) >= toDateString(start)
                    && toDateString(date) <= toDateString(end);

                  return (
                    <button
                      key={dateValue}
                      type="button"
                      onClick={() => handleCalendarClick(date)}
                      className={`relative flex items-center justify-center h-9 rounded-lg text-[13px] transition-colors ${
                        isStart && isEnd
                          ? "bg-indigo-600 text-white font-semibold rounded-lg z-10"
                          : isStart
                          ? "bg-indigo-600 text-white font-semibold rounded-l-lg rounded-r-none z-10"
                          : isEnd
                          ? "bg-indigo-600 text-white font-semibold rounded-r-lg rounded-l-none z-10"
                          : inRange
                          ? "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 rounded-none"
                          : !currentMonth
                          ? "text-slate-300 dark:text-slate-600"
                          : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      {date.getDate()}
                      {isToday && !isStart && !isEnd && (
                        <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-indigo-500 dark:bg-indigo-400" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {active === "start"
                ? locale === "zh-CN" ? "正在设置开始日期" : "Setting start date"
                : locale === "zh-CN" ? "正在设置结束日期" : "Setting end date"}
            </span>
            <button
              type="button"
              onClick={commitDraft}
              className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
            >
              {locale === "zh-CN" ? "确定" : "Apply"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DateField({
  label,
  inputValue,
  onInputChange,
  onBlur,
  isActive,
  onActivate,
  onMinus,
  onPlus,
  locale,
}: {
  label: string;
  inputValue: string;
  onInputChange: (v: string) => void;
  onBlur: () => void;
  isActive: boolean;
  onActivate: () => void;
  onMinus: () => void;
  onPlus: () => void;
  locale: Locale;
}) {
  return (
    <div
      className={`flex-1 min-w-0 rounded-xl border bg-white dark:bg-slate-900 shadow-sm transition-all duration-200 overflow-hidden cursor-text ${
        isActive
          ? "border-indigo-400 dark:border-indigo-500 ring-2 ring-indigo-500/15"
          : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
      }`}
      onClick={onActivate}
    >
      <div className="flex items-center">
        <span className="text-[10.5px] font-medium text-slate-400 dark:text-slate-500 whitespace-nowrap shrink-0 pl-2.5">
          {label}
        </span>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onMinus(); }}
          className="shrink-0 p-1.5 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          aria-label={locale === "zh-CN" ? "前一天" : "Previous day"}
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <input
          type="date"
          value={inputValue}
          onChange={(e) => {
            onInputChange(e.target.value);
            onActivate();
          }}
          onFocus={onActivate}
          onBlur={onBlur}
          className="flex-1 min-w-0 px-1 py-2 text-xs font-medium bg-transparent text-slate-700 dark:text-slate-200 outline-none [color-scheme:light] dark:[color-scheme:dark] [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
        />
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onPlus(); }}
          className="shrink-0 p-1.5 mr-0.5 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          aria-label={locale === "zh-CN" ? "后一天" : "Next day"}
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
