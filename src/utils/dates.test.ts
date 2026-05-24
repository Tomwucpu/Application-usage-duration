import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  fmtLocalDate,
  getBreakdownRange,
  getDateList,
  getMonthRange,
  getWeekRange,
  parseDate,
  shiftCalendarMonth,
} from "./dates";

describe("fmtLocalDate and parseDate", () => {
  it("round-trips YYYY-MM-DD values in local time", () => {
    expect(fmtLocalDate(parseDate("2026-05-24"))).toBe("2026-05-24");
  });
});

describe("addDays", () => {
  it("moves across month boundaries", () => {
    expect(addDays("2026-05-31", 1)).toBe("2026-06-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("addMonths", () => {
  it("clamps invalid month-end dates", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2024-01-31", 1)).toBe("2024-02-29");
    expect(addMonths("2026-03-31", -1)).toBe("2026-02-28");
  });
});

describe("shiftCalendarMonth", () => {
  it("moves visible calendar months to the first day", () => {
    expect(fmtLocalDate(shiftCalendarMonth(parseDate("2026-05-24"), 1))).toBe("2026-06-01");
  });
});

describe("getWeekRange", () => {
  it("uses Monday to Sunday ranges", () => {
    expect(getWeekRange("2026-05-18")).toEqual({ start: "2026-05-18", end: "2026-05-24" });
    expect(getWeekRange("2026-05-24")).toEqual({ start: "2026-05-18", end: "2026-05-24" });
  });
});

describe("getMonthRange", () => {
  it("returns the first and last day of the month", () => {
    expect(getMonthRange("2026-02-10")).toEqual({ start: "2026-02-01", end: "2026-02-28" });
  });
});

describe("getBreakdownRange", () => {
  it("maps each view mode to the expected range", () => {
    expect(getBreakdownRange("daily", "2026-05-24", null, null)).toEqual({
      start: "2026-05-18",
      end: "2026-05-24",
    });
    expect(getBreakdownRange("weekly", "2026-05-24", null, null)).toEqual({
      start: "2026-05-18",
      end: "2026-05-24",
    });
    expect(getBreakdownRange("monthly", "2026-05-24", null, null)).toEqual({
      start: "2026-05-01",
      end: "2026-05-31",
    });
    expect(getBreakdownRange("custom", "2026-05-24", "2026-05-01", "2026-05-15")).toEqual({
      start: "2026-05-01",
      end: "2026-05-15",
    });
    expect(getBreakdownRange("custom", "2026-05-24", null, null)).toBeNull();
  });
});

describe("getDateList", () => {
  it("builds inclusive date lists with stable date keys", () => {
    const dates = getDateList("2026-05-18", "2026-05-20", "en-US", { weekday: "short" });

    expect(dates.map((item) => item.date)).toEqual([
      "2026-05-18",
      "2026-05-19",
      "2026-05-20",
    ]);
    expect(dates.every((item) => item.label.length > 0)).toBe(true);
  });
});
