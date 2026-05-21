use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use chrono::Local;
use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::db::Database;
use crate::icon::IconCache;

#[derive(Debug, Clone, Serialize)]
pub struct TrackerState {
    pub is_running: bool,
    pub is_afk: bool,
    pub current_app: String,
    pub current_title: String,
    pub current_icon: String,
    pub today_total_seconds: i64,
}

pub struct Tracker {
    pub state: Arc<Mutex<TrackerState>>,
    db: Arc<Database>,
    icon_cache: Arc<IconCache>,
    thread_spawned: AtomicBool,
}

impl Tracker {
    pub fn new(db: Arc<Database>, icon_cache: Arc<IconCache>) -> Self {
        Tracker {
            state: Arc::new(Mutex::new(TrackerState {
                is_running: true,
                is_afk: false,
                current_app: String::new(),
                current_title: String::new(),
                current_icon: String::new(),
                today_total_seconds: 0,
            })),
            db,
            icon_cache,
            thread_spawned: AtomicBool::new(false),
        }
    }

    pub fn pause(&self) {
        self.state.lock().unwrap().is_running = false;
    }

    pub fn resume(&self) {
        self.state.lock().unwrap().is_running = true;
    }
}

// NameCache: caches FileDescription lookups per executable path,
// so each .exe's version info is only read once.
pub struct NameCache {
    cache: Mutex<HashMap<String, Option<String>>>,
}

impl NameCache {
    pub fn new() -> Self {
        NameCache {
            cache: Mutex::new(HashMap::new()),
        }
    }

    pub fn resolve(&self, exe_path: &str) -> Option<String> {
        {
            let cache = self.cache.lock().unwrap();
            if let Some(entry) = cache.get(exe_path) {
                return entry.clone();
            }
        }

        let desc = get_file_description(exe_path);
        self.cache
            .lock()
            .unwrap()
            .insert(exe_path.to_string(), desc.clone());
        desc
    }
}

#[cfg(target_os = "windows")]
fn get_file_description(full_path: &str) -> Option<String> {
    use windows::core::PCWSTR;
    use windows::Win32::Storage::FileSystem::{
        GetFileVersionInfoSizeW, GetFileVersionInfoW, VerQueryValueW,
    };

    unsafe {
        let wide_path: Vec<u16> = full_path.encode_utf16().chain(std::iter::once(0)).collect();
        let pcwstr = PCWSTR::from_raw(wide_path.as_ptr());

        let mut handle: u32 = 0;
        let size = GetFileVersionInfoSizeW(pcwstr, Some(&mut handle));
        if size == 0 {
            return None;
        }

        let mut buf: Vec<u8> = vec![0u8; size as usize];
        if GetFileVersionInfoW(
            pcwstr,
            handle,
            size,
            buf.as_mut_ptr() as *mut std::ffi::c_void,
        )
        .is_err()
        {
            return None;
        }

        let trans_query = wide_null("\\VarFileInfo\\Translation");
        let trans_pcwstr = PCWSTR::from_raw(trans_query.as_ptr());
        let mut trans_ptr: *mut std::ffi::c_void = std::ptr::null_mut();
        let mut trans_len: u32 = 0;
        if !VerQueryValueW(
            buf.as_ptr() as *const std::ffi::c_void,
            trans_pcwstr,
            &mut trans_ptr,
            &mut trans_len,
        )
        .as_bool()
            || trans_len < 4
        {
            return None;
        }

        let lang = *(trans_ptr as *const u16);
        let cpid = *(trans_ptr as *const u16).add(1);

        let desc_query_str = format!(
            "\\StringFileInfo\\{:04x}{:04x}\\FileDescription",
            lang, cpid
        );
        let desc_query = wide_null(&desc_query_str);
        let desc_pcwstr = PCWSTR::from_raw(desc_query.as_ptr());
        let mut desc_ptr: *mut std::ffi::c_void = std::ptr::null_mut();
        let mut desc_len: u32 = 0;
        if !VerQueryValueW(
            buf.as_ptr() as *const std::ffi::c_void,
            desc_pcwstr,
            &mut desc_ptr,
            &mut desc_len,
        )
        .as_bool()
            || desc_len == 0
            || desc_ptr.is_null()
        {
            return None;
        }

        let desc = String::from_utf16_lossy(std::slice::from_raw_parts(
            desc_ptr as *const u16,
            desc_len as usize,
        ));
        let desc = desc.trim_end_matches('\0').trim().to_string();
        if desc.is_empty() {
            None
        } else {
            Some(desc)
        }
    }
}

