mod db;
mod icon;
mod tracker;
mod tray;

use db::{DailyAppBreakdown, DailySummary, Database, HourlyAppBreakdown, UsageRecord};
use icon::IconCache;
use std::sync::Arc;
use tauri::{App, Manager, WindowEvent};
use tracker::Tracker;

#[tauri::command]
fn get_setting(key: String, db: tauri::State<Arc<Database>>) -> Result<Option<String>, String> {
    db.get_setting(&key)
}

#[tauri::command]
fn set_setting(key: String, value: String, db: tauri::State<Arc<Database>>) -> Result<(), String> {
    db.set_setting(&key, &value)
}

#[tauri::command]
fn get_all_app_names(db: tauri::State<Arc<Database>>) -> Result<Vec<String>, String> {
    db.get_all_app_names()
}

#[tauri::command]
fn get_all_records(db: tauri::State<Arc<Database>>) -> Result<Vec<UsageRecord>, String> {
    db.get_all_records()
}

#[tauri::command]
fn get_records_range(
    start_date: String,
    end_date: String,
    offset: i64,
    limit: i64,
    db: tauri::State<Arc<Database>>,
) -> Result<Vec<UsageRecord>, String> {
    db.get_records_range(&start_date, &end_date, offset, limit)
}

#[tauri::command]
fn get_record_count(
    start_date: String,
    end_date: String,
    db: tauri::State<Arc<Database>>,
) -> Result<i64, String> {
    db.get_record_count(&start_date, &end_date)
}

#[tauri::command]
fn get_daily_summary(
    date: String,
    db: tauri::State<Arc<Database>>,
) -> Result<DailySummary, String> {
    db.get_daily_summary(&date)
}

#[tauri::command]
fn get_hourly_app_breakdown(
    date: String,
    db: tauri::State<Arc<Database>>,
) -> Result<Vec<HourlyAppBreakdown>, String> {
    db.get_hourly_app_breakdown(&date)
}

#[tauri::command]
fn get_daily_app_breakdown(
    start_date: String,
    end_date: String,
    db: tauri::State<Arc<Database>>,
) -> Result<Vec<DailyAppBreakdown>, String> {
    db.get_daily_app_breakdown(&start_date, &end_date)
}

#[tauri::command]
fn start_tracking(
    app: tauri::AppHandle,
    _db: tauri::State<Arc<Database>>,
    tracker: tauri::State<Arc<Tracker>>,
) -> Result<(), String> {
    tracker::start_tracking(app, tracker.inner().clone());
    Ok(())
}

#[tauri::command]
fn get_all_app_icons(
    db: tauri::State<Arc<Database>>,
    icon_cache: tauri::State<Arc<IconCache>>,
) -> Result<std::collections::HashMap<String, String>, String> {
    let app_paths = db.get_all_app_metadata()?;
    let mut map = std::collections::HashMap::new();
    for (name, path) in app_paths {
        map.insert(name, icon_cache.get_or_extract(&path));
    }
    Ok(map)
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app: &mut App| {
            let app_dir = std::env::current_exe()
                .ok()
                .and_then(|p| p.parent().map(|p| p.to_path_buf()))
                .expect("failed to resolve exe directory");

            let database = Arc::new(Database::new(app_dir).expect("failed to initialize database"));

            // Clean up old records if setting exists
            if let Ok(Some(days_str)) = database.get_setting("retention_days") {
                if let Ok(days) = days_str.parse::<u32>() {
                    let _ = database.cleanup_old_records(days);
                }
            }

            let icon_cache = Arc::new(IconCache::new());
            let tracker = Arc::new(Tracker::new(database.clone(), icon_cache.clone()));

            app.manage(database);
            app.manage(icon_cache);
            app.manage(tracker);

            tray::create_tray(app.handle())?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_daily_summary,
            get_hourly_app_breakdown,
            get_daily_app_breakdown,
            start_tracking,
            get_setting,
            set_setting,
            get_all_app_names,
            get_all_app_icons,
            get_all_records,
            get_records_range,
            get_record_count
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
