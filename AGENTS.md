# AGENTS.md

Tauri 2 desktop app — Windows foreground app usage tracker with React 18 + Recharts + Zustand frontend and Rust + SQLite backend.

## Commands

```bash
npm run dev          # Vite only (no Rust), port 1420 strict
npm run tauri dev    # Full app (Vite + Tauri window)
npm run build        # tsc type-check then vite build (MUST pass tsc to succeed)
npm run test         # Vitest (6 test files: 2 in utils/, 2 in components/, 2 in stores/)
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
├── CategoryIcons.tsx          (getCategoryAssetSrc — resolves category icon paths)
├── appManagement/             AppManagement.tsx (page, lazy-loaded), AppTable.tsx
├── categoryManagement/        CategoryManagement.tsx (page, lazy-loaded), CategoryTable.tsx, CreateCategoryDialog.tsx, CategoryIconPicker.tsx
├── dashboard/                 AppRanking.tsx, DatePicker.tsx, DateNavigator.tsx, filterDashboardItems.ts
├── breakdown/                 DateRangePicker.tsx
├── settings/                  DataIO.tsx, IdleThreshold.tsx, IgnoredApps.tsx, ImportDialog.tsx, LanguageSelect.tsx, Retention.tsx, UpdateChecker.tsx
└── shared/                    ConfirmDialog.tsx, DataTable.tsx, DropdownMenu.tsx, EditableCell.tsx, InfoTooltip.tsx, Switch.tsx, ToastStack.tsx
```

Utility files:

```
src/utils/
├── dates.ts                   (fmtLocalDate, parseDate, getWeekRange, getMonthRange, getBreakdownRange, addDays, addMonths)
├── dates.test.ts
├── displayNames.ts            (syncDisplayNamesSnapshot)
├── exportUtils.ts
├── exportUtils.test.ts
├── importUtils.ts
├── importUtils.test.ts
└── chartColors.ts             (buildSeriesColorMap — Recharts color pool)
```

Store helpers:

```
src/stores/
├── useStore.ts                (Zustand store + api wrapper)
└── iconCache.ts               (BoundedIconCache, mergeBoundedIconCache — LRU eviction for app/category icons)
```

## Frontend gotchas

### Date handling — NEVER use `toISOString()`
`toISOString()` converts to UTC, shifting dates by timezone offset. Always use `fmtLocalDate` from `src/utils/dates.ts`:
```ts
// BAD: d.toISOString().slice(0, 10)
// GOOD:
const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,"0"), day = String(d.getDate()).padStart(2,"0");
`${y}-${m}-${day}`
```
All date helpers have been deduplicated into `src/utils/dates.ts`. All components import from there — no more local copies.

**One remaining `toISOString()` in `exportUtils.ts:21`** — used for export filename generation only (not a data boundary), low risk.

### API layer inconsistency
`useStore.ts` exports `api` object wrapping `invoke` with baseline performance logging (enabled only on `localhost`). Use `api.getSetting`/`api.setSetting` for settings. `api` now covers categories, app metadata CRUD, icon fetching, and import/export. HOWEVER, core data-fetching invoke calls (`setDate`, `refresh`, `loadHourlyBreakdown`, `loadRangeBreakdown`, `init`) bypass `api` and call raw `invoke()` directly.

### Store caching quirk (applies to all breakdown/summary loaders)
`loadRangeBreakdown`, `loadRangeCategoryBreakdown`, `loadCategorySummary`, `loadHourlyBreakdown`, `loadHourlyCategoryBreakdown` all skip fetch only when `length > 0`. An empty-result range is NOT cached and will refetch on every invocation. Check `*Range`/`*Date` sentinel values to distinguish "loading" from "loaded but empty".

### `ensureAppIconsLoaded` / `ensureCategoryFileIconsLoaded` — bounded LRU cache
Both use `BoundedIconCache` (max 120 app icons, max 60 category icons) with per-invocation snapshots via `get()`. Concurrent calls could still produce a write-behind race, but the `mergeBoundedIconCache` strategy preserves newer entries by order tracking.

### Chart behavior
- `StackedBarChart` `customDates` generates ALL dates between start/end, not just dates found in data. Zero-value bars render for empty days.
- `BarChart` key includes `customStartDate`/`customEndDate` to trigger re-animation on range change.
- The `hasEntries` check gates on `chartData.length > 0`, NOT on any bar having >0 value. This ensures empty ranges show 0 bars instead of "No data".