#[cfg(not(target_os = "windows"))]
fn get_file_description(_full_path: &str) -> Option<String> {
    None
}

fn wide_null(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(std::iter::once(0)).collect()
}

#[cfg(target_os = "windows")]
mod platform {
    use windows::core::PWSTR;
    use windows::Win32::System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_FORMAT, PROCESS_QUERY_INFORMATION,
        PROCESS_QUERY_LIMITED_INFORMATION,
    };
    use windows::Win32::UI::Input::KeyboardAndMouse::{GetLastInputInfo, LASTINPUTINFO};
    use windows::Win32::UI::WindowsAndMessaging::{
        GetForegroundWindow, GetWindowTextLengthW, GetWindowTextW, GetWindowThreadProcessId,
    };

    pub fn get_active_window_info() -> Option<(String, String, Option<String>)> {
        unsafe {
            let hwnd = GetForegroundWindow();
            if hwnd.0 == 0 {
                return None;
            }

            let len = GetWindowTextLengthW(hwnd);
            let mut title = String::new();
            if len > 0 {
                let mut buf = vec![0u16; (len + 1) as usize];
                GetWindowTextW(hwnd, &mut buf);
                title = String::from_utf16_lossy(&buf[..len as usize])
                    .trim()
                    .to_string();
            }

            let mut pid: u32 = 0;
            GetWindowThreadProcessId(hwnd, Some(&mut pid));
            let (app_name, path) = get_process_info(pid);

            let name = if app_name.is_empty() {
                title.clone()
            } else {
                app_name
            };

            Some((name, title, path))
        }
    }

    fn get_process_info(pid: u32) -> (String, Option<String>) {
        unsafe {
            // Try PROCESS_QUERY_INFORMATION first, fall back to LIMITED
            let handle = OpenProcess(PROCESS_QUERY_INFORMATION, false, pid)
                .or_else(|_| OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid));

            let handle = match handle {
                Ok(h) => h,
                Err(e) => {
                    eprintln!("[tracker] OpenProcess failed for pid={}: {:?}", pid, e);
                    return (String::new(), None);
                }
            };

            let mut buf = vec![0u16; 512];
            let mut len = buf.len() as u32;

            let full_path = if QueryFullProcessImageNameW(
                handle,
                PROCESS_NAME_FORMAT(0),
                PWSTR(buf.as_mut_ptr()),
                &mut len,
            )
            .is_ok()
            {
                let s = String::from_utf16_lossy(&buf[..len as usize])
                    .trim_end_matches('\0')
                    .to_string();
                Some(s)
            } else {
                None
            };

            let name = full_path
                .as_ref()
                .and_then(|p| {
                    std::path::Path::new(p)
                        .file_stem()
                        .and_then(|s| s.to_str())
                        .map(|s| s.to_string())
                })
                .unwrap_or_default();

            (name, full_path)
        }
    }

    pub fn get_idle_seconds() -> u32 {
        unsafe {
            let mut lii = LASTINPUTINFO {
                cbSize: std::mem::size_of::<LASTINPUTINFO>() as u32,
                dwTime: 0,
            };
            if GetLastInputInfo(&mut lii).as_bool() {
                let tick_count = windows::Win32::System::SystemInformation::GetTickCount();
                (tick_count - lii.dwTime) / 1000
            } else {
                0
            }
        }
    }
}

#[cfg(target_os = "macos")]
mod platform {
    pub fn get_active_window_info() -> Option<(String, String, Option<String>)> {
        None
    }
    pub fn get_idle_seconds() -> u32 {
        0
    }
}

use platform::{get_active_window_info, get_idle_seconds};

fn should_ignore_app_from_settings(settings: Option<&HashMap<String, String>>, app: &str) -> bool {
    let Some(settings) = settings else {
        return false;
    };

    let ignored_apps = settings
        .get("ignored_apps")
        .and_then(|value| serde_json::from_str::<Vec<String>>(value).ok())
        .unwrap_or_default();

    let ignored_enabled = settings
        .get("ignored_apps_enabled")
        .map(|value| value == "true")
        .unwrap_or_else(|| !ignored_apps.is_empty());

    ignored_enabled && ignored_apps.iter().any(|name| name == app)
}

