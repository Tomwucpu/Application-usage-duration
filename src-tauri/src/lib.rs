mod db;
mod icon;
mod tracker;
mod tray;

use db::{
    AppFilterOption, AppMetadataItem, CategoryItem, CategorySummaryItem, DailyAppBreakdown,
    DailyCategoryBreakdown, DailySummary, Database, HourlyAppBreakdown,
    HourlyCategoryBreakdown, ImportBatchResult, ImportRecord, UsageRecord,
};
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
fn get_category_summary(
    date: String,
    db: tauri::State<Arc<Database>>,
) -> Result<Vec<CategorySummaryItem>, String> {
    db.get_category_summary(&date)
}

#[tauri::command]
fn get_hourly_app_breakdown(
    date: String,
    db: tauri::State<Arc<Database>>,
) -> Result<Vec<HourlyAppBreakdown>, String> {
    db.get_hourly_app_breakdown(&date)
}

#[tauri::command]
fn get_hourly_category_breakdown(
    date: String,
    db: tauri::State<Arc<Database>>,
) -> Result<Vec<HourlyCategoryBreakdown>, String> {
    db.get_hourly_category_breakdown(&date)
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
fn get_daily_category_breakdown(
    start_date: String,
    end_date: String,
    db: tauri::State<Arc<Database>>,
) -> Result<Vec<DailyCategoryBreakdown>, String> {
    db.get_daily_category_breakdown(&start_date, &end_date)
}

#[tauri::command]
fn get_all_categories(db: tauri::State<Arc<Database>>) -> Result<Vec<CategoryItem>, String> {
    db.get_all_categories()
}

#[tauri::command]
fn create_category(
    name: String,
    icon_source: String,
    builtin_icon_key: Option<String>,
    custom_icon_path: Option<String>,
    db: tauri::State<Arc<Database>>,
) -> Result<(), String> {
    db.create_category(
        &name,
        &icon_source,
        builtin_icon_key.as_deref(),
        custom_icon_path.as_deref(),
    )
}

#[tauri::command]
fn update_category(
    id: i64,
    name: String,
    icon_source: String,
    builtin_icon_key: Option<String>,
    custom_icon_path: Option<String>,
    db: tauri::State<Arc<Database>>,
) -> Result<(), String> {
    db.update_category(
        id,
        &name,
        &icon_source,
        builtin_icon_key.as_deref(),
        custom_icon_path.as_deref(),
    )
}

#[tauri::command]
fn delete_category(id: i64, db: tauri::State<Arc<Database>>) -> Result<(), String> {
    db.delete_category(id)
}

#[tauri::command]
fn set_app_category(
    app_name: String,
    category_id: i64,
    db: tauri::State<Arc<Database>>,
) -> Result<(), String> {
    db.set_app_category(&app_name, category_id)
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
async fn get_app_icons_by_names(
    app_names: Vec<String>,
    db: tauri::State<'_, Arc<Database>>,
    icon_cache: tauri::State<'_, Arc<IconCache>>,
) -> Result<std::collections::HashMap<String, String>, String> {
    get_app_icons_impl(&db, &icon_cache, app_names).await
}

async fn get_app_icons_impl(
    db: &tauri::State<'_, Arc<Database>>,
    icon_cache: &tauri::State<'_, Arc<IconCache>>,
    app_names: Vec<String>,
) -> Result<std::collections::HashMap<String, String>, String> {
    use std::collections::HashMap;

    let app_paths = db.get_app_icon_paths_by_names(&app_names)?;

    let cache = icon_cache.inner().clone();

    let map = tokio::task::spawn_blocking(move || -> HashMap<String, String> {
        let mut result = HashMap::new();

        for (name, (app_path, custom_icon_path, default_icon_path)) in &app_paths {
            if let Some(custom_path) = custom_icon_path {
                let icon = cache.get_or_extract(custom_path);
                if !icon.is_empty() {
                    result.insert(name.clone(), icon);
                    continue;
                }
            }

            if let Some(default_path) = default_icon_path {
                let icon = cache.get_or_extract(default_path);
                if !icon.is_empty() {
                    result.insert(name.clone(), icon);
                    continue;
                }
            }

            if let Some(exe_path) = app_path {
                let icon = cache.get_or_extract(exe_path);
                if !icon.is_empty() {
                    result.insert(name.clone(), icon);
                }
            }
        }

        result
    })
    .await
    .map_err(|e| e.to_string())?;

    Ok(map)
}

#[tauri::command]
async fn get_category_file_icons_by_ids(
    category_ids: Vec<i64>,
    db: tauri::State<'_, Arc<Database>>,
    icon_cache: tauri::State<'_, Arc<IconCache>>,
) -> Result<std::collections::HashMap<i64, String>, String> {
    use std::collections::HashMap;

    let category_icon_paths = db.get_category_icon_map()?;
    let cache = icon_cache.inner().clone();

    let map = tokio::task::spawn_blocking(move || -> HashMap<i64, String> {
        let mut result = HashMap::new();
        for (id, path) in &category_icon_paths {
            if !category_ids.is_empty() && !category_ids.contains(id) {
                continue;
            }
            let icon = cache.get_or_extract(path);
            if !icon.is_empty() {
                result.insert(*id, icon);
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
fn get_app_filter_options(
    db: tauri::State<Arc<Database>>,
) -> Result<Vec<AppFilterOption>, String> {
    db.get_app_filter_options()
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
        .plugin(tauri_plugin_dialog::init())
        .setup(|app: &mut App| {
            let app_dir = std::env::current_exe()
                .ok()
                .and_then(|p| p.parent().map(|p| p.to_path_buf()))
                .expect("failed to resolve exe directory");

            let database = Arc::new(Database::new(app_dir).expect("failed to initialize database"));

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
            get_category_summary,
            get_hourly_app_breakdown,
            get_hourly_category_breakdown,
            get_daily_app_breakdown,
            get_daily_category_breakdown,
            get_all_categories,
            create_category,
            update_category,
            delete_category,
            set_app_category,
            start_tracking,
            flush_tracking,
            get_setting,
            set_setting,
            get_all_app_names,
            get_app_icons_by_names,
            get_category_file_icons_by_ids,
            get_all_records,
            get_records_range,
            get_record_count,
            import_records_batch,
            get_all_app_metadata_list,
            get_app_filter_options,
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
