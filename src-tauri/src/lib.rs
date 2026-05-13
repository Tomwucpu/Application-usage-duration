mod db;
mod icon;
mod tracker;
mod tray;

use db::{DailyAppBreakdown, DailySummary, Database, HourlyAppBreakdown};
use icon::IconCache;
use std::sync::Arc;
use tauri::{App, Manager, WindowEvent};
use tracker::Tracker;

#[tauri::command]
fn get_daily_summary(
    date: String,
    db: tauri::State<Arc<Database>>,
    icon_cache: tauri::State<Arc<IconCache>>,
) -> Result<DailySummary, String> {
    let mut summary = db.get_daily_summary(&date)?;
    let app_paths = db.get_app_paths_for_date(&date)?;

    for app in &mut summary.apps {
        if let Some(path) = app_paths.get(&app.app_name) {
            app.icon_base64 = icon_cache.get_or_extract(path);
        }
    }

    Ok(summary)
}

#[tauri::command]
fn get_hourly_app_breakdown(
    date: String,
    db: tauri::State<Arc<Database>>,
    icon_cache: tauri::State<Arc<IconCache>>,
) -> Result<Vec<HourlyAppBreakdown>, String> {
    let mut breakdown = db.get_hourly_app_breakdown(&date)?;
    let app_paths = db.get_app_paths_for_date(&date)?;

    for item in &mut breakdown {
        if let Some(path) = app_paths.get(&item.app_name) {
            item.icon_base64 = icon_cache.get_or_extract(path);
        }
    }

    Ok(breakdown)
}

#[tauri::command]
fn get_daily_app_breakdown(
    start_date: String,
    end_date: String,
    db: tauri::State<Arc<Database>>,
    icon_cache: tauri::State<Arc<IconCache>>,
) -> Result<Vec<DailyAppBreakdown>, String> {
    let mut breakdown = db.get_daily_app_breakdown(&start_date, &end_date)?;
    let app_paths = db.get_app_paths_for_date_range(&start_date, &end_date)?;

    for item in &mut breakdown {
        if let Some(path) = app_paths.get(&item.app_name) {
            item.icon_base64 = icon_cache.get_or_extract(path);
        }
    }

    Ok(breakdown)
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

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .setup(|app: &mut App| {
            let app_dir = app
                .path()
                .app_data_dir()
                .expect("failed to resolve app data dir");

            let database = Arc::new(Database::new(app_dir).expect("failed to initialize database"));
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
            start_tracking
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