fn should_ignore_app(db: &Database, app: &str) -> bool {
    let ignored_apps_enabled = db
        .get_setting("ignored_apps_enabled")
        .ok()
        .flatten()
        .map(|value| ("ignored_apps_enabled".to_string(), value));
    let ignored_apps = db
        .get_setting("ignored_apps")
        .ok()
        .flatten()
        .map(|value| ("ignored_apps".to_string(), value));

    let settings: HashMap<String, String> = ignored_apps_enabled
        .into_iter()
        .chain(ignored_apps)
        .collect();

    should_ignore_app_from_settings(Some(&settings), app)
}

pub fn start_tracking(app: AppHandle, tracker: Arc<Tracker>) {
    if tracker.thread_spawned.swap(true, Ordering::SeqCst) {
        return; // Tracking thread already running
    }

    let db = tracker.db.clone();
    let state = tracker.state.clone();
    let icon_cache = tracker.icon_cache.clone();
    let idle_threshold_seconds: u32 = db
        .get_setting("afk_threshold_seconds")
        .ok()
        .flatten()
        .and_then(|s| s.parse().ok())
        .unwrap_or(300);

    std::thread::spawn(move || {
        let name_cache = NameCache::new();
        let mut last_app: Option<String> = None;
        let mut last_app_path: Option<String> = None;
        let mut last_window_title: Option<String> = None;
        let mut last_start: Option<chrono::DateTime<Local>> = None;
        let mut was_running = true;
        let mut persisted_metadata: std::collections::HashSet<String> =
            std::collections::HashSet::new();

        loop {
            std::thread::sleep(Duration::from_secs(2));

            let now = Local::now();
            let today = now.format("%Y-%m-%d").to_string();
            let idle_secs = get_idle_seconds();
            let is_idle = idle_secs > idle_threshold_seconds;
            let window_info = if !is_idle { get_active_window_info() } else { None };

            let mut current_state = state.lock().unwrap();

            let just_paused = was_running && !current_state.is_running;
            let just_resumed = !was_running && current_state.is_running;
            was_running = current_state.is_running;

            if !current_state.is_running {
                if just_paused {
                    if let (Some(ref app), Some(start)) = (&last_app, last_start) {
                        if app != "AFK" {
                            let duration = (now - start).num_seconds();
                            let is_ignored = should_ignore_app(db.as_ref(), app);
                            if duration > 0 && !is_ignored {
                                let start_str = start.format("%Y-%m-%d %H:%M:%S").to_string();
                                let end_str = now.format("%Y-%m-%d %H:%M:%S").to_string();
                                let hour =
                                    start.format("%H").to_string().parse::<i32>().unwrap_or(0);
                                let _ = db.insert_usage(
                                    app,
                                    last_app_path.as_deref(),
                                    last_window_title.as_deref(),
                                    &start_str,
                                    &end_str,
                                    duration,
                                    &start.format("%Y-%m-%d").to_string(),
                                    hour,
                                );
                            }
                        }
                    }
                    last_start = None;
                }
                let state_clone = current_state.clone();
                drop(current_state);

                let _ = app.emit("tracker-state", &state_clone);
                continue;
            }

            if just_resumed {
                last_start = Some(now);
            }

            if is_idle && !current_state.is_afk {
                if let (Some(ref app), Some(start)) = (&last_app, last_start) {
                    let duration = (now - start).num_seconds();
                    let is_ignored = should_ignore_app(db.as_ref(), app);
                    if duration > 0 && !is_ignored {
                        let start_str = start.format("%Y-%m-%d %H:%M:%S").to_string();
                        let end_str = now.format("%Y-%m-%d %H:%M:%S").to_string();
                        let hour = start.format("%H").to_string().parse::<i32>().unwrap_or(0);
                        let _ = db.insert_usage(
                            app,
                            last_app_path.as_deref(),
                            last_window_title.as_deref(),
                            &start_str,
                            &end_str,
                            duration,
                            &start.format("%Y-%m-%d").to_string(),
                            hour,
                        );
                    }
                }
                last_app = Some("AFK".to_string());
                last_app_path = None;
                last_window_title = None;
                last_start = None;
                current_state.is_afk = true;
                current_state.current_app = "AFK".to_string();
                current_state.current_title = format!("空闲 {} 秒", idle_secs);
                current_state.current_icon = String::new();
            }

            if !is_idle {
                current_state.is_afk = false;

                if let Some((app_name, window_title, app_path)) = window_info.as_ref() {
                    let app_name = app_name.clone();
                    let window_title = window_title.clone();
                    let app_path = app_path.clone();
                    let display_name = app_path
                        .as_ref()
                        .and_then(|p| name_cache.resolve(p))
                        .unwrap_or_else(|| app_name.clone());

                    current_state.current_app = display_name.clone();
                    current_state.current_title = window_title.clone();

                    // Persist app->path mapping for icon lookup (only once per app)
                    if let Some(ref path) = app_path {
                        if !persisted_metadata.contains(&display_name) {
                            let _ = db.upsert_app_metadata(&display_name, path);
                            persisted_metadata.insert(display_name.clone());
                        }
                    }

                    // Extract icon for new app
                    if last_app.as_ref() != Some(&display_name) {
                        if let Some(ref path) = app_path {
                            current_state.current_icon = icon_cache.get_or_extract(path);
                        } else {
                            current_state.current_icon = String::new();
                        }
                    }

                    let app_changed = last_app.as_ref() != Some(&display_name);

                    if app_changed {
                        if let (Some(ref prev_app), Some(start)) = (&last_app, last_start) {
                            if prev_app != "AFK" {
                                let duration = (now - start).num_seconds();
                                let is_ignored = should_ignore_app(db.as_ref(), prev_app);
                                if duration > 0 && !is_ignored {
                                    let start_str = start.format("%Y-%m-%d %H:%M:%S").to_string();
                                    let end_str = now.format("%Y-%m-%d %H:%M:%S").to_string();
                                    let hour =
                                        start.format("%H").to_string().parse::<i32>().unwrap_or(0);
                                    let _ = db.insert_usage(
                                        prev_app,
                                        last_app_path.as_deref(),
                                        last_window_title.as_deref(),
                                        &start_str,
                                        &end_str,
                                        duration,
                                        &start.format("%Y-%m-%d").to_string(),
                                        hour,
                                    );
                                }
                            }
                        }

                        last_app = Some(display_name);
                        last_app_path = app_path.clone();
                        last_window_title = Some(window_title.clone());
                        last_start = Some(now);
                    }
                }
            }

            if let Ok(total) = db.get_today_total_seconds(&today) {
                current_state.today_total_seconds = total;
            }

            let state_clone = current_state.clone();
            drop(current_state);

            let _ = app.emit("tracker-state", &state_clone);

            // Update tray tooltip
            if let Some(tray) = app.tray_by_id("main-tray") {
                let h = state_clone.today_total_seconds / 3600;
                let m = (state_clone.today_total_seconds % 3600) / 60;
                let tooltip = if state_clone.is_running {
                    format!("Screen Time - {}h {}m today", h, m)
                } else {
                    format!("Screen Time - Paused ({}h {}m today)", h, m)
                };
                let _ = tray.set_tooltip(Some(&tooltip));
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::should_ignore_app_from_settings;
    use std::collections::HashMap;

    #[test]
    fn ignores_listed_app_when_feature_enabled() {
        let settings = HashMap::from([
            ("ignored_apps_enabled".to_string(), "true".to_string()),
            ("ignored_apps".to_string(), "[\"WeChat\"]".to_string()),
        ]);

        assert!(should_ignore_app_from_settings(Some(&settings), "WeChat"));
    }

    #[test]
    fn does_not_ignore_when_feature_disabled_even_if_listed() {
        let settings = HashMap::from([
            ("ignored_apps_enabled".to_string(), "false".to_string()),
            ("ignored_apps".to_string(), "[\"WeChat\"]".to_string()),
        ]);

        assert!(!should_ignore_app_from_settings(Some(&settings), "WeChat"));
    }

    #[test]
    fn falls_back_to_enabled_when_flag_missing_and_list_has_items() {
        let settings = HashMap::from([("ignored_apps".to_string(), "[\"WeChat\"]".to_string())]);

        assert!(should_ignore_app_from_settings(Some(&settings), "WeChat"));
    }

    #[test]
    fn falls_back_to_disabled_when_flag_missing_and_list_is_empty() {
        let settings = HashMap::from([("ignored_apps".to_string(), "[]".to_string())]);

        assert!(!should_ignore_app_from_settings(Some(&settings), "WeChat"));
    }

    #[test]
    fn falls_back_to_disabled_when_flag_and_list_are_missing() {
        let settings = HashMap::new();

        assert!(!should_ignore_app_from_settings(Some(&settings), "WeChat"));
    }
}
