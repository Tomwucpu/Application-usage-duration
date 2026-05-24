import type { Locale } from "../i18n";
import type { ViewMode } from "../types";

export interface DateRange {
  start: string;
  end: string;
}

export interface DateListItem {
  date: string;
  label: string;
}

interface DateListOptions {
  weekday?: "short" | "long";
  month?: "numeric" | "short" | "long";
  day?: "numeric" | "2-digit";
}

export function fmtLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function getTodayString(): string {
  return fmtLocalDate(new Date());
}

export function addDays(value: string, days: number): string {
  const date = parseDate(value);
  date.setDate(date.getDate() + days);
  return fmtLocalDate(date);
}

export function addMonths(value: string, months: number): string {
  const [year, month, day] = value.split("-").map(Number);
  const target = new Date(year, month - 1 + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDay));
  return fmtLocalDate(target);
}

export function shiftCalendarMonth(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

export function getWeekRange(dateStr: string): DateRange {
  const date = parseDate(dateStr);
  const dayOfWeek = date.getDay();
  const offsetToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(date);
  monday.setDate(date.getDate() + offsetToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: fmtLocalDate(monday), end: fmtLocalDate(sunday) };
}

export function getMonthRange(dateStr: string): DateRange {
  const date = parseDate(dateStr);
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { start: fmtLocalDate(first), end: fmtLocalDate(last) };
}

export function getBreakdownRange(
  viewMode: ViewMode,
  selectedDate: string,
  customStartDate: string | null,
  customEndDate: string | null,
): DateRange | null {
  if (viewMode === "daily" || viewMode === "weekly") {
    return getWeekRange(selectedDate);
  }
  if (viewMode === "monthly") {
    return getMonthRange(selectedDate);
  }
  if (customStartDate && customEndDate) {
    return { start: customStartDate, end: customEndDate };
  }
  return null;
}

export function getDateList(
  start: string,
  end: string,
  locale: Locale,
  options: DateListOptions = {},
): DateListItem[] {
  const formatter = new Intl.DateTimeFormat(locale, {
    weekday: options.weekday,
    month: options.month ?? "numeric",
    day: options.day ?? "numeric",
  });
  const dates: DateListItem[] = [];
  const cursor = parseDate(start);
  const last = parseDate(end);

  while (cursor <= last) {
    dates.push({
      date: fmtLocalDate(cursor),
      label: formatter.format(cursor),
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}
