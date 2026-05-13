use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSummary {
    pub app_name: String,
    pub total_seconds: i64,
    pub percentage: f64,
    pub icon_base64: String,
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
    pub percentage: f64,
    pub icon_base64: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyAppBreakdown {
    pub date: String,
    pub app_name: String,
    pub total_seconds: i64,
    pub percentage: f64,
    pub icon_base64: String,
}

pub struct Database {
    pub conn: Mutex<Connection>,
}

impl Database {
    pub fn new(app_dir: PathBuf) -> Result<Self, String> {
        std::fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;
        let db_path = app_dir.join("usage.db");
        let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;

        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS usage_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                app_name TEXT NOT NULL,
                app_path TEXT,
                window_title TEXT,
                start_time DATETIME NOT NULL,
                end_time DATETIME NOT NULL,
                duration_seconds INTEGER NOT NULL,
                date TEXT NOT NULL,
                hour INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_date ON usage_records(date);
            CREATE INDEX IF NOT EXISTS idx_hour ON usage_records(date, hour);
            CREATE INDEX IF NOT EXISTS idx_app ON usage_records(app_name, date);",
        )
        .map_err(|e| e.to_string())?;

        Ok(Database {
            conn: Mutex::new(conn),
        })
    }

    pub fn insert_usage(
        &self,
        app_name: &str,
        app_path: Option<&str>,
        window_title: Option<&str>,
        start_time: &str,
        end_time: &str,
        duration_seconds: i64,
        date: &str,
        hour: i32,
    ) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO usage_records (app_name, app_path, window_title, start_time, end_time, duration_seconds, date, hour)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![app_name, app_path, window_title, start_time, end_time, duration_seconds, date, hour],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn get_daily_summary(&self, date: &str) -> Result<DailySummary, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;

        let total: i64 = conn
            .query_row(
                "SELECT COALESCE(SUM(duration_seconds), 0) FROM usage_records WHERE date = ?1",
                params![date],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;

        let mut stmt = conn
            .prepare(
                "SELECT app_name, SUM(duration_seconds) as total
                 FROM usage_records WHERE date = ?1
                 GROUP BY app_name ORDER BY total DESC",
            )
            .map_err(|e| e.to_string())?;

        let apps: Vec<AppSummary> = stmt
            .query_map(params![date], |row| {
                let secs: i64 = row.get(1)?;
                Ok(AppSummary {
                    app_name: row.get(0)?,
                    total_seconds: secs,
                    percentage: 0.0,
                    icon_base64: String::new(),
                })
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .map(|mut app| {
                app.percentage = if total > 0 {
                    (app.total_seconds as f64 / total as f64) * 100.0
                } else {
                    0.0
                };
                app
            })
            .collect();

        let mut stmt = conn
            .prepare(
                "SELECT hour, SUM(duration_seconds) FROM usage_records WHERE date = ?1
                 GROUP BY hour ORDER BY hour",
            )
            .map_err(|e| e.to_string())?;

        let hourly: Vec<HourlySummary> = stmt
            .query_map(params![date], |row| {
                Ok(HourlySummary {
                    hour: row.get(0)?,
                    total_seconds: row.get(1)?,
                })
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        Ok(DailySummary {
            total_seconds: total,
            apps,
            hourly,
        })
    }

    pub fn get_app_paths_for_date(&self, date: &str) -> Result<HashMap<String, String>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare(
                "SELECT DISTINCT app_name, app_path FROM usage_records
                 WHERE date = ?1 AND app_path IS NOT NULL AND app_path != ''",
            )
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map(params![date], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })
            .map_err(|e| e.to_string())?;

        let mut map = HashMap::new();
        for row in rows {
            if let Ok((name, path)) = row {
                map.entry(name).or_insert(path);
            }
        }
        Ok(map)
    }

    pub fn get_app_paths_for_date_range(
        &self,
        start_date: &str,
        end_date: &str,
    ) -> Result<HashMap<String, String>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare(
                "SELECT DISTINCT app_name, app_path FROM usage_records
                 WHERE date BETWEEN ?1 AND ?2 AND app_path IS NOT NULL AND app_path != ''",
            )
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map(params![start_date, end_date], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })
            .map_err(|e| e.to_string())?;

        let mut map = HashMap::new();
        for row in rows {
            if let Ok((name, path)) = row {
                map.entry(name).or_insert(path);
            }
        }
        Ok(map)
    }

    pub fn get_hourly_app_breakdown(
        &self,
        date: &str,
    ) -> Result<Vec<HourlyAppBreakdown>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare(
                "SELECT hour, app_name, SUM(duration_seconds) as total
                 FROM usage_records WHERE date = ?1
                 GROUP BY hour, app_name ORDER BY hour, total DESC",
            )
            .map_err(|e| e.to_string())?;

        let rows: Vec<(i32, String, i64)> = stmt
            .query_map(params![date], |row| {
                Ok((row.get(0)?, row.get(1)?, row.get(2)?))
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        let mut hour_totals: HashMap<i32, i64> = HashMap::new();
        for (hour, _, secs) in &rows {
            *hour_totals.entry(*hour).or_default() += secs;
        }

        let result: Vec<HourlyAppBreakdown> = rows
            .into_iter()
            .map(|(hour, app_name, total_seconds)| {
                let total = hour_totals.get(&hour).copied().unwrap_or(0);
                let percentage = if total > 0 {
                    (total_seconds as f64 / total as f64) * 100.0
                } else {
                    0.0
                };
                HourlyAppBreakdown {
                    hour,
                    app_name,
                    total_seconds,
                    percentage,
                    icon_base64: String::new(),
                }
            })
            .collect();

        Ok(result)
    }

    pub fn get_daily_app_breakdown(
        &self,
        start_date: &str,
        end_date: &str,
    ) -> Result<Vec<DailyAppBreakdown>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare(
                "SELECT date, app_name, SUM(duration_seconds) as total
                 FROM usage_records WHERE date BETWEEN ?1 AND ?2
                 GROUP BY date, app_name ORDER BY date, total DESC",
            )
            .map_err(|e| e.to_string())?;

        let rows: Vec<(String, String, i64)> = stmt
            .query_map(params![start_date, end_date], |row| {
                Ok((row.get(0)?, row.get(1)?, row.get(2)?))
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        let mut date_totals: HashMap<String, i64> = HashMap::new();
        for (date, _, secs) in &rows {
            *date_totals.entry(date.clone()).or_default() += secs;
        }

        let result: Vec<DailyAppBreakdown> = rows
            .into_iter()
            .map(|(date, app_name, total_seconds)| {
                let total = date_totals.get(&date).copied().unwrap_or(0);
                let percentage = if total > 0 {
                    (total_seconds as f64 / total as f64) * 100.0
                } else {
                    0.0
                };
                DailyAppBreakdown {
                    date,
                    app_name,
                    total_seconds,
                    percentage,
                    icon_base64: String::new(),
                }
            })
            .collect();

        Ok(result)
    }

    pub fn get_today_total_seconds(&self, date: &str) -> Result<i64, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.query_row(
            "SELECT COALESCE(SUM(duration_seconds), 0) FROM usage_records WHERE date = ?1",
            params![date],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())
    }

}
