use std::collections::{HashMap, VecDeque};
use std::sync::Mutex;

pub struct IconCache {
    cache: Mutex<BoundedIconMap>,
}

const ICON_CACHE_MAX: usize = 200;

struct BoundedIconMap {
    map: HashMap<String, String>,
    order: VecDeque<String>,
    capacity: usize,
}

impl BoundedIconMap {
    fn new(capacity: usize) -> Self {
        Self {
            map: HashMap::new(),
            order: VecDeque::new(),
            capacity,
        }
    }

    fn get(&mut self, key: &str) -> Option<String> {
        let value = self.map.get(key).cloned();
        if value.is_some() {
            self.touch(key);
        }
        value
    }

    fn insert(&mut self, key: String, value: String) {
        self.map.insert(key.clone(), value);
        self.touch(&key);

        while self.order.len() > self.capacity {
            if let Some(oldest) = self.order.pop_front() {
                self.map.remove(&oldest);
            }
        }
    }

    fn touch(&mut self, key: &str) {
        if let Some(index) = self.order.iter().position(|item| item == key) {
            self.order.remove(index);
        }
        self.order.push_back(key.to_string());
    }
}

impl IconCache {
    pub fn new() -> Self {
        IconCache {
            cache: Mutex::new(BoundedIconMap::new(ICON_CACHE_MAX)),
        }
    }

    pub fn get_or_extract(&self, app_path: &str) -> String {
        let mut cache = self.cache.lock().unwrap();
        if let Some(icon) = cache.get(app_path) {
            if !icon.is_empty() {
                return icon;
            }
        }

        let icon = extract_icon_base64(app_path).unwrap_or_default();

        if !icon.is_empty() {
            cache.insert(app_path.to_string(), icon.clone());
        }

        icon
    }
}

