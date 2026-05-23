mod db;
mod icon;
mod tracker;
mod tray;

use db::{AppMetadataItem, DailyAppBreakdown, DailySummary, Database, HourlyAppBreakdown, ImportBatchResult, ImportRecord, UsageRecord};
use icon::IconCache;
use std::sync::Arc;
use tauri::{App, Manager, Theme, WindowEvent};
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
fn import_records_batch(
    records: Vec<ImportRecord>,
    db: tauri::State<Arc<Database>>,
) -> Result<ImportBatchResult, String> {
    db.import_records_batch(&records)
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
fn flush_tracking(
    db: tauri::State<Arc<Database>>,
    tracker: tauri::State<Arc<Tracker>>,
) -> Result<(), String> {
    tracker::flush_tracking(&db, &tracker.state)
}

#[tauri::command]
fn update_window_theme(app: tauri::AppHandle, theme: String) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        let tauri_theme = if theme == "light" {
            Some(Theme::Light)
        } else {
            Some(Theme::Dark)
        };
        let _ = window.set_theme(tauri_theme);
    }
    Ok(())
}

#[tauri::command]
fn get_today_total_seconds(db: tauri::State<Arc<Database>>) -> Result<i64, String> {
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    db.get_today_total_seconds(&today)
}

#[tauri::command]
async fn get_all_app_icons(
    db: tauri::State<'_, Arc<Database>>,
    icon_cache: tauri::State<'_, Arc<IconCache>>,
) -> Result<std::collections::HashMap<String, String>, String> {
    use std::collections::HashMap;

    let app_meta = db.get_all_app_metadata()?;

    let app_custom_icons = {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT app_name, custom_icon_path FROM app_metadata WHERE custom_icon_path IS NOT NULL")
            .map_err(|e| e.to_string())?;
        let mut map = HashMap::new();
        let rows: Vec<(String, String)> = stmt
            .query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
        for (name, path) in rows {
            map.insert(name, path);
        }
        map
    };

    let app_default_icon_paths = {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT app_name, default_icon_path FROM app_metadata WHERE default_icon_path IS NOT NULL")
            .map_err(|e| e.to_string())?;
        let mut map = HashMap::new();
        let rows: Vec<(String, String)> = stmt
            .query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
        for (name, path) in rows {
            map.insert(name, path);
        }
        map
    };

    let cache = icon_cache.inner().clone();

    let map = tokio::task::spawn_blocking(move || -> HashMap<String, String> {
        let mut result = HashMap::new();

        for (name, exe_path) in &app_meta {
            // Priority: custom_icon_path > default_icon_path > exe extraction
            if let Some(custom_path) = app_custom_icons.get(name) {
                let icon = cache.get_or_extract(custom_path);
                if !icon.is_empty() {
                    result.insert(name.clone(), icon);
                    continue;
                }
            }

            if let Some(default_path) = app_default_icon_paths.get(name) {
                let icon = cache.get_or_extract(default_path);
                if !icon.is_empty() {
                    result.insert(name.clone(), icon);
                    continue;
                }
            }

            let icon = cache.get_or_extract(exe_path);
            if !icon.is_empty() {
                result.insert(name.clone(), icon);
            }
        }

        result
    })
    .await
    .map_err(|e| e.to_string())?;

    Ok(map)
}

#[tauri::command]
fn get_all_app_metadata_list(
    db: tauri::State<Arc<Database>>,
) -> Result<Vec<AppMetadataItem>, String> {
    db.get_all_app_metadata_list()
}

#[tauri::command]
fn set_app_display_name(
    app_name: String,
    display_name: Option<String>,
    db: tauri::State<Arc<Database>>,
) -> Result<(), String> {
    db.set_app_display_name(&app_name, display_name.as_deref())
}

#[tauri::command]
fn set_app_custom_icon(
    app_name: String,
    custom_icon_path: Option<String>,
    db: tauri::State<Arc<Database>>,
) -> Result<(), String> {
    db.set_app_custom_icon(&app_name, custom_icon_path.as_deref())
}

#[tauri::command]
fn reset_app_display_name(
    app_name: String,
    db: tauri::State<Arc<Database>>,
) -> Result<(), String> {
    db.reset_app_display_name(&app_name)
}

#[tauri::command]
fn reset_app_custom_icon(
    app_name: String,
    db: tauri::State<Arc<Database>>,
) -> Result<(), String> {
    db.reset_app_custom_icon(&app_name)
}

#[tauri::command]
fn delete_records_by_app(
    app_name: String,
    db: tauri::State<Arc<Database>>,
) -> Result<usize, String> {
    db.delete_records_by_app(&app_name)
}

#[tauri::command]
fn rename_app(
    old_name: String,
    new_name: String,
    db: tauri::State<Arc<Database>>,
) -> Result<(), String> {
    db.rename_app(&old_name, &new_name)
}

#[tauri::command]
fn get_app_display_names(db: tauri::State<Arc<Database>>) -> Result<std::collections::HashMap<String, String>, String> {
    db.get_app_display_names()
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

            app.manage(database.clone());
            app.manage(icon_cache);
            app.manage(tracker);

            tray::create_tray(app.handle())?;

            // Apply saved locale to tray menu
            if let Ok(Some(locale)) = database.get_setting("locale") {
                if locale == "zh-CN" || locale == "en-US" {
                    let _ = tray::update_tray_menu(app.handle().clone(), locale);
                }
            }

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
            flush_tracking,
            get_setting,
            set_setting,
            get_all_app_names,
            get_all_app_icons,
            get_all_records,
            get_records_range,
            get_record_count,
            import_records_batch,
            get_all_app_metadata_list,
            set_app_display_name,
            set_app_custom_icon,
            reset_app_display_name,
            reset_app_custom_icon,
            delete_records_by_app,
            rename_app,
            get_app_display_names,
            tray::update_tray_menu,
            update_window_theme,
            get_today_total_seconds
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
