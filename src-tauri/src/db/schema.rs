use rusqlite::{params, Connection};
use std::path::PathBuf;
use std::sync::Mutex;

use super::models::DEFAULT_CATEGORIES;

pub struct Database {
    pub conn: Mutex<Connection>,
}

fn seed_default_categories(conn: &Connection) -> Result<(), rusqlite::Error> {
    for (key, name, builtin_icon_key, sort_order, is_default) in DEFAULT_CATEGORIES {
        conn.execute(
            "INSERT OR IGNORE INTO categories (key, name, icon_source, builtin_icon_key, custom_icon_path, is_default, is_builtin, sort_order)
             VALUES (?1, ?2, 'builtin', ?3, NULL, ?4, 1, ?5)",
            params![key, name, builtin_icon_key, if is_default { 1 } else { 0 }, sort_order],
        )?;
    }
    Ok(())
}

pub(super) fn get_default_category_id_from_conn(conn: &Connection) -> Result<i64, rusqlite::Error> {
    conn.query_row(
        "SELECT id FROM categories WHERE is_default = 1 ORDER BY id LIMIT 1",
        [],
        |row| row.get(0),
    )
}

impl Database {
    pub(crate) fn conn(&self) -> Result<std::sync::MutexGuard<'_, Connection>, String> {
        self.conn.lock().map_err(|e| e.to_string())
    }

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
                default_icon_path TEXT,
                category_id INTEGER
            );
            CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                key TEXT UNIQUE,
                name TEXT NOT NULL,
                icon_source TEXT NOT NULL DEFAULT 'builtin',
                builtin_icon_key TEXT,
                custom_icon_path TEXT,
                is_default INTEGER NOT NULL DEFAULT 0,
                is_builtin INTEGER NOT NULL DEFAULT 0,
                sort_order INTEGER NOT NULL DEFAULT 0
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

        let _ = conn.execute("ALTER TABLE app_metadata ADD COLUMN display_name TEXT", []);
        let _ = conn.execute("ALTER TABLE app_metadata ADD COLUMN custom_icon_path TEXT", []);
        let _ = conn.execute("ALTER TABLE app_metadata ADD COLUMN default_icon_path TEXT", []);
        let _ = conn.execute("ALTER TABLE app_metadata ADD COLUMN category_id INTEGER", []);
        let _ = conn.execute("ALTER TABLE categories ADD COLUMN icon_source TEXT NOT NULL DEFAULT 'builtin'", []);
        let _ = conn.execute("ALTER TABLE categories ADD COLUMN builtin_icon_key TEXT", []);
        let _ = conn.execute("ALTER TABLE categories ADD COLUMN custom_icon_path TEXT", []);
        let _ = conn.execute("ALTER TABLE categories ADD COLUMN is_default INTEGER NOT NULL DEFAULT 0", []);
        let _ = conn.execute("ALTER TABLE categories ADD COLUMN is_builtin INTEGER NOT NULL DEFAULT 0", []);
        let _ = conn.execute("ALTER TABLE categories ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0", []);
        let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_app_metadata_category ON app_metadata(category_id)", []);
        let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_categories_sort_order ON categories(sort_order)", []);

        seed_default_categories(&conn).map_err(|e| e.to_string())?;
        let default_category_id = get_default_category_id_from_conn(&conn).map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE app_metadata SET category_id = ?1 WHERE category_id IS NULL",
            params![default_category_id],
        )
        .map_err(|e| e.to_string())?;

        Ok(Database {
            conn: Mutex::new(conn),
        })
    }
}
