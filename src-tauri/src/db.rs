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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyAppBreakdown {
    pub date: String,
    pub app_name: String,
    pub total_seconds: i64,
    pub percentage: f64,
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
    pub total_seconds: i64,
    pub record_count: i64,
}

pub struct Database {
    pub conn: Mutex<Connection>,
    metadata_cache: Mutex<Option<HashMap<String, String>>>,
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
            CREATE TABLE IF NOT EXISTS app_metadata (
                app_name TEXT PRIMARY KEY,
                app_path TEXT NOT NULL,
                display_name TEXT,
                custom_icon_path TEXT,
                default_icon_path TEXT
            );
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_date ON usage_records(date);
            CREATE INDEX IF NOT EXISTS idx_hour ON usage_records(date, hour);
            CREATE INDEX IF NOT EXISTS idx_app ON usage_records(app_name, date);",
        )
        .map_err(|e| e.to_string())?;

        // Migrate: add columns if missing (ignore errors if already exist)
        let _ = conn.execute("ALTER TABLE app_metadata ADD COLUMN display_name TEXT", []);
        let _ = conn.execute("ALTER TABLE app_metadata ADD COLUMN custom_icon_path TEXT", []);
        let _ = conn.execute("ALTER TABLE app_metadata ADD COLUMN default_icon_path TEXT", []);

        Ok(Database {
            conn: Mutex::new(conn),
            metadata_cache: Mutex::new(None),
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

    pub fn import_records_batch(&self, records: &[ImportRecord]) -> Result<ImportBatchResult, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute("BEGIN IMMEDIATE", [])
            .map_err(|e| e.to_string())?;

        let result = (|| -> Result<ImportBatchResult, rusqlite::Error> {
            let mut imported: i32 = 0;
            let mut skipped: i32 = 0;

            let mut check_stmt = conn.prepare(
                "SELECT COUNT(*) FROM usage_records WHERE app_name = ?1 \
                 AND (app_path = ?2 OR (app_path IS NULL AND ?2 IS NULL)) \
                 AND (window_title = ?3 OR (window_title IS NULL AND ?3 IS NULL)) \
                 AND start_time = ?4 AND end_time = ?5 AND duration_seconds = ?6 \
                 AND date = ?7 AND hour = ?8",
            )?;

            let mut insert_stmt = conn.prepare(
                "INSERT INTO usage_records (app_name, app_path, window_title, start_time, end_time, duration_seconds, date, hour) \
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            )?;

            for record in records {
                let count: i64 = check_stmt.query_row(
                    params![
                        record.app_name,
                        record.app_path,
                        record.window_title,
                        record.start_time,
                        record.end_time,
                        record.duration_seconds,
                        record.date,
                        record.hour,
                    ],
                    |row| row.get(0),
                )?;

                if count == 0 {
                    insert_stmt.execute(params![
                        record.app_name,
                        record.app_path,
                        record.window_title,
                        record.start_time,
                        record.end_time,
                        record.duration_seconds,
                        record.date,
                        record.hour,
                    ])?;
                    imported += 1;
                } else {
                    skipped += 1;
                }
            }

            Ok(ImportBatchResult { imported, skipped })
        })();

        match result {
            Ok(r) => {
                conn.execute("COMMIT", []).map_err(|e| e.to_string())?;
                drop(conn);

                let mut seen = std::collections::HashSet::new();
                for record in records {
                    if let Some(ref path) = record.app_path {
                        if !path.is_empty() && seen.insert(&record.app_name) {
                            let _ = self.upsert_app_metadata(&record.app_name, path);
                        }
                    }
                }

                Ok(r)
            }
            Err(e) => {
                let _ = conn.execute("ROLLBACK", []);
                Err(e.to_string())
            }
        }
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

    pub fn get_hourly_app_breakdown(&self, date: &str) -> Result<Vec<HourlyAppBreakdown>, String> {
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
                }
            })
            .collect();

        Ok(result)
    }

    pub fn upsert_app_metadata(&self, app_name: &str, app_path: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO app_metadata (app_name, app_path) VALUES (?1, ?2)
             ON CONFLICT(app_name) DO UPDATE SET app_path = excluded.app_path",
            params![app_name, app_path],
        )
        .map_err(|e| e.to_string())?;

        let mut cache = self.metadata_cache.lock().map_err(|e| e.to_string())?;
        *cache = None;

        Ok(())
    }

    pub fn get_all_app_metadata(&self) -> Result<HashMap<String, String>, String> {
        {
            let cache = self.metadata_cache.lock().map_err(|e| e.to_string())?;
            if let Some(ref cached) = *cache {
                return Ok(cached.clone());
            }
        }

        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT app_name, app_path FROM app_metadata")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })
            .map_err(|e| e.to_string())?;
        let mut map = HashMap::new();
        for row in rows {
            if let Ok((name, path)) = row {
                map.insert(name, path);
            }
        }

        {
            let mut cache = self.metadata_cache.lock().map_err(|e| e.to_string())?;
            *cache = Some(map.clone());
        }

        Ok(map)
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

    pub fn get_setting(&self, key: &str) -> Result<Option<String>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        match conn.query_row(
            "SELECT value FROM settings WHERE key = ?1",
            params![key],
            |row| row.get(0),
        ) {
            Ok(val) => Ok(Some(val)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.to_string()),
        }
    }

    pub fn set_setting(&self, key: &str, value: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![key, value],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn get_all_app_names(&self) -> Result<Vec<String>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT DISTINCT app_name FROM usage_records ORDER BY app_name")
            .map_err(|e| e.to_string())?;
        let names = stmt
            .query_map([], |row| row.get::<_, String>(0))
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
        Ok(names)
    }

    pub fn get_all_records(&self) -> Result<Vec<UsageRecord>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT id, app_name, app_path, window_title, start_time, end_time, duration_seconds, date, hour FROM usage_records ORDER BY start_time DESC")
            .map_err(|e| e.to_string())?;
        let records = stmt
            .query_map([], |row| {
                Ok(UsageRecord {
                    id: row.get(0)?,
                    app_name: row.get(1)?,
                    app_path: row.get(2).ok(),
                    window_title: row.get(3).ok(),
                    start_time: row.get(4)?,
                    end_time: row.get(5)?,
                    duration_seconds: row.get(6)?,
                    date: row.get(7)?,
                    hour: row.get(8)?,
                })
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
        Ok(records)
    }

    pub fn get_record_count(&self, start_date: &str, end_date: &str) -> Result<i64, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.query_row(
            "SELECT COUNT(*) FROM usage_records WHERE date BETWEEN ?1 AND ?2",
            params![start_date, end_date],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())
    }

    pub fn get_records_range(
        &self,
        start_date: &str,
        end_date: &str,
        offset: i64,
        limit: i64,
    ) -> Result<Vec<UsageRecord>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare(
                "SELECT id, app_name, app_path, window_title, start_time, end_time, duration_seconds, date, hour
                 FROM usage_records WHERE date BETWEEN ?1 AND ?2
                 ORDER BY start_time DESC LIMIT ?3 OFFSET ?4",
            )
            .map_err(|e| e.to_string())?;
        let records = stmt
            .query_map(params![start_date, end_date, limit, offset], |row| {
                Ok(UsageRecord {
                    id: row.get(0)?,
                    app_name: row.get(1)?,
                    app_path: row.get(2).ok(),
                    window_title: row.get(3).ok(),
                    start_time: row.get(4)?,
                    end_time: row.get(5)?,
                    duration_seconds: row.get(6)?,
                    date: row.get(7)?,
                    hour: row.get(8)?,
                })
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
        Ok(records)
    }

    pub fn cleanup_old_records(&self, days: u32) -> Result<usize, String> {
        if days == 0 {
            return Ok(0); // 0 means keep forever
        }
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        // SQLite date function can be used: date('now', '-X days')
        // However, duration modifier requires formatting like '-30 days'
        let modifier = format!("-{} days", days);
        let deleted = conn
            .execute(
                "DELETE FROM usage_records WHERE date < date('now', 'localtime', ?1)",
                params![modifier],
            )
            .map_err(|e| e.to_string())?;
        Ok(deleted)
    }

    pub fn get_all_app_metadata_list(&self) -> Result<Vec<AppMetadataItem>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare(
                "SELECT am.app_name, am.app_path, am.display_name, am.custom_icon_path, am.default_icon_path,
                        COALESCE(SUM(ur.duration_seconds), 0) AS total_seconds,
                        COUNT(ur.id) AS record_count
                 FROM app_metadata am
                 LEFT JOIN usage_records ur ON am.app_name = ur.app_name
                 GROUP BY am.app_name
                 ORDER BY total_seconds DESC",
            )
            .map_err(|e| e.to_string())?;
        let items: Vec<AppMetadataItem> = stmt
            .query_map([], |row| {
                Ok(AppMetadataItem {
                    app_name: row.get(0)?,
                    app_path: row.get(1).ok(),
                    display_name: row.get(2).ok(),
                    custom_icon_path: row.get(3).ok(),
                    default_icon_path: row.get(4).ok(),
                    total_seconds: row.get::<_, i64>(5).unwrap_or(0),
                    record_count: row.get::<_, i64>(6).unwrap_or(0),
                })
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
        Ok(items)
    }

    pub fn set_app_display_name(&self, app_name: &str, display_name: Option<&str>) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE app_metadata SET display_name = ?1 WHERE app_name = ?2",
            params![display_name, app_name],
        )
        .map_err(|e| e.to_string())?;

        let mut cache = self.metadata_cache.lock().map_err(|e| e.to_string())?;
        *cache = None;

        Ok(())
    }

    pub fn set_app_custom_icon(&self, app_name: &str, custom_icon_path: Option<&str>) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE app_metadata SET custom_icon_path = ?1 WHERE app_name = ?2",
            params![custom_icon_path, app_name],
        )
        .map_err(|e| e.to_string())?;

        let mut cache = self.metadata_cache.lock().map_err(|e| e.to_string())?;
        *cache = None;

        Ok(())
    }

    pub fn reset_app_display_name(&self, app_name: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE app_metadata SET display_name = NULL WHERE app_name = ?1",
            params![app_name],
        )
        .map_err(|e| e.to_string())?;

        let mut cache = self.metadata_cache.lock().map_err(|e| e.to_string())?;
        *cache = None;

        Ok(())
    }

    pub fn reset_app_custom_icon(&self, app_name: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE app_metadata SET custom_icon_path = NULL WHERE app_name = ?1",
            params![app_name],
        )
        .map_err(|e| e.to_string())?;

        let mut cache = self.metadata_cache.lock().map_err(|e| e.to_string())?;
        *cache = None;

        Ok(())
    }

    pub fn delete_records_by_app(&self, app_name: &str) -> Result<usize, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let deleted = conn
            .execute(
                "DELETE FROM usage_records WHERE app_name = ?1",
                params![app_name],
            )
            .map_err(|e| e.to_string())?;
        Ok(deleted)
    }

    pub fn rename_app(&self, old_name: &str, new_name: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute("BEGIN IMMEDIATE", []).map_err(|e| e.to_string())?;

        let result = (|| -> Result<(), rusqlite::Error> {
            conn.execute(
                "UPDATE usage_records SET app_name = ?1 WHERE app_name = ?2",
                params![new_name, old_name],
            )?;
            conn.execute(
                "UPDATE app_metadata SET app_name = ?1 WHERE app_name = ?2",
                params![new_name, old_name],
            )?;
            Ok(())
        })();

        match result {
            Ok(()) => {
                conn.execute("COMMIT", []).map_err(|e| e.to_string())?;
                let mut cache = self.metadata_cache.lock().map_err(|e| e.to_string())?;
                *cache = None;
                Ok(())
            }
            Err(e) => {
                let _ = conn.execute("ROLLBACK", []);
                Err(e.to_string())
            }
        }
    }

    pub fn get_app_display_names(&self) -> Result<HashMap<String, String>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT app_name, display_name FROM app_metadata WHERE display_name IS NOT NULL")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })
            .map_err(|e| e.to_string())?;
        let mut map = HashMap::new();
        for row in rows {
            if let Ok((name, display)) = row {
                map.insert(name, display);
            }
        }
        Ok(map)
    }
}
