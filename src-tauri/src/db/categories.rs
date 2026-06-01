use rusqlite::params;
use std::collections::HashMap;

use super::models::CategoryItem;
use super::schema::{get_default_category_id_from_conn, Database};

impl Database {
    pub fn get_all_categories(&self) -> Result<Vec<CategoryItem>, String> {
        let conn = self.conn()?;
        let mut stmt = conn
            .prepare(
                "SELECT c.id, c.key, c.name, c.icon_source, c.builtin_icon_key, c.custom_icon_path,
                        c.is_default, c.is_builtin, c.sort_order,
                        COUNT(DISTINCT am.app_name) AS app_count,
                        COALESCE(SUM(ur.duration_seconds), 0) AS total_seconds
                 FROM categories c
                 LEFT JOIN app_metadata am ON am.category_id = c.id
                 LEFT JOIN usage_records ur ON ur.app_name = am.app_name
                 GROUP BY c.id, c.key, c.name, c.icon_source, c.builtin_icon_key, c.custom_icon_path,
                          c.is_default, c.is_builtin, c.sort_order
                 ORDER BY c.sort_order ASC, c.id ASC",
            )
            .map_err(|e| e.to_string())?;

        let items = stmt
            .query_map([], |row| {
                Ok(CategoryItem {
                    id: row.get(0)?,
                    key: row.get(1).ok(),
                    name: row.get(2)?,
                    icon_source: row.get(3)?,
                    builtin_icon_key: row.get(4).ok(),
                    custom_icon_path: row.get(5).ok(),
                    is_default: row.get::<_, i64>(6)? != 0,
                    is_builtin: row.get::<_, i64>(7)? != 0,
                    sort_order: row.get(8)?,
                    app_count: row.get(9)?,
                    total_seconds: row.get(10)?,
                })
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        Ok(items)
    }

    pub fn create_category(
        &self,
        name: &str,
        icon_source: &str,
        builtin_icon_key: Option<&str>,
        custom_icon_path: Option<&str>,
    ) -> Result<(), String> {
        let conn = self.conn()?;
        let next_sort_order: i32 = conn
            .query_row(
                "SELECT COALESCE(MAX(sort_order), -1) + 1 FROM categories",
                [],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;
        let key = format!("custom-{}", chrono::Utc::now().timestamp_millis());
        conn.execute(
            "INSERT INTO categories (key, name, icon_source, builtin_icon_key, custom_icon_path, is_default, is_builtin, sort_order)
             VALUES (?1, ?2, ?3, ?4, ?5, 0, 0, ?6)",
            params![key, name, icon_source, builtin_icon_key, custom_icon_path, next_sort_order],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn update_category(
        &self,
        id: i64,
        name: &str,
        icon_source: &str,
        builtin_icon_key: Option<&str>,
        custom_icon_path: Option<&str>,
    ) -> Result<(), String> {
        let conn = self.conn()?;
        conn.execute(
            "UPDATE categories
             SET name = ?1,
                 icon_source = ?2,
                 builtin_icon_key = ?3,
                 custom_icon_path = ?4
             WHERE id = ?5",
            params![name, icon_source, builtin_icon_key, custom_icon_path, id],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn delete_category(&self, id: i64) -> Result<(), String> {
        let conn = self.conn()?;
        let default_category_id = get_default_category_id_from_conn(&conn).map_err(|e| e.to_string())?;
        if id == default_category_id {
            return Err("default category cannot be deleted".to_string());
        }

        conn.execute("BEGIN IMMEDIATE", []).map_err(|e| e.to_string())?;
        let result = (|| -> Result<(), rusqlite::Error> {
            conn.execute(
                "UPDATE app_metadata SET category_id = ?1 WHERE category_id = ?2",
                params![default_category_id, id],
            )?;
            conn.execute("DELETE FROM categories WHERE id = ?1", params![id])?;
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

    pub fn set_app_category(&self, app_name: &str, category_id: i64) -> Result<(), String> {
        let conn = self.conn()?;
        conn.execute(
            "UPDATE app_metadata SET category_id = ?1 WHERE app_name = ?2",
            params![category_id, app_name],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn get_category_icon_map(&self) -> Result<HashMap<i64, String>, String> {
        let conn = self.conn()?;
        let mut stmt = conn
            .prepare("SELECT id, custom_icon_path FROM categories WHERE icon_source = 'file' AND custom_icon_path IS NOT NULL")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?)))
            .map_err(|e| e.to_string())?;
        let mut map = HashMap::new();
        for row in rows {
            if let Ok((id, path)) = row {
                map.insert(id, path);
            }
        }
        Ok(map)
    }
}
