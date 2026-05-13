use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager,
};
use std::sync::Arc;
use crate::tracker::Tracker;

fn toggle_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        match window.is_visible() {
            Ok(true) => {
                let _ = window.hide();
            }
            Ok(false) => {
                let _ = window.show();
                let _ = window.set_focus();
            }
            Err(e) => {
                eprintln!("Failed to check window visibility: {}", e);
            }
        }
    }
}

pub fn create_tray(app: &AppHandle) -> tauri::Result<()> {
    let pause_item = MenuItemBuilder::with_id("pause", "Pause/Resume Tracking")
        .build(app)?;
    let show_item = MenuItemBuilder::with_id("show", "Show/Hide Window")
        .build(app)?;
    let quit_item = MenuItemBuilder::with_id("quit", "Exit")
        .build(app)?;

    let menu = MenuBuilder::new(app)
        .item(&pause_item)
        .item(&show_item)
        .separator()
        .item(&quit_item)
        .build()?;

    let _tray = TrayIconBuilder::with_id("main-tray")
        .icon(app.default_window_icon().cloned().unwrap())
        .menu(&menu)
        .show_menu_on_left_click(false)
        .tooltip("Screen Time Tracker")
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                toggle_window(tray.app_handle());
            }
        })
        .on_menu_event(|app, event| {
            match event.id().as_ref() {
                "pause" => {
                    let tracker = app.state::<Arc<Tracker>>().clone();
                    let is_running = { tracker.state.lock().unwrap().is_running };
                    if is_running {
                        tracker.pause();
                    } else {
                        tracker.resume();
                    }
                }
                "show" => {
                    toggle_window(app);
                }
                "quit" => {
                    app.exit(0);
                }
                _ => {}
            }
        })
        .build(app)?;

    Ok(())
}