#[cfg(target_os = "windows")]
fn extract_icon_base64(exe_path: &str) -> Option<String> {
    use image::ImageEncoder;
    use windows::core::PCWSTR;
    use windows::Win32::Graphics::Gdi::{
        CreateCompatibleDC, DeleteDC, DeleteObject, GetDIBits, SelectObject, BITMAPINFO,
        BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS, RGBQUAD,
    };
    use windows::Win32::Storage::FileSystem::FILE_FLAGS_AND_ATTRIBUTES;
    use windows::Win32::UI::Shell::{SHGetFileInfoW, SHFILEINFOW, SHGFI_ICON, SHGFI_LARGEICON};
    use windows::Win32::UI::WindowsAndMessaging::{
        DestroyIcon, DrawIconEx, GetIconInfo, DI_NORMAL, ICONINFO,
    };

    // If the path is an image file (png/jpg/gif/bmp/ico), load it directly
    let ext = std::path::Path::new(exe_path)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase());
    if matches!(
        ext.as_deref(),
        Some("png" | "jpg" | "jpeg" | "gif" | "bmp" | "ico")
    ) {
        if let Ok(img) = image::open(exe_path) {
            let rgba = img
                .resize_exact(32, 32, image::imageops::FilterType::Lanczos3)
                .to_rgba8();
            let mut png_bytes = Vec::new();
            let encoder = image::codecs::png::PngEncoder::new(&mut png_bytes);
            encoder
                .write_image(&rgba, 32, 32, image::ExtendedColorType::Rgba8)
                .ok()?;
            let b64 = base64::Engine::encode(
                &base64::engine::general_purpose::STANDARD,
                &png_bytes,
            );
            return Some(b64);
        }
    }

    unsafe {
        let path_wide: Vec<u16> = exe_path.encode_utf16().chain(std::iter::once(0)).collect();

        let mut sfi = SHFILEINFOW::default();
        let ret = SHGetFileInfoW(
            PCWSTR(path_wide.as_ptr()),
            FILE_FLAGS_AND_ATTRIBUTES(0),
            Some(&mut sfi),
            std::mem::size_of::<SHFILEINFOW>() as u32,
            SHGFI_ICON | SHGFI_LARGEICON,
        );
        if ret == 0 || sfi.hIcon.is_invalid() {
            eprintln!("[icon] SHGetFileInfoW failed for: {}", exe_path);
            return None;
        }

        let hicon = sfi.hIcon;

        let mut icon_info = ICONINFO::default();
        if GetIconInfo(hicon, &mut icon_info).is_err() {
            eprintln!("[icon] GetIconInfo failed for: {}", exe_path);
            let _ = DestroyIcon(hicon);
            return None;
        }

        let width: i32 = 32;
        let height: i32 = 32;

        let hdc = CreateCompatibleDC(None);
        if hdc.is_invalid() {
            eprintln!("[icon] CreateCompatibleDC failed for: {}", exe_path);
            let _ = DestroyIcon(hicon);
            return None;
        }

        let mut pixels_ptr = std::ptr::null_mut();
        let bmi2 = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: width,
                biHeight: -height,
                biPlanes: 1,
                biBitCount: 32,
                biCompression: BI_RGB.0,
                biSizeImage: 0,
                biXPelsPerMeter: 0,
                biYPelsPerMeter: 0,
                biClrUsed: 0,
                biClrImportant: 0,
            },
            bmiColors: [RGBQUAD::default(); 1],
        };
        let hbm = windows::Win32::Graphics::Gdi::CreateDIBSection(
            hdc,
            &bmi2 as *const _,
            DIB_RGB_COLORS,
            &mut pixels_ptr,
            None,
            0,
        )
        .unwrap_or_default();
        if hbm.is_invalid() {
            eprintln!("[icon] CreateDIBSection failed for: {}", exe_path);
            let _ = DeleteDC(hdc);
            let _ = DestroyIcon(hicon);
            return None;
        }

        let old_bm = SelectObject(hdc, hbm);

        let _ = DrawIconEx(hdc, 0, 0, hicon, width, height, 0, None, DI_NORMAL);

        let data_size = (width * height * 4) as usize;
        let mut pixels: Vec<u8> = vec![0u8; data_size];

        let mut bmi = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: width,
                biHeight: -height,
                biPlanes: 1,
                biBitCount: 32,
                biCompression: BI_RGB.0,
                biSizeImage: 0,
                biXPelsPerMeter: 0,
                biYPelsPerMeter: 0,
                biClrUsed: 0,
                biClrImportant: 0,
            },
            bmiColors: [RGBQUAD::default(); 1],
        };

        GetDIBits(
            hdc,
            hbm,
            0,
            height as u32,
            Some(pixels.as_mut_ptr() as *mut _),
            &mut bmi,
            DIB_RGB_COLORS,
        );

        // Clean up GDI objects
        let _ = SelectObject(hdc, old_bm);
        let _ = DeleteObject(hbm);
        let _ = DeleteDC(hdc);
        let _ = DestroyIcon(hicon);
        if !icon_info.hbmColor.is_invalid() {
            let _ = DeleteObject(icon_info.hbmColor);
        }
        if !icon_info.hbmMask.is_invalid() {
            let _ = DeleteObject(icon_info.hbmMask);
        }

        // Convert BGRA to RGBA
        let mut has_alpha = false;
        for i in (0..data_size).step_by(4) {
            if pixels[i + 3] > 0 {
                has_alpha = true;
                break;
            }
        }

        for i in (0..data_size).step_by(4) {
            let b = pixels[i];
            let g = pixels[i + 1];
            let r = pixels[i + 2];
            pixels[i] = r;
            pixels[i + 1] = g;
            pixels[i + 2] = b;

            if !has_alpha && (r > 0 || g > 0 || b > 0) {
                pixels[i + 3] = 255;
            }
        }

        let mut png_bytes: Vec<u8> = Vec::new();
        let encoder = image::codecs::png::PngEncoder::new(&mut png_bytes);
        encoder
            .write_image(
                &pixels,
                width as u32,
                height as u32,
                image::ExtendedColorType::Rgba8,
            )
            .ok()?;

        let b64 = base64::Engine::encode(
            &base64::engine::general_purpose::STANDARD,
            &png_bytes,
        );

        Some(b64)
    }
}

#[cfg(not(target_os = "windows"))]
fn extract_icon_base64(_exe_path: &str) -> Option<String> {
    None
}

#[cfg(test)]
mod tests {
    use super::BoundedIconMap;

    #[test]
    fn evicts_oldest_key_when_capacity_is_exceeded() {
        let mut cache = BoundedIconMap::new(2);
        cache.insert("chrome".to_string(), "icon-1".to_string());
        cache.insert("cursor".to_string(), "icon-2".to_string());
        cache.insert("wechat".to_string(), "icon-3".to_string());

        assert!(cache.get("chrome").is_none());
        assert_eq!(cache.get("cursor"), Some("icon-2".to_string()));
        assert_eq!(cache.get("wechat"), Some("icon-3".to_string()));
    }

    #[test]
    fn touching_key_refreshes_recency() {
        let mut cache = BoundedIconMap::new(2);
        cache.insert("chrome".to_string(), "icon-1".to_string());
        cache.insert("cursor".to_string(), "icon-2".to_string());

        assert_eq!(cache.get("chrome"), Some("icon-1".to_string()));

        cache.insert("wechat".to_string(), "icon-3".to_string());

        assert_eq!(cache.get("chrome"), Some("icon-1".to_string()));
        assert!(cache.get("cursor").is_none());
        assert_eq!(cache.get("wechat"), Some("icon-3".to_string()));
    }
}
