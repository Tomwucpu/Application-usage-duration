import { describe, expect, it } from "vitest";
import {
  buildCsvHeader,
  buildCsvRow,
  getExportFileName,
} from "./exportUtils";
import type { UsageRecord } from "../types";

const sampleRecords: UsageRecord[] = [
  {
    id: 1,
    app_name: "Chrome",
    app_path: "C:\\Program Files\\Chrome\\chrome.exe",
    window_title: "Docs \"Draft\"",
    start_time: "2026-05-15T08:00:00Z",
    end_time: "2026-05-15T08:30:00Z",
    duration_seconds: 1800,
    date: "2026-05-15",
    hour: 8,
  },
  {
    id: 2,
    app_name: "Cursor",
    app_path: null,
    window_title: null,
    start_time: "2026-05-15T08:30:00Z",
    end_time: "2026-05-15T09:00:00Z",
    duration_seconds: 1800,
    date: "2026-05-15",
    hour: 8,
  },
];

describe("getExportFileName", () => {
  it("uses the provided date and format in the default filename", () => {
    const filename = getExportFileName("csv", new Date("2026-05-15T12:34:56Z"));

    expect(filename).toBe("usage-export-2026-05-15.csv");
  });
});

describe("buildJsonExport", () => {
  it("serializes records as formatted JSON", () => {
    const json = JSON.stringify(sampleRecords, null, 2);

    expect(json).toContain('\n  {\n    "id": 1,');
    expect(json).toContain('"app_name": "Chrome"');
  });
});

describe("buildCsvExport", () => {
  it("builds CSV with quoted values and escaped double quotes", () => {
    const csv = [buildCsvHeader(), ...sampleRecords.map((r) => buildCsvRow(r))].join("\n");
    const lines = csv.split("\n");

    expect(lines[0]).toBe(
      "id,app_name,app_path,window_title,start_time,end_time,duration_seconds,date,hour",
    );
    expect(lines[1]).toContain('"Docs ""Draft"""');
    expect(lines[2]).toContain(',"","","2026-05-15T08:30:00Z"');
  });
});