### Rendering empty data
`Dashboard.tsx` `displaySummary` returns `{ total_seconds: 0, apps: [], hourly: [] }` when range data is loaded-but-empty, and `null` only when unloaded. Summary cards, chart, and `AppRanking` all receive this empty object — AppRanking handles `apps.length === 0` internally with a "No data" message.

### Dark mode
Controlled by `dark` class on `document.documentElement`. Store sets `localStorage("theme")` + toggles classList. Tailwind `darkMode: "class"`.

### Routing
No React Router. `App.tsx` uses `useState<PageView>` ("dashboard" | "settings" | "appManagement" | "categoryManagement"). All "page" components are `React.lazy()`. The `activeView` state is persisted in Zustand (not localStorage).

### i18n type casting
The `useT()` hook returns `t: (key: keyof Translations) => string` (strict literal keys). When passing `t` to a child component that declares `t: (key: string) => string`, cast at the call site: `t={t as (key: string) => string}`. Otherwise strict mode rejects the assignment due to parameter contravariance.
Note: `Translations` is `typeof zhCN` — `zh-CN.json` defines the canonical key set. Extra keys in `en-US.json` are silently inaccessible.

### i18n — common.* shared keys + interpolation
- **Shared keys**: Generic UI words (`save`, `cancel`, `confirm`, `edit`, `delete`, `icon`, `actions`, `browse`, `imageFiles`, `selectedCount`, `clearFilter`, `custom`, `uncategorized`) live under `common.*` in both language files. NEVER create domain-prefixed duplicates (`appManagement.save`, `categoryManagement.cancel`, etc.).
- **Interpolation**: The `t()` function returns a plain string — there is NO built-in interpolation. Use `.replace("{key}", value)` for dynamic values. Example: `t("ranking.duration.hms").replace("{h}", "3").replace("{m}", "25").replace("{s}", "9")`.
- **Template literal keys**: `DateNavigator.tsx` constructs keys dynamically: `` t(`breakdown.${mode}`) ``. This means `breakdown.custom` MUST exist in `zh-CN.json` even though a grep for `"breakdown.custom"` won't find it.

### Calendar popover CSS — animation must include translateX
Calendar popovers use `left-1/2 -translate-x-1/2` for centering. The `.date-calendar-popover` CSS animation (`@keyframes calendar-pop`) overrides `transform` entirely — both `from` and `to` keyframes MUST include `translateX(-50%)`, otherwise the popover briefly shifts to the right before snapping into place at animation end.

### AppRanking pagination
`AppRanking.tsx` owns `currentPage` and `pageSize` state internally (default pageSize: 15, options: 10/15/20/30). It renders `paginatedItems = items.slice(startIdx, startIdx + pageSize)` with global rank numbers. Pagination bar only appears when `totalPages > 1`. The component receives the full `items` array from Dashboard — pagination is purely frontend.

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
- `syncDisplayNamesSnapshot` in `displayNames.ts` currently just returns the latest value (passthrough), but exists as a hook point for merge logic

