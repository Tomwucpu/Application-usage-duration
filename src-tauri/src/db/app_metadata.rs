use rusqlite::{params, params_from_iter};
use std::collections::HashMap;

use super::models::{AppFilterOption, AppMetadataItem};
use super::schema::{get_default_category_id_from_conn, Database};

impl Database {
    pub fn upsert_app_metadata(&self, app_name: &str, app_path: &str) -> Result<(), String> {
        let conn = self.conn()?;
        let default_category_id = get_default_category_id_from_conn(&conn).map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO app_metadata (app_name, app_path, category_id) VALUES (?1, ?2, ?3)
             ON CONFLICT(app_name) DO UPDATE SET
               app_path = excluded.app_path,
               category_id = COALESCE(app_metadata.category_id, excluded.category_id)",
            params![app_name, app_path, default_category_id],
        )
        .map_err(|e| e.to_string())?;

        Ok(())
    }

    pub fn get_all_app_metadata_list(&self) -> Result<Vec<AppMetadataItem>, String> {
        let conn = self.conn()?;
        let mut stmt = conn
            .prepare(
                "SELECT am.app_name, am.app_path, am.display_name, am.custom_icon_path, am.default_icon_path,
                        c.id, c.name, c.icon_source, c.builtin_icon_key, c.custom_icon_path,
                        COALESCE(SUM(ur.duration_seconds), 0) AS total_seconds,
                        COUNT(ur.id) AS record_count
                 FROM app_metadata am
                 LEFT JOIN categories c ON am.category_id = c.id
                 LEFT JOIN usage_records ur ON am.app_name = ur.app_name
                 GROUP BY am.app_name, am.app_path, am.display_name, am.custom_icon_path, am.default_icon_path,
                          c.id, c.name, c.icon_source, c.builtin_icon_key, c.custom_icon_path
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
                    category_id: row.get(5).ok(),
                    category_name: row.get(6).ok(),
                    category_icon_source: row.get(7).ok(),
                    category_builtin_icon_key: row.get(8).ok(),
                    category_custom_icon_path: row.get(9).ok(),
                    total_seconds: row.get::<_, i64>(10).unwrap_or(0),
                    record_count: row.get::<_, i64>(11).unwrap_or(0),
                })
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
        Ok(items)
    }

    pub fn get_app_filter_options(&self) -> Result<Vec<AppFilterOption>, String> {
        let conn = self.conn()?;
        let mut stmt = conn
            .prepare(
                "SELECT am.app_name, am.display_name, c.id, c.name
                 FROM app_metadata am
                 LEFT JOIN categories c ON am.category_id = c.id
                 ORDER BY LOWER(COALESCE(am.display_name, am.app_name)) ASC",
            )
            .map_err(|e| e.to_string())?;

        let items = stmt
            .query_map([], |row| {
                Ok(AppFilterOption {
                    app_name: row.get(0)?,
                    display_name: row.get(1).ok(),
                    category_id: row.get(2).ok(),
                    category_name: row.get(3).ok(),
                })
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        Ok(items)
    }

    pub fn get_app_icon_paths_by_names(
        &self,
        app_names: &[String],
    ) -> Result<HashMap<String, (Option<String>, Option<String>, Option<String>)>, String> {
        if app_names.is_empty() {
            return Ok(HashMap::new());
        }

        let placeholders = std::iter::repeat_n("?", app_names.len())
            .collect::<Vec<_>>()
            .join(", ");
        let sql = format!(
            "SELECT app_name, app_path, custom_icon_path, default_icon_path
             FROM app_metadata
             WHERE app_name IN ({})",
            placeholders,
        );

        let conn = self.conn()?;
        let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params_from_iter(app_names.iter()), |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, Option<String>>(1)?,
                    row.get::<_, Option<String>>(2)?,
                    row.get::<_, Option<String>>(3)?,
                ))
            })
            .map_err(|e| e.to_string())?;

        let mut result = HashMap::new();
        for row in rows {
            if let Ok((app_name, app_path, custom_icon_path, default_icon_path)) = row {
                result.insert(
                    app_name,
                    (app_path, custom_icon_path, default_icon_path),
                );
            }
        }

        Ok(result)
    }

    pub fn set_app_display_name(&self, app_name: &str, display_name: Option<&str>) -> Result<(), String> {
        let conn = self.conn()?;
        conn.execute(
            "UPDATE app_metadata SET display_name = ?1 WHERE app_name = ?2",
            params![display_name, app_name],
        )
        .map_err(|e| e.to_string())?;

        Ok(())
    }

    pub fn set_app_custom_icon(&self, app_name: &str, custom_icon_path: Option<&str>) -> Result<(), String> {
        let conn = self.conn()?;
        conn.execute(
            "UPDATE app_metadata SET custom_icon_path = ?1 WHERE app_name = ?2",
            params![custom_icon_path, app_name],
        )
        .map_err(|e| e.to_string())?;

        Ok(())
    }

    pub fn reset_app_display_name(&self, app_name: &str) -> Result<(), String> {
        let conn = self.conn()?;
        conn.execute(
            "UPDATE app_metadata SET display_name = NULL WHERE app_name = ?1",
            params![app_name],
        )
        .map_err(|e| e.to_string())?;

        Ok(())
    }

    pub fn reset_app_custom_icon(&self, app_name: &str) -> Result<(), String> {
        let conn = self.conn()?;
        conn.execute(
            "UPDATE app_metadata SET custom_icon_path = NULL WHERE app_name = ?1",
            params![app_name],
        )
        .map_err(|e| e.to_string())?;

        Ok(())
    }

    pub fn delete_records_by_app(&self, app_name: &str) -> Result<usize, String> {
        let conn = self.conn()?;
        let deleted = conn
            .execute(
                "DELETE FROM usage_records WHERE app_name = ?1",
                params![app_name],
            )
            .map_err(|e| e.to_string())?;
        let _ = conn.execute(
            "DELETE FROM app_metadata WHERE app_name = ?1",
            params![app_name],
        );

        Ok(deleted)
    }

    pub fn rename_app(&self, old_name: &str, new_name: &str) -> Result<(), String> {
        let conn = self.conn()?;
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
                Ok(())
            }
            Err(e) => {
                let _ = conn.execute("ROLLBACK", []);
                Err(e.to_string())
            }
        }
    }

    pub fn get_app_display_names(&self) -> Result<HashMap<String, String>, String> {
        let conn = self.conn()?;
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
