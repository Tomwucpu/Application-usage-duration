mod db;
mod icon;
mod tracker;

use db::{DailySummary, Database};
use icon::IconCache;
use std::sync::Arc;
use tauri::{App, Manager};
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

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_daily_summary, start_tracking])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
