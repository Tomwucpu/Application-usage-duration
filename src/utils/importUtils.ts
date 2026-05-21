import type { UsageRecord, ImportRecord, ImportPreview } from "../types";

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

type ParseResult =
  | { ok: true; records: ImportRecord[] }
  | { ok: false; error: string };

export async function parseImportFile(file: File): Promise<ParseResult> {
  const name = file.name.toLowerCase();
  if (!name.endsWith(".csv") && !name.endsWith(".json")) {
    return { ok: false, error: "Invalid file format. Expected CSV or JSON." };
  }

  const text = await readFileAsText(file);
  if (text === null) {
    return { ok: false, error: "Failed to read file." };
  }

  if (name.endsWith(".csv")) {
    return parseCsvImport(text);
  }
  return parseJsonImport(text);
}

function readFileAsText(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => resolve(null);
    reader.readAsText(file);
  });
}

export function parseCsvImport(text: string): ParseResult {
  const lines = splitCsvLines(text);
  if (lines.length === 0) {
    return { ok: false, error: "File is empty." };
  }

  const headerLine = lines[0]!;
  const headerCells = parseCsvLine(headerLine);
  const expectedHeader = EXPORT_COLUMNS.join(",");
  if (headerCells.join(",") !== expectedHeader) {
    return {
      ok: false,
      error: `Invalid CSV header. Expected: ${expectedHeader}`,
    };
  }

  const records: ImportRecord[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.trim() === "") continue;
    const cells = parseCsvLine(line);
    if (cells.length !== EXPORT_COLUMNS.length) {
      return {
        ok: false,
        error: `Line ${i + 1}: expected ${EXPORT_COLUMNS.length} columns, got ${cells.length}.`,
      };
    }
    // Cell order matches EXPORT_COLUMNS: id(0), app_name(1), app_path(2), ...
    records.push({
      app_name: cells[1]!,
      app_path: cells[2] === "" ? null : cells[2]!,
      window_title: cells[3] === "" ? null : cells[3]!,
      start_time: cells[4]!,
      end_time: cells[5]!,
      duration_seconds: parseInt(cells[6]!, 10) || 0,
      date: cells[7]!,
      hour: parseInt(cells[8]!, 10) || 0,
    });
  }

  if (records.length === 0) {
    return { ok: false, error: "No data rows found in file." };
  }

  return { ok: true, records };
}

function splitCsvLines(text: string): string[] {
  const lines: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (ch === '"') {
      inQuotes = !inQuotes;
    }
    if (ch === "\n" && !inQuotes) {
      if (current.endsWith("\r")) current = current.slice(0, -1);
      lines.push(current);
      current = "";
      continue;
    }
    if (ch === "\r" && !inQuotes) {
      continue;
    }
    current += ch;
  }
  if (current.length > 0) {
    if (current.endsWith("\r")) current = current.slice(0, -1);
    lines.push(current);
  }
  return lines;
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        cells.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  cells.push(current);
  return cells;
}

export function parseJsonImport(text: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: "Invalid JSON format." };
  }

  if (!Array.isArray(data)) {
    return { ok: false, error: "JSON root must be an array." };
  }

  if (data.length === 0) {
    return { ok: false, error: "No records found in file." };
  }

  const records: ImportRecord[] = [];
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    if (!item || typeof item !== "object") {
      return { ok: false, error: `Record ${i + 1}: not a valid object.` };
    }
    const obj = item as Record<string, unknown>;
    const appName = obj["app_name"];
    if (typeof appName !== "string" || appName.trim() === "") {
      return {
        ok: false,
        error: `Record ${i + 1}: missing or invalid "app_name".`,
      };
    }
    records.push({
      app_name: appName,
      app_path:
        obj["app_path"] && typeof obj["app_path"] === "string"
          ? obj["app_path"]
          : null,
      window_title:
        obj["window_title"] && typeof obj["window_title"] === "string"
          ? obj["window_title"]
          : null,
      start_time: String(obj["start_time"] ?? ""),
      end_time: String(obj["end_time"] ?? ""),
      duration_seconds:
        typeof obj["duration_seconds"] === "number"
          ? obj["duration_seconds"]
          : parseInt(String(obj["duration_seconds"] ?? "0"), 10) || 0,
      date: String(obj["date"] ?? ""),
      hour:
        typeof obj["hour"] === "number"
          ? obj["hour"]
          : parseInt(String(obj["hour"] ?? "0"), 10) || 0,
    });
  }

  return { ok: true, records };
}

export function validateRecord(
  record: ImportRecord,
  index: number,
): string | null {
  if (!record.app_name || record.app_name.trim() === "") {
    return `Record ${index + 1}: app_name is required.`;
  }
  if (!record.start_time || isNaN(Date.parse(record.start_time))) {
    return `Record ${index + 1}: invalid start_time "${record.start_time}".`;
  }
  if (!record.end_time || isNaN(Date.parse(record.end_time))) {
    return `Record ${index + 1}: invalid end_time "${record.end_time}".`;
  }
  if (
    typeof record.duration_seconds !== "number" ||
    isNaN(record.duration_seconds) ||
    record.duration_seconds < 0
  ) {
    return `Record ${index + 1}: invalid duration_seconds.`;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(record.date)) {
    return `Record ${index + 1}: date must be YYYY-MM-DD format.`;
  }
  if (
    typeof record.hour !== "number" ||
    isNaN(record.hour) ||
    record.hour < 0 ||
    record.hour > 23
  ) {
    return `Record ${index + 1}: hour must be 0-23.`;
  }
  return null;
}

export function generatePreview(records: ImportRecord[]): ImportPreview {
  const errors: string[] = [];
  const appNames = new Set<string>();
  let earliest: string | null = null;
  let latest: string | null = null;

  for (let i = 0; i < records.length; i++) {
    const err = validateRecord(records[i]!, i);
    if (err) {
      if (errors.length < 10) {
        errors.push(err);
      }
    } else {
      appNames.add(records[i]!.app_name);
      if (earliest === null || records[i]!.date < earliest) {
        earliest = records[i]!.date;
      }
      if (latest === null || records[i]!.date > latest) {
        latest = records[i]!.date;
      }
    }
  }

  return {
    totalRecords: records.length,
    dateRange:
      earliest && latest ? { earliest, latest } : null,
    uniqueApps: appNames.size,
    errors,
  };
}

export function filterValidRecords(records: ImportRecord[]): ImportRecord[] {
  return records.filter((r, i) => validateRecord(r, i) === null);
}
