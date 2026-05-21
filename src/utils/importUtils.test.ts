import { describe, expect, it } from "vitest";
import {
  parseCsvImport,
  parseJsonImport,
  validateRecord,
  generatePreview,
  filterValidRecords,
} from "./importUtils";
import type { ImportRecord } from "../types";

const validRecord: ImportRecord = {
  app_name: "Chrome",
  app_path: "C:\\Program Files\\Chrome\\chrome.exe",
  window_title: "Docs Draft",
  start_time: "2026-05-15T08:00:00Z",
  end_time: "2026-05-15T08:30:00Z",
  duration_seconds: 1800,
  date: "2026-05-15",
  hour: 8,
};

function buildCsvLine(record: ImportRecord, id: string): string {
  const cols = [
    id,
    record.app_name,
    record.app_path ?? "",
    record.window_title ?? "",
    record.start_time,
    record.end_time,
    String(record.duration_seconds),
    record.date,
    String(record.hour),
  ];
  return cols
    .map((v) => `"${v.replace(/"/g, '""')}"`)
    .join(",");
}

describe("parseCsvImport", () => {
  const header =
    "id,app_name,app_path,window_title,start_time,end_time,duration_seconds,date,hour";

  it("parses a valid CSV file", () => {
    const csv = [
      header,
      buildCsvLine(validRecord, "1"),
      buildCsvLine(
        {
          app_name: "Cursor",
          app_path: null,
          window_title: null,
          start_time: "2026-05-15T08:30:00Z",
          end_time: "2026-05-15T09:00:00Z",
          duration_seconds: 1800,
          date: "2026-05-15",
          hour: 8,
        },
        "2",
      ),
    ].join("\n");

    const result = parseCsvImport(csv);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.records).toHaveLength(2);
      expect(result.records[0]!.app_name).toBe("Chrome");
      expect(result.records[0]!.app_path).toBe(
        "C:\\Program Files\\Chrome\\chrome.exe",
      );
      expect(result.records[1]!.app_name).toBe("Cursor");
      expect(result.records[1]!.app_path).toBeNull();
      expect(result.records[1]!.window_title).toBeNull();
    }
  });

  it("handles escaped double quotes in CSV fields", () => {
    const rec = { ...validRecord, window_title: 'Docs "Draft"' };
    const csv = [header, buildCsvLine(rec, "1")].join("\n");

    const result = parseCsvImport(csv);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.records[0]!.window_title).toBe('Docs "Draft"');
    }
  });

  it("returns error for empty file", () => {
    const result = parseCsvImport("");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("File is empty.");
    }
  });

  it("returns error for invalid header", () => {
    const result = parseCsvImport("bad,header\n");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Invalid CSV header");
    }
  });

  it("returns error for wrong column count", () => {
    const result = parseCsvImport(header + '\n"too","few","columns"\n');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("expected");
    }
  });

  it("skips empty lines", () => {
    const csv = [header, "", buildCsvLine(validRecord, "1"), ""].join("\n");
    const result = parseCsvImport(csv);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.records).toHaveLength(1);
    }
  });

  it("returns error for header-only file", () => {
    const result = parseCsvImport(header);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("No data rows found in file.");
    }
  });

  it("handles CRLF line endings", () => {
    const csv =
      header + "\r\n" + buildCsvLine(validRecord, "1") + "\r\n";
    const result = parseCsvImport(csv);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.records).toHaveLength(1);
    }
  });

  it("handles fields with commas inside quotes", () => {
    const rec = { ...validRecord, window_title: "hello, world" };
    const line = buildCsvLine(rec, "1");
    const csv = [header, line].join("\n");
    const result = parseCsvImport(csv);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.records[0]!.window_title).toBe("hello, world");
    }
  });
});

describe("parseJsonImport", () => {
  it("parses a valid JSON array", () => {
    const json = JSON.stringify([validRecord]);
    const result = parseJsonImport(json);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.records).toHaveLength(1);
      expect(result.records[0]!.app_name).toBe("Chrome");
    }
  });

  it("parses JSON with null fields", () => {
    const rec = { ...validRecord, app_path: null, window_title: null };
    const json = JSON.stringify([rec]);
    const result = parseJsonImport(json);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.records[0]!.app_path).toBeNull();
    }
  });

  it("returns error for invalid JSON", () => {
    const result = parseJsonImport("{bad json");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Invalid JSON format.");
    }
  });

  it("returns error for non-array root", () => {
    const result = parseJsonImport('{"app_name": "test"}');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("JSON root must be an array.");
    }
  });

  it("returns error for empty array", () => {
    const result = parseJsonImport("[]");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("No records found in file.");
    }
  });

  it("returns error for record missing app_name", () => {
    const result = parseJsonImport('[{"start_time": "2026-01-01"}]');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("app_name");
    }
  });

  it("handles missing optional fields with defaults", () => {
    const result = parseJsonImport(
      '[{"app_name":"Test","start_time":"2026-01-01T00:00:00Z","end_time":"2026-01-01T01:00:00Z","duration_seconds":360,"date":"2026-01-01","hour":0}]',
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.records[0]!.app_path).toBeNull();
    }
  });
});

describe("validateRecord", () => {
  it("returns null for valid record", () => {
    expect(validateRecord(validRecord, 0)).toBeNull();
  });

  it("rejects empty app_name", () => {
    const rec = { ...validRecord, app_name: "" };
    expect(validateRecord(rec, 0)).toContain("app_name");
  });

  it("rejects invalid start_time", () => {
    const rec = { ...validRecord, start_time: "not-a-date" };
    expect(validateRecord(rec, 0)).toContain("start_time");
  });

  it("rejects invalid end_time", () => {
    const rec = { ...validRecord, end_time: "bad" };
    expect(validateRecord(rec, 0)).toContain("end_time");
  });

  it("rejects negative duration_seconds", () => {
    const rec = { ...validRecord, duration_seconds: -1 };
    expect(validateRecord(rec, 0)).toContain("duration_seconds");
  });

  it("rejects invalid date format", () => {
    const rec = { ...validRecord, date: "05-15-2026" };
    expect(validateRecord(rec, 0)).toContain("YYYY-MM-DD");
  });

  it("rejects hour out of range", () => {
    const rec = { ...validRecord, hour: 25 };
    expect(validateRecord(rec, 0)).toContain("0-23");
  });
});

describe("generatePreview", () => {
  it("generates preview for valid records", () => {
    const preview = generatePreview([validRecord]);
    expect(preview.totalRecords).toBe(1);
    expect(preview.uniqueApps).toBe(1);
    expect(preview.dateRange).toEqual({
      earliest: "2026-05-15",
      latest: "2026-05-15",
    });
    expect(preview.errors).toHaveLength(0);
  });

  it("collects validation errors (max 10)", () => {
    const bad = { ...validRecord, app_name: "" };
    const records = Array.from({ length: 15 }, () => ({ ...bad }));
    const preview = generatePreview(records);
    expect(preview.errors).toHaveLength(10);
    expect(preview.uniqueApps).toBe(0);
  });

  it("returns null dateRange when all records invalid", () => {
    const preview = generatePreview([{ ...validRecord, app_name: "" }]);
    expect(preview.dateRange).toBeNull();
  });
});

describe("filterValidRecords", () => {
  it("filters out invalid records", () => {
    const bad = { ...validRecord, app_name: "" };
    const filtered = filterValidRecords([validRecord, bad]);
    expect(filtered).toHaveLength(1);
  });
});
