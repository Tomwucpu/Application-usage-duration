use std::collections::{HashMap, VecDeque};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};

use crossbeam_channel::{bounded, RecvTimeoutError, Sender};
use chrono::Local;
use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::db::Database;
use crate::icon::IconCache;

#[derive(Debug, Clone, Serialize)]
pub struct TrackerState {
    pub is_running: bool,
    pub is_afk: bool,
    pub current_title: String,
    pub today_total_seconds: i64,
    #[serde(skip)]
    pub last_app: Option<String>,
    #[serde(skip)]
    pub last_app_path: Option<String>,
    #[serde(skip)]
    pub last_start: Option<chrono::DateTime<chrono::Local>>,
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
                current_title: String::new(),
                today_total_seconds: 0,
                last_app: None,
                last_app_path: None,
                last_start: None,
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
const NAME_CACHE_MAX: usize = 200;

pub struct NameCache {
    cache: Mutex<HashMap<String, Option<String>>>,
    order: Mutex<VecDeque<String>>,
}

impl NameCache {
    pub fn new() -> Self {
        NameCache {
            cache: Mutex::new(HashMap::new()),
            order: Mutex::new(VecDeque::new()),
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
        let mut cache = self.cache.lock().unwrap();
        cache.insert(exe_path.to_string(), desc.clone());

        let mut order = self.order.lock().unwrap();
        order.push_back(exe_path.to_string());
        while order.len() > NAME_CACHE_MAX {
            if let Some(oldest) = order.pop_front() {
                cache.remove(&oldest);
            }
        }

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
    use windows::Win32::Foundation::HWND;
    use windows::Win32::System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_FORMAT, PROCESS_QUERY_INFORMATION,
        PROCESS_QUERY_LIMITED_INFORMATION,
    };
    use windows::Win32::UI::Accessibility::{
        SetWinEventHook, UnhookWinEvent, HWINEVENTHOOK,
    };
    use windows::Win32::UI::Input::KeyboardAndMouse::{GetLastInputInfo, LASTINPUTINFO};
    use windows::Win32::UI::WindowsAndMessaging::GetWindowThreadProcessId;

    #[cfg(target_os = "windows")]
    use super::foreground_hook_callback;

    pub fn get_process_info_by_hwnd(hwnd: isize) -> Option<(String, String, Option<String>)> {
        unsafe {
            let hwnd = HWND(hwnd);
            let mut pid: u32 = 0;
            GetWindowThreadProcessId(hwnd, Some(&mut pid));
            let (app_name, path) = get_process_info(pid);

            let name = if app_name.is_empty() {
                String::new()
            } else {
                app_name
            };

            Some((name, String::new(), path))
        }
    }

    pub fn register_hook() -> HWINEVENTHOOK {
        unsafe {
            SetWinEventHook(
                3,  // EVENT_SYSTEM_FOREGROUND
                3,  // EVENT_SYSTEM_FOREGROUND
                None,
                Some(foreground_hook_callback),
                0,
                0,
                0,  // WINEVENT_OUTOFCONTEXT
            )
        }
    }

    pub fn unregister_hook(hook: HWINEVENTHOOK) {
        unsafe {
            let _ = UnhookWinEvent(hook);
        }
    }

    fn get_process_info(pid: u32) -> (String, Option<String>) {
        unsafe {
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
    use std::ffi::c_void;

    pub fn get_process_info_by_hwnd(_hwnd: isize) -> Option<(String, String, Option<String>)> {
        None
    }
    pub fn register_hook() -> *mut c_void {
        std::ptr::null_mut()
    }
    pub fn unregister_hook(_hook: *mut c_void) {}
    pub fn get_idle_seconds() -> u32 {
        0
    }
}

use platform::{get_process_info_by_hwnd, get_idle_seconds, register_hook, unregister_hook};

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

pub(crate) fn should_ignore_app(db: &Database, app: &str) -> bool {
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

pub fn flush_tracking(db: &Database, state: &Mutex<TrackerState>) -> Result<(), String> {
    let now = Local::now();

    struct FlushRecord {
        app: String,
        app_path: Option<String>,
        start_str: String,
        end_str: String,
        duration: i64,
        date_str: String,
        hour: i32,
    }

    let record = {
        let mut current_state = state.lock().map_err(|e| e.to_string())?;

        let app = current_state.last_app.clone();
        let start = current_state.last_start;

        if let (Some(ref app), Some(start)) = (&app, start) {
            if app != "AFK" {
                let duration = (now - start).num_seconds();
                let is_ignored = should_ignore_app(db, app);

                if duration > 0 {
                    current_state.last_start = Some(now);

                    if !is_ignored {
                        let start_str = start.format("%Y-%m-%d %H:%M:%S").to_string();
                        let end_str = now.format("%Y-%m-%d %H:%M:%S").to_string();
                        let hour = start.format("%H").to_string().parse::<i32>().unwrap_or(0);
                        let date_str = start.format("%Y-%m-%d").to_string();

                        Some(FlushRecord {
                            app: app.clone(),
                            app_path: current_state.last_app_path.clone(),
                            start_str,
                            end_str,
                            duration,
                            date_str,
                            hour,
                        })
                    } else {
                        None
                    }
                } else {
                    None
                }
            } else {
                current_state.last_start = Some(now);
                None
            }
        } else {
            None
        }
    };

    if let Some(r) = record {
        db.insert_usage(
            &r.app,
            r.app_path.as_deref(),
            None,
            &r.start_str,
            &r.end_str,
            r.duration,
            &r.date_str,
            r.hour,
        )?;
    }

    Ok(())
}

pub fn start_tracking(app: AppHandle, tracker: Arc<Tracker>) {
    if tracker.thread_spawned.swap(true, Ordering::SeqCst) {
        return;
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

    // Set up channel: WinEvent callback pushes events, worker thread receives
    let (tx, rx) = bounded::<ForegroundEvent>(64);
    HOOK_SENDER.set(tx).ok();

    let hook = register_hook();

    // Capture current foreground window as initial event,
    // so tracking works immediately without needing a window switch.
    #[cfg(target_os = "windows")]
    if let Some(sender) = HOOK_SENDER.get() {
        let hwnd = unsafe { windows::Win32::UI::WindowsAndMessaging::GetForegroundWindow() };
        let _ = sender.send(ForegroundEvent { hwnd: hwnd.0 });
    }

    std::thread::spawn(move || {
        let name_cache = NameCache::new();
        let mut persisted_metadata: std::collections::HashSet<String> =
            std::collections::HashSet::new();
        let mut was_running = true;
        let mut last_afk_check = std::time::Instant::now();

        loop {
            match rx.recv_timeout(std::time::Duration::from_secs(10)) {
                Ok(event) => {
                    // Foreground window changed — process it
                    process_foreground_change(
                        event.hwnd,
                        &db,
                        &state,
                        &icon_cache,
                        &name_cache,
                        &mut persisted_metadata,
                        idle_threshold_seconds,
                        &mut was_running,
                        &app,
                        &mut last_afk_check,
                    );
                }
                Err(RecvTimeoutError::Timeout) => {
                    // No foreground change — check AFK transition
                    check_afk_transition(
                        &db,
                        &state,
                        idle_threshold_seconds,
                        &mut was_running,
                        &app,
                    );
                    last_afk_check = std::time::Instant::now();
                }
                Err(RecvTimeoutError::Disconnected) => break,
            }

            update_today_and_emit(&db, &state, &app);
        }

        unregister_hook(hook);
    });
}

// ── Static channel + WinEvent callback ──────────────────────────

struct ForegroundEvent {
    hwnd: isize,
}

static HOOK_SENDER: OnceLock<Sender<ForegroundEvent>> = OnceLock::new();

#[cfg(target_os = "windows")]
extern "system" fn foreground_hook_callback(
    _hook: windows::Win32::UI::Accessibility::HWINEVENTHOOK,
    _event: u32,
    hwnd: windows::Win32::Foundation::HWND,
    _id_object: i32,
    _id_child: i32,
    _thread_id: u32,
    _time: u32,
) {
    if let Some(sender) = HOOK_SENDER.get() {
        let _ = sender.send(ForegroundEvent { hwnd: hwnd.0 });
    }
}

// ── Core helpers ────────────────────────────────────────────────

fn process_foreground_change(
    hwnd: isize,
    db: &Database,
    state: &Mutex<TrackerState>,
    _icon_cache: &IconCache,
    name_cache: &NameCache,
    persisted_metadata: &mut std::collections::HashSet<String>,
    idle_threshold: u32,
    was_running: &mut bool,
    app_handle: &AppHandle,
    last_afk_check: &mut std::time::Instant,
) {
    let now = Local::now();
    let idle_secs = get_idle_seconds();
    let is_idle = idle_secs > idle_threshold;

    let window_info = if !is_idle {
        get_process_info_by_hwnd(hwnd)
    } else {
        None
    };

    let mut current_state = state.lock().unwrap();

    let just_paused = *was_running && !current_state.is_running;
    let just_resumed = !*was_running && current_state.is_running;
    *was_running = current_state.is_running;

    if !current_state.is_running {
        if just_paused {
            finalize_current_session(db, &mut current_state, now);
            current_state.last_start = None;
        }
        let state_clone = current_state.clone();
        drop(current_state);
        let _ = app_handle.emit("tracker-state", &state_clone);
        return;
    }

    if just_resumed {
        current_state.last_start = Some(now);
    }

    // Handle AFK → active transition
    if !is_idle && current_state.is_afk {
        // Coming back from AFK
        if let (Some(ref app), Some(_start)) =
            (&current_state.last_app, current_state.last_start)
        {
            if app == "AFK" {
                // AFK duration was recorded when entering AFK;
                // reset last_start so new app tracking begins fresh
                current_state.last_start = Some(now);
            }
        }
        current_state.is_afk = false;
    }

    // Handle active → AFK transition
    if is_idle && !current_state.is_afk {
        finalize_current_session(db, &mut current_state, now);
        current_state.last_app = Some("AFK".to_string());
        current_state.last_app_path = None;
        current_state.last_start = None;
        current_state.is_afk = true;
        current_state.current_title = format!("空闲 {} 秒", idle_secs);
    }

    if !is_idle {
        current_state.is_afk = false;

        if let Some((app_name, _window_title, app_path)) = window_info.as_ref() {
            let app_name = app_name.clone();
            let app_path = app_path.clone();
            let display_name = app_path
                .as_ref()
                .and_then(|p| name_cache.resolve(p))
                .unwrap_or_else(|| app_name.clone());

            current_state.current_title = String::new();

            // Persist app→path mapping (once per app)
            if let Some(ref path) = app_path {
                if !persisted_metadata.contains(&display_name) {
                    let _ = db.upsert_app_metadata(&display_name, path);
                    persisted_metadata.insert(display_name.clone());
                }
            }

            let app_changed =
                current_state.last_app.as_ref() != Some(&display_name);

            if app_changed {
                finalize_current_session(db, &mut current_state, now);

                current_state.last_app = Some(display_name);
                current_state.last_app_path = app_path.clone();
                current_state.last_start = Some(now);
            }
        }
    }

    *last_afk_check = std::time::Instant::now();
    let state_clone = current_state.clone();
    drop(current_state);
    let _ = app_handle.emit("tracker-state", &state_clone);
    update_tray_tooltip(app_handle, &state_clone);
}

fn finalize_current_session(
    db: &Database,
    state: &mut TrackerState,
    now: chrono::DateTime<chrono::Local>,
) {
    if let (Some(ref app), Some(start)) = (&state.last_app, state.last_start) {
        if app != "AFK" {
            let duration = (now - start).num_seconds();
            let is_ignored = should_ignore_app(db, app);
            if duration > 0 && !is_ignored {
                let start_str = start.format("%Y-%m-%d %H:%M:%S").to_string();
                let end_str = now.format("%Y-%m-%d %H:%M:%S").to_string();
                let hour = start.format("%H").to_string().parse::<i32>().unwrap_or(0);
                let _ = db.insert_usage(
                    app,
                    state.last_app_path.as_deref(),
                    None,
                    &start_str,
                    &end_str,
                    duration,
                    &start.format("%Y-%m-%d").to_string(),
                    hour,
                );
            }
        }
    }
}

fn check_afk_transition(
    db: &Database,
    state: &Mutex<TrackerState>,
    idle_threshold: u32,
    was_running: &mut bool,
    app_handle: &AppHandle,
) {
    let now = Local::now();
    let idle_secs = get_idle_seconds();
    let is_idle = idle_secs > idle_threshold;

    let mut current_state = state.lock().unwrap();

    if !current_state.is_running {
        *was_running = false;
        return;
    }
    *was_running = true;

    // Active → AFK
    if is_idle && !current_state.is_afk {
        finalize_current_session(db, &mut current_state, now);
        current_state.last_app = Some("AFK".to_string());
        current_state.last_app_path = None;
        current_state.last_start = None;
        current_state.is_afk = true;
        current_state.current_title = format!("空闲 {} 秒", idle_secs);
    }

    // AFK → active
    if !is_idle && current_state.is_afk {
        current_state.is_afk = false;
        current_state.last_start = Some(now);
    }

    let state_clone = current_state.clone();
    drop(current_state);
    let _ = app_handle.emit("tracker-state", &state_clone);
    update_tray_tooltip(app_handle, &state_clone);
}

fn update_today_and_emit(
    db: &Database,
    state: &Mutex<TrackerState>,
    app_handle: &AppHandle,
) {
    let today = Local::now().format("%Y-%m-%d").to_string();
    let total = db.get_today_total_seconds(&today);
    let mut current_state = state.lock().unwrap();

    if let Ok(total) = total {
        current_state.today_total_seconds = total;
    }

    let state_clone = current_state.clone();
    drop(current_state);
    let _ = app_handle.emit("tracker-state", &state_clone);
    update_tray_tooltip(app_handle, &state_clone);
}

fn update_tray_tooltip(app_handle: &AppHandle, state_clone: &TrackerState) {
    if let Some(tray) = app_handle.tray_by_id("main-tray") {
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

#[cfg(test)]
mod tests {
    use super::should_ignore_app_from_settings;
    use std::collections::HashMap;

    #[test]
    fn tracker_state_serialization_omits_current_app_payload() {
        let state = super::TrackerState {
            is_running: true,
            is_afk: false,
            current_title: "workspace".to_string(),
            today_total_seconds: 42,
            last_app: None,
            last_app_path: None,
            last_start: None,
        };

        let json = serde_json::to_value(&state).expect("tracker state should serialize");

        assert_eq!(json.get("current_app"), None);
        assert_eq!(json.get("current_icon"), None);
        assert_eq!(json.get("current_title"), Some(&serde_json::Value::String("workspace".to_string())));
        assert_eq!(json.get("today_total_seconds"), Some(&serde_json::Value::Number(42.into())));
    }

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
