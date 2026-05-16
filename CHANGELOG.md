# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- Performance optimization baseline instrumentation for IPC calls.
- Breakdown request caching in store to reduce duplicate fetches.
- Shared app icon cache in store and settings page reuse.
- Tauri updater plugin integration and settings update-check UI.
- GitHub release workflow and release guide scaffold.

### Changed
- Dashboard store subscription switched to shallow object selection.
- Breakdown loading flow simplified to avoid repeated effects.
- Chart pivot internals use `Set` lookups to reduce repeated array scans.
- `Dashboard`, `SettingsPage`, and `StackedBarChart` are now lazy-loaded to split large bundles.
- Baseline IPC logs are now emitted only in localhost development environment.

### Notes
- Windows code-signing is intentionally deferred and kept as workflow placeholders.
