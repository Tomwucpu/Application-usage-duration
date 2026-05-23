# AGENTS.md

Tauri 2 desktop app — Windows foreground app usage tracker with React 18 + Recharts + Zustand frontend and Rust + SQLite backend.

## Commands

```bash
npm run dev          # Vite only (no Rust), port 1420 strict
npm run tauri dev    # Full app (Vite + Tauri window)
npm run build        # tsc type-check then vite build (MUST pass tsc to succeed)
npm run test         # Vitest (2 test files: exportUtils.test.ts, importUtils.test.ts)
cargo test           # Rust tests (run inside src-tauri/; 5 tests in tracker.rs only, no DB tests)
```

## Component directory structure

Page files at root, sub-components grouped by page:

```
src/components/
├── Dashboard.tsx              (page, lazy-loaded)
├── SettingsPage.tsx           (page, lazy-loaded)
├── StackedBarChart.tsx        (page, lazy-loaded from Dashboard)
├── AppNames.ts                (getDisplayName / setDisplayNames — global alias resolver)
├── appManagement/             AppManagement.tsx (page, lazy-loaded), AppTable.tsx
├── dashboard/                 AppRanking.tsx, DatePicker.tsx
├── breakdown/                 DateRangePicker.tsx
├── settings/                  DataIO.tsx, IdleThreshold.tsx, IgnoredApps.tsx, ImportDialog.tsx, LanguageSwitcher.tsx, Retention.tsx, UpdateChecker.tsx
└── shared/                    ConfirmDialog.tsx, DataTable.tsx, InfoTooltip.tsx, ToastStack.tsx
```

## Frontend gotchas

### Date handling — NEVER use `toISOString()`
`toISOString()` converts to UTC, shifting dates by timezone offset. Always use local-time formatting:
```ts
// BAD: d.toISOString().slice(0, 10)
// GOOD:
const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,"0"), day = String(d.getDate()).padStart(2,"0");
`${y}-${m}-${day}`
```
Both `Dashboard.tsx` and `StackedBarChart.tsx` define their own `fmtLocalDate` helper — keep them in sync.

**Three known `toISOString()` violations in `useStore.ts`:**
1. `setViewMode` (line 280-281) — defaults custom range to last 7 days
2. `getWeekRange` / `getMonthRange` (lines 132, 140) — called by `refresh()` on every view-mode change
3. `selectedDate` initial value (line 154) — app startup default date

All three produce off-by-one near midnight. `Dashboard.tsx` defines its own safe `getWeekRange`/`getMonthRange` (lines 42-58) using `fmtLocalDate`, so the UI displays correctly, but the store's internal range calculations can produce incorrect date boundaries that affect which data gets fetched.

### Duplicated date helpers
`getWeekRange` and `getMonthRange` exist in both `useStore.ts` and `Dashboard.tsx`. The store versions use `toISOString()` (unsafe); the Dashboard versions use `fmtLocalDate` (safe). Keep these in sync if modified — or better, deduplicate into a shared utility.

### API layer inconsistency
`useStore.ts` exports a named `api` object wrapping `invoke` with baseline performance logging (enabled only on `localhost`). Use `api.getSetting`/`api.setSetting` for settings. HOWEVER, most data-fetching invoke calls (`setDate`, `refresh`, `loadHourlyBreakdown`, `loadRangeBreakdown`, `init`) bypass `api` and call raw `invoke()` directly. The `api` wrapper is only used for settings, icons, app names, and record import/export.

### Store caching quirk
`loadRangeBreakdown` in `useStore.ts` only skips fetch when `rangeBreakdown.length > 0` (alongside range match). An empty-result range is NOT cached and will refetch on every invocation. Check `rangeBreakdownRange` (non-null = loaded) to distinguish "loading" from "loaded but empty".

### `ensureAppIconsLoaded` stale-closure race
Reads `state.appIcons` via `get()`, awaits `Promise.all([api.getAllAppIcons(), api.getAppDisplayNames()])`, then shallow-merges with the snapshot. If called concurrently (e.g. `refresh()` + `ImportDialog` post-import), the later `set()` can overwrite icons fetched by an earlier call. Low risk in practice but worth noting.

### Chart behavior
- `StackedBarChart` `customDates` generates ALL dates between start/end, not just dates found in data. Zero-value bars render for empty days.
- `BarChart` key includes `customStartDate`/`customEndDate` to trigger re-animation on range change.
- The `hasEntries` check (line ~308) gates on `chartData.length > 0`, NOT on any bar having >0 value. This ensures empty ranges show 0 bars instead of "No data".

### Rendering empty data
`Dashboard.tsx` `displaySummary` returns `{ total_seconds: 0, apps: [], hourly: [] }` when range data is loaded-but-empty, and `null` only when unloaded. Summary cards, chart, and `AppRanking` all receive this empty object — AppRanking handles `apps.length === 0` internally with a "No data" message.

