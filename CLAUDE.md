# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Tauri 2 desktop app that tracks Windows foreground application usage time via 2-second polling, persists to local SQLite, and displays dashboards with Recharts.

## Commands

```bash
npm run dev          # Vite dev server (frontend only, no Rust)
npm run tauri dev    # Full Tauri app with Rust backend
npm run build        # TypeScript type-check + Vite build
npm run test         # Vitest unit tests
npm run tauri build  # Production desktop package
```

No Rust-specific test commands; Rust tests run via `cargo test` inside `src-tauri/`.

## Architecture

```
Frontend (React 18 + TS + Vite)     Backend (Rust via Tauri IPC)
─────────────────────────────────   ─────────────────────────────
useStore.ts ←── listen("tracker-state") ── tracker.rs (polling loop)
useStore.ts ─── invoke("get_*") ──────── lib.rs (commands) → db.rs (SQLite)
```

**IPC pattern:** Frontend calls `invoke("<command>", { args })` defined as `#[tauri::command]` in `lib.rs` and `tray.rs`. Backend pushes real-time state via `app.emit("tracker-state", payload)` listened to in the Zustand store.

**State management:** Single Zustand store (`src/stores/useStore.ts`). On init, calls `start_tracking` command and subscribes to `tracker-state` events (throttled to 1s). All data fetching (summary, breakdowns, icons) goes through `invoke` commands.

**Database:** SQLite at `<exe_dir>/usage.db`, created by `db.rs` on first launch. Three tables: `usage_records`, `app_metadata` (app_name→app_path for icon lookup), `settings` (key-value). Database path is portable — lives next to the exe.

**Tracking loop** (`src-tauri/src/tracker.rs`): Every 2 seconds on a dedicated thread, polls `GetForegroundWindow` / `GetLastInputInfo` (Windows). On app switch or AFK state change, flushes the previous segment to `usage_records`. AFK threshold is 5 minutes hardcoded. Ignores apps listed in the `ignored_apps` setting.

**Icon extraction** (`src-tauri/src/icon.rs`): Uses `SHGetFileInfoW` + GDI to extract 32×32 icons from exe paths, caches up to 200 base64 PNGs in-memory. Frontend stores icons in Zustand (`appIcons`) and loads via `get_all_app_icons`.

**Tray** (`src-tauri/src/tray.rs`): System tray with Pause/Resume, Show/Hide, Quit. Menu text follows locale. Left-click toggles window visibility. Close button hides to tray (never quits).

**i18n:** `src/i18n/zh-CN.json` and `en-US.json`, loaded via React context. Locale persisted to both `localStorage` (frontend) and `settings` table (backend, for tray menu).

**Lazy loading:** `Dashboard`, `SettingsPage`, and `StackedBarChart` are `React.lazy()` loaded to split bundles.

## Key files

| File | Role |
|------|------|
| `src/stores/useStore.ts` | All state, IPC calls, icon caching |
| `src/App.tsx` | Top-level routing (dashboard/settings), nav |
| `src/components/Dashboard.tsx` | Main dashboard: status bar, date picker, charts, ranking |
| `src/components/StackedBarChart.tsx` | Hourly + daily stacked bar charts (Recharts) |
| `src/components/SettingsPage.tsx` | Theme, locale, autostart, export, retention, ignored apps |
| `src/components/AppRanking.tsx` | App usage ranking with icons and progress bars |
| `src-tauri/src/lib.rs` | All `#[tauri::command]` definitions, app setup, plugin registration |
| `src-tauri/src/tracker.rs` | Polling loop, AFK detection, NameCache, ignore logic |
| `src-tauri/src/db.rs` | SQLite schema, all queries, metadata cache |
| `src-tauri/src/icon.rs` | Windows icon extraction with GDI, base64 PNG |
| `src-tauri/src/tray.rs` | Tray icon, menu, locale-aware menu rebuild |
| `src/types/index.ts` | Shared TS interfaces (mirror Rust structs) |

## Data flow example: viewing a day's dashboard

1. User picks date → `setDate()` in store
2. Store calls `invoke("get_daily_summary", { date })` → `db.rs::get_daily_summary()`
3. In parallel: `loadHourlyBreakdown(date)` → `invoke("get_hourly_app_breakdown", { date })`
4. `loadDailyBreakdown(date)` → calculates week range → `invoke("get_daily_app_breakdown", { startDate, endDate })`
5. `ensureAppIconsLoaded()` merges new icons into store
6. Components re-render via Zustand subscriptions

## Constraints

- **Windows-only for tracking/icons.** macOS stubs exist in `tracker.rs` and `icon.rs` but return `None`.
- Database is single-connection behind `Mutex` — no concurrent writes.
- Icon cache clears entirely when exceeding 200 entries (no LRU eviction).
- The `UsageRecord` interface is defined twice (TS `types/index.ts` and Rust `db.rs`) — must stay in sync.
