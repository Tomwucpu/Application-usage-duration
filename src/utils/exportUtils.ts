import type { UsageRecord } from "../types";

const EXPORT_COLUMNS: Array<keyof UsageRecord> = [
  "id",
  "app_name",
  "app_path",
  "window_title",
  "start_time",
  "end_time",
  "duration_seconds",
  "date",
  "hour",
];

export type ExportFormat = "csv" | "json";

export function getExportFileName(
  format: ExportFormat,
  date: Date = new Date(),
): string {
  return `usage-export-${date.toISOString().slice(0, 10)}.${format}`;
}

export function buildJsonExport(records: UsageRecord[]): string {
  return JSON.stringify(records, null, 2);
}

export function buildCsvExport(records: UsageRecord[]): string {
  const rows = records.map((record) => buildCsvRow(record));
  return [buildCsvHeader(), ...rows].join("\n");
}

export function buildCsvHeader(): string {
  return EXPORT_COLUMNS.join(",");
}

export function buildCsvRow(record: UsageRecord): string {
  return EXPORT_COLUMNS.map((column) => {
    const value = record[column];
    if (value === null || value === undefined) {
      return '""';
    }
    const escaped = String(value).replace(/"/g, '""');
    return `"${escaped}"`;
  }).join(",");
}