### Dark mode
Controlled by `dark` class on `document.documentElement`. Store sets `localStorage("theme")` + toggles classList. Tailwind `darkMode: "class"`.

### Routing
No React Router. `App.tsx` uses `useState<View>` ("dashboard" | "settings" | "appManagement"). All "page" components are `React.lazy()`.

### i18n type casting
The `useT()` hook returns `t: (key: keyof Translations) => string` (strict literal keys). When passing `t` to a child component that declares `t: (key: string) => string`, cast at the call site: `t={t as (key: string) => string}`. Otherwise strict mode rejects the assignment due to parameter contravariance.
Note: `Translations` is `typeof zhCN` — `zh-CN.json` defines the canonical key set. Extra keys in `en-US.json` are silently inaccessible.

### Import data flow
- `parseImportFile` in `importUtils.ts` handles both CSV and JSON auto-detected by extension. CSV parsing handles RFC 4180 quoted fields with escaped quotes.
- `validateRecord` checks 6 rules (required app_name, parseable start/end_time, non-negative duration_seconds, YYYY-MM-DD date, hour 0-23). All I/O is frontend-only until `api.importRecordsBatch()`.
- After successful import, `ImportDialog` calls `useStore.getState().ensureAppIconsLoaded(true)` to force-refresh icons for imported apps.
- `api.importRecordsBatch` expects `ImportRecord[]` (no `id` field) — the frontend strips `id` during parsing.

### AppManagement refresh — CRITICAL: must NOT unmount AppTable
`AppManagement.tsx` uses `initialLoading` (not `loading`). The initial mount shows a loading overlay and `AppTable` is not rendered. Once data is fetched, `initialLoading` is permanently `false` and `AppTable` stays mounted. On subsequent refreshes (edit alias, delete, reset), `fetchData` updates `data` but never unmounts `AppTable`.

If you change this to toggle a `loading` state, `AppTable` will unmount/remount on every refresh, resetting all internal state (page number, sort order, page size).

**Related:** `DataTable.tsx` internal `currentPage` state is preserved across `data` prop changes and only clamps via `safePage = Math.min(currentPage, totalPages)` when data shrinks. Changes to `pageSize` from the parent's `onPageSizeChange` also preserve the current page.

### App display name — global alias resolver
`AppNames.ts` exposes `getDisplayName(appName)` which reads a module-level `_names` cache populated by `setDisplayNames(names)`. `App.tsx` subscribes to `useStore.displayNames` and calls `setDisplayNames()` on change. This means:
- `AppRanking.tsx`, `StackedBarChart.tsx`, `IgnoredApps.tsx` all import and use `getDisplayName()` for visible app name rendering
- The display name alias is NOT stored locally — it comes from the store, which fetches it from `app_metadata.display_name` on the Rust side
- `ensureAppIconsLoaded` now also fetches display names in parallel via `api.getAppDisplayNames()`

