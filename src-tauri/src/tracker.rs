use chrono::Local;
use serde::Serialize;
use std::sync::{Arc, Mutex};
use std::time::Duration;
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
        }
    }
}

#[cfg(target_os = "windows")]
mod platform {
    use windows::Win32::System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_FORMAT,
        PROCESS_QUERY_INFORMATION, PROCESS_VM_READ,
    };
    use windows::Win32::UI::Input::KeyboardAndMouse::{GetLastInputInfo, LASTINPUTINFO};
    use windows::Win32::UI::WindowsAndMessaging::{
        GetForegroundWindow, GetWindowTextLengthW, GetWindowTextW,
        GetWindowThreadProcessId,
    };
    use windows::core::PWSTR;

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

            let name = if app_name.is_empty() { title.clone() } else { app_name };

            Some((name, title, path))
        }
    }

    fn get_process_info(pid: u32) -> (String, Option<String>) {
        unsafe {
            let handle = match OpenProcess(
                PROCESS_QUERY_INFORMATION | PROCESS_VM_READ,
                false,
                pid,
            ) {
                Ok(h) => h,
                Err(_) => return (String::new(), None),
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

pub fn start_tracking(app: AppHandle, tracker: Arc<Tracker>) {
    let db = tracker.db.clone();
    let state = tracker.state.clone();
    let icon_cache = tracker.icon_cache.clone();
    let idle_threshold_seconds: u32 = 300;

    std::thread::spawn(move || {
        let mut last_app: Option<String> = None;
        let mut last_start: Option<chrono::DateTime<Local>> = None;

        loop {
            std::thread::sleep(Duration::from_secs(2));

            let now = Local::now();
            let today = now.format("%Y-%m-%d").to_string();
            let idle_secs = get_idle_seconds();
            let is_idle = idle_secs > idle_threshold_seconds;

            let mut current_state = state.lock().unwrap();

            if is_idle && !current_state.is_afk {
                if let (Some(ref app), Some(start)) = (&last_app, last_start) {
                    let duration = (now - start).num_seconds();
                    if duration > 0 {
                        let start_str = start.format("%Y-%m-%d %H:%M:%S").to_string();
                        let end_str = now.format("%Y-%m-%d %H:%M:%S").to_string();
                        let hour = start.format("%H").to_string().parse::<i32>().unwrap_or(0);
                        let _ = db.insert_usage(
                            app, None, None,
                            &start_str, &end_str, duration,
                            &start.format("%Y-%m-%d").to_string(), hour,
                        );
                    }
                }
                last_app = Some("AFK".to_string());
                last_start = None;
                current_state.is_afk = true;
                current_state.current_app = "AFK".to_string();
                current_state.current_title = format!("空闲 {} 秒", idle_secs);
                current_state.current_icon = String::new();
            }

            if !is_idle {
                current_state.is_afk = false;

                if let Some((app_name, window_title, app_path)) = get_active_window_info() {
                    current_state.current_app = app_name.clone();
                    current_state.current_title = window_title.clone();

                    // Extract icon for new app
                    if last_app.as_ref() != Some(&app_name) {
                        if let Some(ref path) = app_path {
                            current_state.current_icon = icon_cache.get_or_extract(path);
                        } else {
                            current_state.current_icon = String::new();
                        }
                    }

                    let app_changed = last_app.as_ref() != Some(&app_name);

                    if app_changed {
                        if let (Some(ref prev_app), Some(start)) = (&last_app, last_start) {
                            if prev_app != "AFK" {
                                let duration = (now - start).num_seconds();
                                if duration > 0 {
                                    let start_str = start.format("%Y-%m-%d %H:%M:%S").to_string();
                                    let end_str = now.format("%Y-%m-%d %H:%M:%S").to_string();
                                    let hour = start.format("%H").to_string().parse::<i32>().unwrap_or(0);
                                    let _ = db.insert_usage(
                                        prev_app, None, None,
                                        &start_str, &end_str, duration,
                                        &start.format("%Y-%m-%d").to_string(), hour,
                                    );
                                }
                            }
                        }

                        last_app = Some(app_name);
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
        }
    });
}
