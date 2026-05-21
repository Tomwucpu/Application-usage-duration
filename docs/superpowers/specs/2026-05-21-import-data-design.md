# Import Data Feature — Design Spec

**Date**: 2026-05-21
**Status**: Draft

## Overview

Add an "Import Data" feature to the Settings page, allowing users to import previously exported CSV or JSON files. The import includes validation, duplicate detection (skip exact duplicates), a preview dialog, a progress bar, and a results summary.

## Requirements

1. **File formats**: Support both CSV and JSON (same format as export produces).
2. **Deduplication**: Skip records that already exist in the database (match all 8 non-id fields: `app_name`, `app_path`, `window_title`, `start_time`, `end_time`, `duration_seconds`, `date`, `hour`). Ignore the `id` field from the import file — SQLite assigns new auto-increment IDs.
3. **UX flow**: File picker → validation → preview dialog → progress bar → results summary.
4. **Performance**: Batch insert in SQLite transactions, chunked at 500 records per batch. Progress bar updates after each chunk.
5. **Error handling**: Per-record validation with usable error messages. File-level validation (extension, parseability, required fields). Graceful failure with toast notifications.

## Architecture

### High-Level Flow

```
[Import Data button] → showOpenFilePicker (.csv/.json)
    → read file → parse (importUtils.ts)
    → validation → errors? → toast + abort
    → open ImportDialog with preview (record count, date range, app count)
        → [Cancel] closes dialog
        → [Import] → progress bar (chunked invoke calls) → results (imported / skipped)
```

### What's New

| Layer | File | Purpose |
|-------|------|---------|
| **Frontend** | `src/utils/importUtils.ts` | Parse CSV/JSON, validate records, generate preview summary |
| **Frontend** | `src/utils/importUtils.test.ts` | Unit tests for parsing and validation |
| **Frontend** | `src/components/ImportDialog.tsx` | Modal dialog: preview step → progress step → results step |
| **Frontend** | `src/components/SettingsPage.tsx` | New "Data Import" section with button (below Export section) |
| **Rust** | `src-tauri/src/db.rs` | `import_records_batch()` method — transactional batch insert with dedup |
| **Rust** | `src-tauri/src/lib.rs` | Register `import_records_batch` Tauri command |
| **Store** | `src/stores/useStore.ts` | `api.importRecordsBatch()` wrapper |
| **i18n** | `src/i18n/en-US.json`, `src/i18n/zh-CN.json` | Translation keys for all import UI strings |

## Detailed Design

### 1. Frontend: `src/utils/importUtils.ts`

New utility module with these exports:

```ts
export interface ImportPreview {
  totalRecords: number;
  dateRange: { earliest: string; latest: string };
  uniqueApps: number;
  errors: string[];
}

export function parseImportFile(file: File): Promise<UsageRecord[]>;
export function parseCsvImport(text: string): UsageRecord[];
export function parseJsonImport(text: string): UsageRecord[];
export function generatePreview(records: UsageRecord[]): ImportPreview;
export function validateRecord(record: unknown, index: number): string | null;
```

- `parseImportFile`: Reads file via `FileReader`, detects format by extension/content, delegates to `parseCsvImport` or `parseJsonImport`.
- `parseCsvImport`: Splits by lines, expects header row matching `EXPORT_COLUMNS.join(",")`, parses each data row. Handles quoted fields with escaped quotes per RFC 4180.
- `parseJsonImport`: `JSON.parse()`, expects array of objects with correct field names.
- `validateRecord`: Checks `app_name` is non-empty string, `start_time`/`end_time` are parseable datetimes, `duration_seconds` is a non-negative integer, `hour` is 0-23, `date` is YYYY-MM-DD format.
- `generatePreview`: Returns total record count, earliest/latest date, distinct app count, validation error list (first 10, with line numbers).

### 2. Frontend: `src/components/ImportDialog.tsx`

A modal dialog with three steps:

**Step 1 — Preview**:
- "X records found" with date range and app count
- Validation errors (if any) shown with warning styling
- [Cancel] and [Import X Records] buttons
- If errors exist, Import button still works but records with errors are skipped

**Step 2 — Progress**:
- Progress bar (percentage + "Processing X of Y records")
- No cancel during import (transaction integrity)

**Step 3 — Results**:
- "X records imported successfully"
- "Y records skipped (already exist or invalid)"
- [Close] button

State management: internal `useState` for `step`, `progress`, `results`. The dialog receives `records: UsageRecord[]` and `onClose` callback.

### 3. Frontend: SettingsPage.tsx changes

Add a new "Data Import" section below the existing "Data Export" section (between line 419 and the Retention section divider). It contains:

- Section header with an upload/import icon and "Data Import" title
- "Import Data" button styled like the export buttons
- Click handler: opens `showOpenFilePicker` for `.csv`/`.json`, reads file, parses, validates, opens `ImportDialog`
- For unsupported browsers (no `showOpenFilePicker`), falls back to a hidden `<input type="file">` element

### 4. Rust: `db.rs` — `import_records_batch()`

```rust
pub struct ImportRecord {
    pub app_name: String,
    pub app_path: Option<String>,
    pub window_title: Option<String>,
    pub start_time: String,
    pub end_time: String,
    pub duration_seconds: i64,
    pub date: String,
    pub hour: i32,
}

pub struct ImportBatchResult {
    pub imported: i32,
    pub skipped: i32,
}

pub fn import_records_batch(&self, records: &[ImportRecord]) -> Result<ImportBatchResult, String>
```

Implementation:
1. Acquires mutex lock on connection.
2. Begins transaction (`conn.execute("BEGIN IMMEDIATE", [])`).
3. Prepares two statements:
   - A `SELECT COUNT(*)` with WHERE matching all 8 non-id fields, handling NULL-safe comparison for `app_path` and `window_title` via `IS NOT DISTINCT FROM` (SQLite doesn't support this natively, so use `(col = ? OR (col IS NULL AND ? IS NULL))`).
   - An `INSERT INTO usage_records (app_name, app_path, ...) VALUES (?1, ...)`.
4. For each record: runs the SELECT; if count = 0, runs INSERT and increments `imported`; otherwise increments `skipped`.
5. Commits transaction on success, rolls back on error.
6. Returns `ImportBatchResult`.

Performance: With a transaction wrapping all records in the batch, SQLite amortizes writes. 500 records per batch keeps the mutex lock time reasonable.

### 5. Rust: `lib.rs` changes

```rust
#[tauri::command]
fn import_records_batch(
    records: Vec<ImportRecord>,
    db: tauri::State<Arc<Database>>,
) -> Result<ImportBatchResult, String> {
    db.import_records_batch(&records)
}
```

Register in `generate_handler![]`.

### 6. Store: `useStore.ts` changes

```ts
importRecordsBatch: (records: ImportRecord[]) => {
  return invoke<ImportBatchResult>("import_records_batch", { records });
}
```

Where `ImportRecord` is the TypeScript type matching the Rust struct (no `id` field).

### 7. i18n keys

English (`en-US.json`):
```json
{
  "settings.import.title": "Data Import",
  "settings.import.button": "Import Data",
  "settings.import.dialog.title": "Import Preview",
  "settings.import.preview.records": "{{count}} records found",
  "settings.import.preview.dateRange": "Date range: {{start}} to {{end}}",
  "settings.import.preview.apps": "{{count}} unique apps",
  "settings.import.preview.errors": "{{count}} records have errors",
  "settings.import.importing": "Importing...",
  "settings.import.progress": "Processing {{current}} of {{total}}",
  "settings.import.result.success": "{{imported}} records imported successfully",
  "settings.import.result.skipped": "{{skipped}} records skipped (duplicates or errors)",
  "settings.import.failed": "Import failed. Please check the file format.",
  "settings.import.cancelled": "Import cancelled.",
  "settings.import.unsupported": "Your browser does not support file import.",
  "settings.import.invalidFormat": "Invalid file format. Expected CSV or JSON."
}
```

Chinese (`zh-CN.json`): corresponding translations.

### 8. TypeScript types

Add to `src/types/index.ts`:
```ts
export interface ImportRecord {
  app_name: string;
  app_path: string | null;
  window_title: string | null;
  start_time: string;
  end_time: string;
  duration_seconds: number;
  date: string;
  hour: number;
}

export interface ImportBatchResult {
  imported: number;
  skipped: number;
}
```

## Error Handling

| Scenario | Handling |
|----------|----------|
| Browser lacks `showOpenFilePicker` | Toast "unsupported", abort |
| User cancels file picker | Toast "cancelled" (info), abort |
| File has wrong extension | Toast "invalid format", abort |
| CSV/JSON parse error | Toast "invalid format" with error detail as title |
| Validation errors in some records | Show in preview, skip those records on import |
| All records fail validation | Show error, disable Import button |
| Rust command fails | Toast "import failed", dialog closes |
| Network/Tauri IPC error | Toast "import failed" |

## Edge Cases

- **Empty file**: Preview shows "0 records found". Import button disabled.
- **All records are duplicates**: All skipped. Results show 0 imported, all skipped.
- **Very large files**: Chunked at 500 per batch. Mutex lock released between batches. Progress bar shows realistic progress.
- **Import during active tracking**: Safe — tracker inserts use separate INSERT calls; transaction locks are brief.
- **Field order in CSV**: Must match `EXPORT_COLUMNS` header exactly. Column order matters for CSV (positional). JSON is field-name based so order doesn't matter.