### AppTable inline editing
- `EditableCell` component handles click-to-edit for both display_name and icon_path columns
- On save failure, the cell stays in editing mode (doesn't revert or close)
- When the user edits display_name to match the original `app_name`, `handleSaveDisplayName` automatically calls `resetAppDisplayName` instead (avoids storing redundant alias)
- The "app_name" column in the table shows `display_name || app_name` as default value
- Reset button (×) only appears on hover when a custom value is set

### AppTable search + sort + pagination
- Search filters by `app_name.toLowerCase().includes(q) || display_name.toLowerCase().includes(q)`
- Sort by display_name sorts by `display_name || app_name` (localeCompare)
- Sort by total_seconds sorts numerically
- Pagination: default 10/page, options 10/20/30, controlled by parent `pageSize` state
- Empty text differs: `noResults` when search active, `noData` when list is empty

## Rust / Tauri gotchas

### Windows-only
`tracker.rs` and `icon.rs` have `#[cfg(target_os = "windows")]` implementations and `#[cfg(not(...))]` stubs returning `None`. The app compiles on macOS but won't track.

### DB connection
Single `Mutex<Connection>` — all DB operations must serialize through it. No connection pool.

### Settings table
Key-value store. Known keys: `locale`, `retention_days` (0 = keep forever), `ignored_apps` (JSON array), `ignored_apps_enabled` ("true"/"false"), `afk_threshold_seconds` (seconds as string, default 300 = 5 min).

### AFK threshold — configurable
The AFK threshold is no longer hardcoded. `tracker.rs` reads `afk_threshold_seconds` from the settings table at tracking start, defaulting to 300 if unset. The `IdleThreshold` component in SettingsPage lets users choose presets (5/10/15/30 min) or a custom value. The threshold is read once when tracking starts — changing it requires pausing/resuming tracking to take effect.

### Tray close behavior
`WindowEvent::CloseRequested` calls `api.prevent_close()` + `window.hide()`. User must quit via tray menu or `Ctrl+C` in dev.

### Tracker lock scope — CRITICAL
`get_process_info_by_hwnd()` must be called **before** `state.lock()`, not inside it (tracker.rs:498-504 in `process_foreground_change`). When the tracker app itself is foreground, `GetWindowTextW` sends synchronous `WM_GETTEXT` to the main thread. If called inside the lock, the main thread's invoke processing can block on `db.conn` while the tracking thread holds `state.lock()` waiting for the main thread — causing refresh to hang indefinitely.

**Related:** `db.get_today_total_seconds()` at tracker.rs:685 (in `update_today_and_emit`) is called while `state.lock()` is held. This means the DB lock is acquired inside the tracker state lock. Currently safe because Tauri invoke commands never touch tracker state, but any code that acquires both locks must respect this ordering (`state.lock()` → `db.conn.lock()`).

### `import_records_batch` — param count
The dedup `SELECT` SQL uses 8 placeholders (`?1`-`?8`). Each `?N` placeholder that appears multiple times in SQL (e.g., `?2` in both sides of an OR) must be bound **once** in `params![]`. Passing extra params causes rusqlite errors at runtime (rejects silently, rolls back).

### `import_records_batch` — Mutex deadlock avoidance
After `COMMIT`, `drop(conn)` before calling `upsert_app_metadata`. `upsert_app_metadata` also acquires `self.conn.lock()`, and holding the lock from the batch method across both calls would deadlock (same-thread Mutex re-entry on `std::sync::Mutex`).

### App metadata population
`import_records_batch` writes `app_metadata` for imported apps with non-null `app_path`. This allows `get_all_app_icons` to find and extract icons. Icons only appear if the `app_path` exists on the current machine (same install path as exporting machine).

### App metadata columns — new fields
`app_metadata` table now has 5 columns: `app_name` (PK), `app_path` (exe path for icon extraction), `display_name` (user alias, nullable), `custom_icon_path` (user override icon path, nullable), `default_icon_path` (auto-extracted icon path, nullable). Migration via `ALTER TABLE ADD COLUMN` in `Database::new()`.

### Icon resolution priority
`get_all_app_icons` resolves icons in order: `custom_icon_path` > `default_icon_path` > exe extraction from `app_path`. Each path is passed through `IconCache.get_or_extract()` which handles base64 PNG caching in memory (max 200).

### `delete_records_by_app` — full cleanup
Deletes from BOTH `usage_records` AND `app_metadata` for the given app. Also invalidates the metadata cache. After deletion, the app disappears from `get_all_app_metadata_list` entirely. It will be re-inserted into `app_metadata` via `upsert_app_metadata` if tracked again.

### App management Tauri commands
Commands added: `get_all_app_metadata_list`, `set_app_display_name`, `set_app_custom_icon`, `reset_app_display_name`, `reset_app_custom_icon`, `delete_records_by_app`, `rename_app`, `get_app_display_names`. All accept `app_name: String` as primary param. None interact with tracker state (safe for db lock ordering).

### Rust tests
Only `tracker.rs` has tests (5 tests for `should_ignore_app_from_settings`). No DB-level tests — `cargo test` does not exercise SQLite logic.

## CI

Single workflow (`release.yml`), triggered on `v*` tags only. `windows-latest` runner. Runs `npm run build` (which includes `tsc` type-check) + `cargo check`, then `tauri-action`. **No tests run in CI** — neither `npm run test` nor `cargo test` are executed. `tsc` is the only automated quality gate.

## Type constraints

- `tsconfig.json` strict mode ON: `noUnusedLocals`, `noUnusedParameters` both true. Unused imports/vars fail `npm run build`.
- The `UsageRecord` interface is defined once in `src/types/index.ts` and must match the Rust struct in `db.rs`. `ImportRecord` (same fields minus `id`) mirrors Rust's `ImportRecord`.
- The `AppMetadataItem` interface in `src/types/index.ts` must match the Rust struct in `db.rs` (fields: app_name, app_path, display_name, custom_icon_path, default_icon_path, total_seconds, record_count).

## View modes

`ViewMode = "daily" | "weekly" | "monthly" | "custom"`. Switching to `"custom"` auto-defaults to last 7 days if no `customStartDate`/`customEndDate` set. `setCustomRange` auto-swaps if start > end.

## DateRangePicker

Lives in `StackedBarChart` (shown when `viewMode === "custom"`), NOT in Dashboard's date area. User clicks presets or opens a popover with start/end `<input type="date">` fields + single-month calendar. Calendar clicks update only the active field (start or end), toggled by clicking the label/input.
