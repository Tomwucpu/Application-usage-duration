use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSummary {
    pub app_name: String,
    pub total_seconds: i64,
    pub percentage: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HourlySummary {
    pub hour: i32,
    pub total_seconds: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailySummary {
    pub total_seconds: i64,
    pub apps: Vec<AppSummary>,
    pub hourly: Vec<HourlySummary>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HourlyAppBreakdown {
    pub hour: i32,
    pub app_name: String,
    pub total_seconds: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyAppBreakdown {
    pub date: String,
    pub app_name: String,
    pub total_seconds: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CategorySummaryItem {
    pub category_id: i64,
    pub category_name: String,
    pub icon_source: String,
    pub builtin_icon_key: Option<String>,
    pub custom_icon_path: Option<String>,
    pub total_seconds: i64,
    pub percentage: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HourlyCategoryBreakdown {
    pub hour: i32,
    pub category_id: i64,
    pub category_name: String,
    pub icon_source: String,
    pub builtin_icon_key: Option<String>,
    pub custom_icon_path: Option<String>,
    pub total_seconds: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyCategoryBreakdown {
    pub date: String,
    pub category_id: i64,
    pub category_name: String,
    pub icon_source: String,
    pub builtin_icon_key: Option<String>,
    pub custom_icon_path: Option<String>,
    pub total_seconds: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageRecord {
    pub id: i64,
    pub app_name: String,
    pub app_path: Option<String>,
    pub window_title: Option<String>,
    pub start_time: String,
    pub end_time: String,
    pub duration_seconds: i64,
    pub date: String,
    pub hour: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportRecord {
    pub app_name: String,
    pub app_path: Option<String>,
    pub window_title: Option<String>,
    pub start_time: String,
    pub end_time: String,
    pub duration_seconds: i64,
    pub date: String,
    pub hour: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportBatchResult {
    pub imported: i32,
    pub skipped: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppMetadataItem {
    pub app_name: String,
    pub app_path: Option<String>,
    pub display_name: Option<String>,
    pub custom_icon_path: Option<String>,
    pub default_icon_path: Option<String>,
    pub category_id: Option<i64>,
    pub category_name: Option<String>,
    pub category_icon_source: Option<String>,
    pub category_builtin_icon_key: Option<String>,
    pub category_custom_icon_path: Option<String>,
    pub total_seconds: i64,
    pub record_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppFilterOption {
    pub app_name: String,
    pub display_name: Option<String>,
    pub category_id: Option<i64>,
    pub category_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CategoryItem {
    pub id: i64,
    pub key: Option<String>,
    pub name: String,
    pub icon_source: String,
    pub builtin_icon_key: Option<String>,
    pub custom_icon_path: Option<String>,
    pub is_default: bool,
    pub is_builtin: bool,
    pub sort_order: i32,
    pub app_count: i64,
    pub total_seconds: i64,
}

pub(crate) const DEFAULT_CATEGORIES: [(&str, &str, &str, i32, bool); 7] = [
    ("uncategorized", "未分类", "folder", 0, true),
    ("office", "办公", "briefcase", 1, false),
    ("study", "学习", "book", 2, false),
    ("video", "视频", "video", 3, false),
    ("entertainment", "娱乐", "gamepad", 4, false),
    ("social", "社交", "messages", 5, false),
    ("system", "系统", "monitor", 6, false),
];
