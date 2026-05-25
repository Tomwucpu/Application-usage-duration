# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a Tauri 2 desktop app for tracking foreground application usage on Windows. The frontend is React 18 + TypeScript + Vite, and the backend is Rust + SQLite exposed through Tauri commands.

Tracking is Windows-specific: the app can compile on other platforms because Rust stubs exist, but real foreground tracking and icon extraction are implemented for Windows.

## Common commands

### Frontend and desktop app

```bash
npm install
npm run dev
npm run tauri dev
npm run build
npm run tauri build
```

- `npm run dev` starts the Vite frontend only on port `1420` with `strictPort: true`.
- `npm run tauri dev` is the main full-app development command.
- `npm run build` runs `tsc && vite build`.
- There is no dedicated lint script in `package.json`.

### Tests

```bash
npm run test
npx vitest run src/utils/dates.test.ts
npx vitest run src/utils/importUtils.test.ts -t "test name"
cargo test --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml should_ignore_app_from_settings
cargo check --manifest-path src-tauri/Cargo.toml
```

Notes:
- Frontend tests use Vitest.
- Rust tests currently live in `src-tauri/src/tracker.rs`.
- CI currently runs `npm run build` and `cargo check`, but does not run Vitest or Rust tests.

## High-level architecture

### Frontend structure

- `src/App.tsx` is the app shell. It does not use React Router; top-level navigation is a local `View` state switching between `dashboard`, `settings`, and `appManagement`.
- Top-level pages are lazy-loaded:
  - `src/components/Dashboard.tsx`
  - `src/components/SettingsPage.tsx`
  - `src/components/appManagement/AppManagement.tsx`
- `src/stores/useStore.ts` is the main orchestration layer. It owns:
  - tracker state pushed from Rust via `listen("tracker-state")`
  - date selection and view mode
  - breakdown caches
  - theme state
  - icon and display-name loading
  - Tauri IPC wrappers in the exported `api` object

In practice, most frontend behavior flows through the Zustand store rather than page-local data fetching.

### Rust / Tauri structure

- `src-tauri/src/main.rs` is a minimal entrypoint.
- `src-tauri/src/lib.rs` wires the app together:
  - registers Tauri commands
  - creates shared `Arc<Database>`, `Arc<IconCache>`, and `Arc<Tracker>` state
  - initializes the tray
  - applies retention cleanup on startup
  - stores the SQLite database next to the executable via `current_exe()` resolution
- `src-tauri/src/db.rs` contains schema creation and query logic.
- `src-tauri/src/tracker.rs` contains the foreground-window tracking loop and emits live tracker state back to the frontend.
- `src-tauri/src/icon.rs` extracts and caches icons.
- `src-tauri/src/tray.rs` owns tray menu creation and localized tray actions.

### Data flow

1. The frontend starts with `useStore.init()`.
2. The store subscribes to the `tracker-state` event and invokes `start_tracking`.
3. Frontend reads use `invoke()` to call Rust commands in `src-tauri/src/lib.rs`.
4. Rust commands delegate to `Database` methods in `src-tauri/src/db.rs`.
5. The tracker thread emits live state back to the frontend; dashboard refreshes also call `flush_tracking` before re-querying summaries.

## Important data model

SQLite tables are created in `src-tauri/src/db.rs`:

- `usage_records`: tracked app sessions with app name/path, window title, timestamps, date, and hour.
- `app_metadata`: per-app metadata for display alias and icons.
- `settings`: simple key/value storage.

Key settings currently used in the app include:
- `locale`
- `retention_days`
- `ignored_apps`
- `ignored_apps_enabled`
- `afk_threshold_seconds`

## Important implementation details

### Dates are local-time, not UTC

Use the helpers in `src/utils/dates.ts` for app date logic. Do not introduce `toISOString()`-based date-boundary logic for selected dates, week/month ranges, or custom ranges; this app works with local calendar dates and UTC conversion can shift the day.

### Display names are globally resolved through `AppNames`

Visible app labels should go through `getDisplayName()` from `src/components/AppNames.ts`, not raw `app_name`, when the UI is meant to respect user aliases. `src/App.tsx` keeps that module-level cache in sync with `useStore.displayNames`.

### App management refresh should preserve table state

`src/components/appManagement/AppManagement.tsx` uses `initialLoading` intentionally so `AppTable` stays mounted after first load. Avoid changing refresh behavior in a way that unmounts `AppTable`, or pagination/sort/edit state will reset on each refresh.

### Window close hides to tray

In `src-tauri/src/lib.rs`, the main window intercepts close requests and hides instead of exiting. Quitting is done through the tray menu or by stopping the dev process.

### Tracking/backend concurrency is lock-based

The database is a single `Mutex<Connection>` in `src-tauri/src/db.rs`. The tracker also has its own shared state lock in `src-tauri/src/tracker.rs`. If you edit tracker internals, be careful about lock ordering and avoid adding code that can block on UI/process inspection while holding the tracker state lock.

## UI and state conventions

- Dark mode is controlled by a `dark` class on `document.documentElement`.
- Translations live in `src/i18n/zh-CN.json` and `src/i18n/en-US.json`; `zh-CN.json` is effectively the canonical key set.
- Breakdown date logic is centralized in `src/utils/dates.ts` via `getBreakdownRange`, `getWeekRange`, and `getMonthRange`.
- `StackedBarChart` handles both daily hourly charts and multi-day range charts; for date ranges it renders zero-value days too, not just days present in the dataset.

## Release workflow

- GitHub Actions workflow: `.github/workflows/release.yml`
- Trigger: `v*` tags and manual dispatch
- Current release job runs on `windows-latest`
- Build gate today is effectively `npm run build` plus `cargo check`