### AppTable inline editing
- `EditableCell` component handles click-to-edit for both display_name and icon_path columns
- On save failure, the cell stays in editing mode (doesn't revert or close)
- When the user edits display_name to match the original `app_name`, `handleSaveDisplayName` automatically calls `resetAppDisplayName` instead (avoids storing redundant alias)
- The "app_name" column in the table shows `display_name || app_name` as default value
- Reset button (x) only appears on hover when a custom value is set

### AppTable search + sort + pagination
- Search filters by `app_name.toLowerCase().includes(q) || display_name.toLowerCase().includes(q)`
- Sort by display_name sorts by `display_name || app_name` (localeCompare)
- Sort by total_seconds sorts numerically
- Pagination: default 10/page, options 10/20/30, controlled by parent `pageSize` state
- Empty text differs: `noResults` when search active, `noData` when list is empty

### GroupBy mode
`GroupBy = "app" | "category"` persisted in `localStorage("groupBy")`. Dashboard switches between app-level and category-level views, affecting the summary panel, chart breakdown, and filter dropdown. The store maintains parallel state for both: `summary`/`categorySummary`, `hourlyBreakdown`/`hourlyCategoryBreakdown`, `rangeBreakdown`/`rangeCategoryBreakdown`. All are loaded on every `refresh()`.

### Dashboard filtering
`filterDashboardItems.ts` provides utilities to filter breakdown rows and summary items by selected app names or category IDs. Filter selections persist in `localStorage("dashboardSelectedAppNames")` and `localStorage("dashboardSelectedCategoryIds")` (JSON-serialized arrays). The `DropdownMenu` component renders the filter picker with checkboxes from `api.getAppFilterOptions()`.

### Category management
- **Categories table** in SQLite: `id` (auto-increment PK), `name`, `icon_source` ("builtin"|"file"), `builtin_icon_key`, `custom_icon_path`, `is_default` (can't delete default), `is_builtin` (can't edit/delete), `sort_order`
- **Builtin categories** (7 total): uncategorized, office, study, video, entertainment, social, system — with PNG icons under `public/category-icons/`
- **Uncategorized** (id=1, `is_default=1`) is auto-assigned to new apps via `upsert_app_metadata`. It CANNOT be deleted.
- **Category file icons** use a separate bounded `BoundedIconCache` (max 60) keyed by category ID, loaded via `get_category_file_icons_by_ids`
- **`setAppCategory`**: assigns an app to a category. The `app_metadata` table has a `category_id` column defaulting to the uncategorized category
- **Category icon resolution**: `builtin` → PNG from `public/category-icons/`, `file` → `convertFileSrc(path)` (Tauri asset protocol)

#### CategoryManagement refresh — same pattern as AppManagement
`CategoryManagement.tsx` uses `initialLoading` (not `loading`) to avoid unmounting `CategoryTable` on refresh, preserving internal page/sort state.

### CategoryTable inline editing
- Click category name to edit in-place (EditableCell)
- Click icon to open `CategoryIconPicker` (builtin grid + file upload)
- Builtin categories cannot be deleted or edited (name/icon), only reordered
- Delete cascades: all apps in deleted category are reassigned to uncategorized (handled in Rust)

## Rust / Tauri gotchas

### Windows-only
`tracker.rs` and `icon.rs` have `#[cfg(target_os = "windows")]` implementations and `#[cfg(not(...))]` stubs returning `None`. The app compiles on macOS but won't track.

### DB connection
Single `Mutex<Connection>` — all DB operations must serialize through it. No connection pool. The `db/` module is split into `mod.rs` (Database struct), `schema.rs` (migrations), `usage.rs`, `app_metadata.rs`, `categories.rs`, `settings.rs`, `models.rs`.

### Settings table
Key-value store. Known keys: `locale`, `retention_days` (0 = keep forever), `ignored_apps` (JSON array), `ignored_apps_enabled` ("true"/"false"), `afk_threshold_seconds` (seconds as string, default 300 = 5 min), `group_by` ("app" | "category").

### Categories table (SQLite)
Created in `schema.rs` with builtin rows inserted at migration. A default "uncategorized" category (id=1) is created and all existing `app_metadata` rows without a `category_id` are backfilled to it.

### AFK threshold — configurable
The AFK threshold is no longer hardcoded. `tracker.rs` reads `afk_threshold_seconds` from the settings table at tracking start, defaulting to 300 if unset. The `IdleThreshold` component in SettingsPage lets users choose presets (5/10/15/30 min) or a custom value. The threshold is read once when tracking starts — changing it requires pausing/resuming tracking to take effect.

### Tray close behavior
`WindowEvent::CloseRequested` calls `api.prevent_close()` + `window.hide()`. User must quit via tray menu or `Ctrl+C` in dev.

### Tracker lock scope — CRITICAL
`get_process_info_by_hwnd()` must be called **before** `state.lock()`, not inside it (tracker.rs in `process_foreground_change`). When the tracker app itself is foreground, `GetWindowTextW` sends synchronous `WM_GETTEXT` to the main thread. If called inside the lock, the main thread's invoke processing can block on `db.conn` while the tracking thread holds `state.lock()` waiting for the main thread — causing refresh to hang indefinitely.

**Related:** `db.get_today_total_seconds()` (in `update_today_and_emit`) is called while `state.lock()` is held. This means the DB lock is acquired inside the tracker state lock. Currently safe because Tauri invoke commands never touch tracker state, but any code that acquires both locks must respect this ordering (`state.lock()` -> `db.conn.lock()`).

### `import_records_batch` — param count
The dedup `SELECT` SQL uses 8 placeholders (`?1`-`?8`). Each `?N` placeholder that appears multiple times in SQL (e.g., `?2` in both sides of an OR) must be bound **once** in `params![]`. Passing extra params causes rusqlite errors at runtime (rejects silently, rolls back).

### `import_records_batch` — Mutex deadlock avoidance
After `COMMIT`, `drop(conn)` before calling `upsert_app_metadata`. `upsert_app_metadata` also acquires `self.conn.lock()`, and holding the lock from the batch method across both calls would deadlock (same-thread Mutex re-entry on `std::sync::Mutex`).

### App metadata population
`import_records_batch` writes `app_metadata` for imported apps with non-null `app_path`. New apps get assigned to the default "uncategorized" category via `get_default_category_id_from_conn`. This allows `get_all_app_icons` to find and extract icons. Icons only appear if the `app_path` exists on the current machine (same install path as exporting machine).

### App metadata columns
`app_metadata` table has: `app_name` (PK), `app_path` (exe path for icon extraction), `display_name` (user alias, nullable), `custom_icon_path` (user override icon path, nullable), `default_icon_path` (auto-extracted icon path, nullable), `category_id` (FK to categories.id, defaults to uncategorized). Migration via `ALTER TABLE ADD COLUMN` in `Database::new()`.

### Icon resolution priority
`get_all_app_icons` resolves icons in order: `custom_icon_path` > `default_icon_path` > exe extraction from `app_path`. Each path is passed through `IconCache.get_or_extract()` which handles base64 PNG caching in memory (max 200).

### `delete_records_by_app` — full cleanup
Deletes from BOTH `usage_records` AND `app_metadata` for the given app. Also invalidates the metadata cache. After deletion, the app disappears from `get_all_app_metadata_list` entirely. It will be re-inserted into `app_metadata` via `upsert_app_metadata` if tracked again.

### App management Tauri commands
Current commands: `get_all_app_metadata_list`, `get_app_filter_options`, `set_app_display_name`, `set_app_custom_icon`, `reset_app_display_name`, `reset_app_custom_icon`, `delete_records_by_app`, `rename_app`, `get_app_display_names`. Category commands: `get_all_categories`, `create_category`, `update_category`, `delete_category`, `set_app_category`, `get_category_summary`, `get_hourly_category_breakdown`, `get_daily_category_breakdown`, `get_category_file_icons_by_ids`. None interact with tracker state (safe for db lock ordering).

### `window-title` capability
`src-tauri/capabilities/default.json` must grant `"core:window:allow-set-title"` for the tray menu to update the window title based on locale.

### Rust tests
Only `tracker.rs` has tests (5 tests for `should_ignore_app_from_settings`). No DB-level tests — `cargo test` does not exercise SQLite logic.

## CI

Single workflow (`release.yml`), triggered on `v*` tags only. `windows-latest` runner. Runs `npm run build` (which includes `tsc` type-check) + `cargo check`, then `tauri-action`. **No tests run in CI** — neither `npm run test` nor `cargo test` are executed. `tsc` is the only automated quality gate.

## Type constraints

- `tsconfig.json` strict mode ON: `noUnusedLocals`, `noUnusedParameters` both true. Unused imports/vars fail `npm run build`.
- The `UsageRecord` interface is defined in `src/types/index.ts` and must match the Rust struct in `db/models.rs`. `ImportRecord` (same fields minus `id`) mirrors Rust's `ImportRecord`.
- `AppMetadataItem`, `CategoryItem`, `CategorySummaryItem`, `AppFilterOption`, `UsageRankingItem`, `HourlyCategoryBreakdown`, `DailyCategoryBreakdown` must each match their Rust counterparts in `db/models.rs`.
- `PageView` = `"dashboard" | "settings" | "appManagement" | "categoryManagement"` — each page is lazy-loaded in `App.tsx`.
- `GroupBy` = `"app" | "category"` — persisted in `localStorage("groupBy")`.

## View modes

`ViewMode = "daily" | "weekly" | "monthly" | "custom"`. Switching to `"custom"` auto-defaults to last 7 days if no `customStartDate`/`customEndDate` set. `setCustomRange` auto-swaps if start > end.

## DateRangePicker

Used in `DateNavigator.tsx` (shown when `viewMode === "custom"` in compact mode, or as full preset bar in Dashboard). User clicks presets or opens a popover with start/end `<input type="date">` fields + single-month calendar. Calendar clicks update only the active field (start or end), toggled by clicking the label/input.
