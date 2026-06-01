use rusqlite::params;
use std::collections::HashSet;

use super::models::{
    AppSummary, CategorySummaryItem, DailyAppBreakdown, DailyCategoryBreakdown, DailySummary,
    HourlyAppBreakdown, HourlyCategoryBreakdown, HourlySummary, ImportBatchResult, ImportRecord,
    UsageRecord,
};
use super::schema::Database;

impl Database {
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
        let conn = self.conn()?;
        conn.execute(
            "INSERT INTO usage_records (app_name, app_path, window_title, start_time, end_time, duration_seconds, date, hour)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![app_name, app_path, window_title, start_time, end_time, duration_seconds, date, hour],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn import_records_batch(&self, records: &[ImportRecord]) -> Result<ImportBatchResult, String> {
        let conn = self.conn()?;
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

                let mut seen = HashSet::new();
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
        let conn = self.conn()?;

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

    pub fn get_category_summary(&self, date: &str) -> Result<Vec<CategorySummaryItem>, String> {
        let conn = self.conn()?;
        let total: i64 = conn
            .query_row(
                "SELECT COALESCE(SUM(duration_seconds), 0) FROM usage_records WHERE date = ?1",
                params![date],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;

        let mut stmt = conn
            .prepare(
                "SELECT c.id, c.name, c.icon_source, c.builtin_icon_key, c.custom_icon_path, SUM(ur.duration_seconds) as total
                 FROM usage_records ur
                 LEFT JOIN app_metadata am ON ur.app_name = am.app_name
                 LEFT JOIN categories c ON am.category_id = c.id
                 WHERE ur.date = ?1
                 GROUP BY c.id, c.name, c.icon_source, c.builtin_icon_key, c.custom_icon_path
                 ORDER BY total DESC",
            )
            .map_err(|e| e.to_string())?;

        let items = stmt
            .query_map(params![date], |row| {
                let total_seconds: i64 = row.get(5)?;
                Ok(CategorySummaryItem {
                    category_id: row.get(0)?,
                    category_name: row.get(1)?,
                    icon_source: row.get(2)?,
                    builtin_icon_key: row.get(3).ok(),
                    custom_icon_path: row.get(4).ok(),
                    total_seconds,
                    percentage: if total > 0 {
                        (total_seconds as f64 / total as f64) * 100.0
                    } else {
                        0.0
                    },
                })
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        Ok(items)
    }

    pub fn get_hourly_app_breakdown(&self, date: &str) -> Result<Vec<HourlyAppBreakdown>, String> {
        let conn = self.conn()?;
        let mut stmt = conn
            .prepare(
                "SELECT hour, app_name, SUM(duration_seconds) as total
                 FROM usage_records WHERE date = ?1
                 GROUP BY hour, app_name ORDER BY hour, total DESC",
            )
            .map_err(|e| e.to_string())?;

        let result: Vec<HourlyAppBreakdown> = stmt
            .query_map(params![date], |row| {
                Ok(HourlyAppBreakdown {
                    hour: row.get(0)?,
                    app_name: row.get(1)?,
                    total_seconds: row.get(2)?,
                })
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        Ok(result)
    }

    pub fn get_hourly_category_breakdown(&self, date: &str) -> Result<Vec<HourlyCategoryBreakdown>, String> {
        let conn = self.conn()?;
        let mut stmt = conn
            .prepare(
                "SELECT ur.hour, c.id, c.name, c.icon_source, c.builtin_icon_key, c.custom_icon_path, SUM(ur.duration_seconds) as total
                 FROM usage_records ur
                 LEFT JOIN app_metadata am ON ur.app_name = am.app_name
                 LEFT JOIN categories c ON am.category_id = c.id
                 WHERE ur.date = ?1
                 GROUP BY ur.hour, c.id, c.name, c.icon_source, c.builtin_icon_key, c.custom_icon_path
                 ORDER BY ur.hour, total DESC",
            )
            .map_err(|e| e.to_string())?;

        let result: Vec<HourlyCategoryBreakdown> = stmt
            .query_map(params![date], |row| {
                Ok(HourlyCategoryBreakdown {
                    hour: row.get(0)?,
                    category_id: row.get(1)?,
                    category_name: row.get(2)?,
                    icon_source: row.get(3)?,
                    builtin_icon_key: row.get(4).ok(),
                    custom_icon_path: row.get(5).ok(),
                    total_seconds: row.get(6)?,
                })
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        Ok(result)
    }

    pub fn get_daily_app_breakdown(
        &self,
        start_date: &str,
        end_date: &str,
    ) -> Result<Vec<DailyAppBreakdown>, String> {
        let conn = self.conn()?;
        let mut stmt = conn
            .prepare(
                "SELECT date, app_name, SUM(duration_seconds) as total
                 FROM usage_records WHERE date BETWEEN ?1 AND ?2
                 GROUP BY date, app_name ORDER BY date, total DESC",
            )
            .map_err(|e| e.to_string())?;

        let result: Vec<DailyAppBreakdown> = stmt
            .query_map(params![start_date, end_date], |row| {
                Ok(DailyAppBreakdown {
                    date: row.get(0)?,
                    app_name: row.get(1)?,
                    total_seconds: row.get(2)?,
                })
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        Ok(result)
    }

    pub fn get_daily_category_breakdown(
        &self,
        start_date: &str,
        end_date: &str,
    ) -> Result<Vec<DailyCategoryBreakdown>, String> {
        let conn = self.conn()?;
        let mut stmt = conn
            .prepare(
                "SELECT ur.date, c.id, c.name, c.icon_source, c.builtin_icon_key, c.custom_icon_path, SUM(ur.duration_seconds) as total
                 FROM usage_records ur
                 LEFT JOIN app_metadata am ON ur.app_name = am.app_name
                 LEFT JOIN categories c ON am.category_id = c.id
                 WHERE ur.date BETWEEN ?1 AND ?2
                 GROUP BY ur.date, c.id, c.name, c.icon_source, c.builtin_icon_key, c.custom_icon_path
                 ORDER BY ur.date, total DESC",
            )
            .map_err(|e| e.to_string())?;

        let result: Vec<DailyCategoryBreakdown> = stmt
            .query_map(params![start_date, end_date], |row| {
                Ok(DailyCategoryBreakdown {
                    date: row.get(0)?,
                    category_id: row.get(1)?,
                    category_name: row.get(2)?,
                    icon_source: row.get(3)?,
                    builtin_icon_key: row.get(4).ok(),
                    custom_icon_path: row.get(5).ok(),
                    total_seconds: row.get(6)?,
                })
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        Ok(result)
    }

    pub fn get_today_total_seconds(&self, date: &str) -> Result<i64, String> {
        let conn = self.conn()?;
        conn.query_row(
            "SELECT COALESCE(SUM(duration_seconds), 0) FROM usage_records WHERE date = ?1",
            params![date],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())
    }

    pub fn get_all_app_names(&self) -> Result<Vec<String>, String> {
        let conn = self.conn()?;
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
        let conn = self.conn()?;
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
        let conn = self.conn()?;
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
        let conn = self.conn()?;
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
            return Ok(0);
        }
        let conn = self.conn()?;
        let modifier = format!("-{} days", days);
        let deleted = conn
            .execute(
                "DELETE FROM usage_records WHERE date < date('now', 'localtime', ?1)",
                params![modifier],
            )
            .map_err(|e| e.to_string())?;
        Ok(deleted)
    }
}
