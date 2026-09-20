use anyhow::{Context, Result};
use rusqlite::Connection;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use crate::config::AppConfig;

pub struct Database {
    pub(crate) conn: Arc<Mutex<Connection>>,
}

impl Database {
    pub fn open() -> Result<Self> {
        let db_path = Self::database_path()?;

        Self::open_path(&db_path)
    }

    fn open_path(db_path: &Path) -> Result<Self> {
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent).context("Failed to create database directory")?;
        }

        let conn = Connection::open(&db_path).context("Failed to open database")?;

        let db = Self {
            conn: Arc::new(Mutex::new(conn)),
        };

        db.initialize()?;

        Ok(db)
    }

    #[cfg(test)]
    pub(crate) fn open_at(db_path: &Path) -> Result<Self> {
        Self::open_path(db_path)
    }

    pub fn open_in_memory() -> Result<Self> {
        let conn = Connection::open_in_memory().context("Failed to open in-memory database")?;

        let db = Self {
            conn: Arc::new(Mutex::new(conn)),
        };

        db.initialize()?;

        Ok(db)
    }

    fn database_path() -> Result<PathBuf> {
        Ok(AppConfig::data_dir()?.join("wingosy.db"))
    }

    fn initialize(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS platforms (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                short_name TEXT,
                extensions TEXT NOT NULL,
                logo_path TEXT,
                sort_order INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS games (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                platform_id TEXT NOT NULL,
                name TEXT NOT NULL,
                file_path TEXT NOT NULL,
                source TEXT NOT NULL DEFAULT 'local',
                romm_id INTEGER,
                summary TEXT,
                developer TEXT,
                publisher TEXT,
                release_year INTEGER,
                genres TEXT,
                player_count TEXT,
                cover_path TEXT,
                screenshot_paths TEXT,
                is_favorite INTEGER DEFAULT 0,
                is_hidden INTEGER DEFAULT 0,
                user_rating REAL,
                last_played_at TEXT,
                play_count INTEGER DEFAULT 0,
                play_time_minutes INTEGER DEFAULT 0,
                sync_state TEXT DEFAULT 'local_only',
                local_file_path TEXT,
                sync_dirty INTEGER DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (platform_id) REFERENCES platforms(id)
            );

            CREATE TABLE IF NOT EXISTS collections (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                is_smart INTEGER DEFAULT 0,
                smart_filter TEXT,
                cover_path TEXT,
                sort_order INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS collection_games (
                collection_id INTEGER NOT NULL,
                game_id INTEGER NOT NULL,
                sort_order INTEGER DEFAULT 0,
                PRIMARY KEY (collection_id, game_id),
                FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
                FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS emulator_configs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                platform_id TEXT,
                game_id INTEGER,
                emulator_id TEXT NOT NULL,
                core_name TEXT,
                is_default INTEGER DEFAULT 0,
                FOREIGN KEY (platform_id) REFERENCES platforms(id),
                FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS saves (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                game_id INTEGER NOT NULL,
                emulator_id TEXT NOT NULL,
                file_name TEXT NOT NULL,
                local_path TEXT,
                remote_path TEXT,
                local_modified TEXT,
                remote_modified TEXT,
                sync_state TEXT DEFAULT 'local_only',
                FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS pending_save_sync (
                game_id INTEGER PRIMARY KEY,
                phase TEXT NOT NULL,
                attempts INTEGER NOT NULL DEFAULT 1,
                last_error TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS eden_restore_protections (
                game_id INTEGER NOT NULL,
                save_set TEXT NOT NULL,
                revision_id INTEGER NOT NULL,
                revision_rom_id INTEGER NOT NULL,
                revision_file_name TEXT NOT NULL,
                revision_file_size_bytes INTEGER NOT NULL,
                revision_emulator TEXT,
                revision_created_at TEXT NOT NULL,
                revision_updated_at TEXT NOT NULL,
                revision_slot TEXT,
                baseline_fingerprint TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (game_id, save_set),
                FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_games_platform ON games(platform_id);
            CREATE INDEX IF NOT EXISTS idx_games_name ON games(name);
            CREATE INDEX IF NOT EXISTS idx_games_favorite ON games(is_favorite);
            CREATE INDEX IF NOT EXISTS idx_games_last_played ON games(last_played_at);
            CREATE INDEX IF NOT EXISTS idx_games_romm_id ON games(romm_id);
            "#,
        )
        .context("Failed to initialize database schema")?;

        Self::run_migrations(&conn)?;

        // Create index on sync_dirty after migrations have added the column
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_games_sync_dirty ON games(sync_dirty)",
            [],
        )
        .ok(); // Ignore error if index already exists

        Ok(())
    }

    fn run_migrations(conn: &Connection) -> Result<()> {
        let has_sync_dirty: bool = conn
            .prepare("SELECT COUNT(*) FROM pragma_table_info('games') WHERE name = 'sync_dirty'")?
            .query_row([], |row| row.get::<_, i32>(0))
            .map(|count| count > 0)
            .unwrap_or(false);

        if !has_sync_dirty {
            conn.execute(
                "ALTER TABLE games ADD COLUMN sync_dirty INTEGER DEFAULT 0",
                [],
            )
            .context("Failed to add sync_dirty column")?;
        }

        let col = |name: &str| -> Result<bool, rusqlite::Error> {
            let mut stmt =
                conn.prepare("SELECT COUNT(*) FROM pragma_table_info('games') WHERE name = ?1")?;
            let n: i32 = stmt.query_row([name], |row| row.get(0))?;
            Ok(n > 0)
        };

        if !col("library_status")? {
            conn.execute("ALTER TABLE games ADD COLUMN library_status TEXT", [])
                .context("Failed to add library_status column")?;
        }
        if !col("personal_rating")? {
            conn.execute(
                "ALTER TABLE games ADD COLUMN personal_rating INTEGER NOT NULL DEFAULT 0",
                [],
            )
            .context("Failed to add personal_rating column")?;
        }
        if !col("personal_difficulty")? {
            conn.execute(
                "ALTER TABLE games ADD COLUMN personal_difficulty INTEGER NOT NULL DEFAULT 0",
                [],
            )
            .context("Failed to add personal_difficulty column")?;
        }

        Ok(())
    }

    pub fn connection(&self) -> Arc<Mutex<Connection>> {
        Arc::clone(&self.conn)
    }

    pub fn record_save_sync_failure(&self, game_id: i64, phase: &str, error: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            r#"
            INSERT INTO pending_save_sync (game_id, phase, attempts, last_error)
            VALUES (?1, ?2, 1, ?3)
            ON CONFLICT(game_id) DO UPDATE SET
                phase = excluded.phase,
                attempts = pending_save_sync.attempts + 1,
                last_error = excluded.last_error,
                updated_at = CURRENT_TIMESTAMP
            "#,
            rusqlite::params![game_id, phase, error],
        )?;
        Ok(())
    }

    pub fn clear_save_sync_failure(&self, game_id: i64, phase: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "DELETE FROM pending_save_sync WHERE game_id = ?1 AND phase = ?2",
            rusqlite::params![game_id, phase],
        )?;
        Ok(())
    }
}

impl Clone for Database {
    fn clone(&self) -> Self {
        Self {
            conn: Arc::clone(&self.conn),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn save_sync_failure_is_persistent_and_counted() {
        let db = Database::open_in_memory().unwrap();
        {
            let conn = db.conn.lock().unwrap();
            conn.execute(
                "INSERT INTO platforms (id, name, extensions) VALUES ('test', 'Test', 'sav')",
                [],
            )
            .unwrap();
            conn.execute(
                "INSERT INTO games (id, platform_id, name, file_path) VALUES (42, 'test', 'Game', 'game.rom')",
                [],
            )
            .unwrap();
        }
        db.record_save_sync_failure(42, "post_launch", "offline")
            .unwrap();
        db.clear_save_sync_failure(42, "pre_launch").unwrap();
        let conn = db.conn.lock().unwrap();
        let row: (String, i64, String) = conn
            .query_row(
                "SELECT phase, attempts, last_error FROM pending_save_sync WHERE game_id = 42",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .unwrap();
        assert_eq!(row, ("post_launch".to_string(), 1, "offline".to_string()));
        drop(conn);

        db.record_save_sync_failure(42, "pre_launch", "still offline")
            .unwrap();
        let conn = db.conn.lock().unwrap();
        let row: (String, i64, String) = conn
            .query_row(
                "SELECT phase, attempts, last_error FROM pending_save_sync WHERE game_id = 42",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .unwrap();
        assert_eq!(
            row,
            ("pre_launch".to_string(), 2, "still offline".to_string())
        );
        drop(conn);

        db.clear_save_sync_failure(42, "post_launch").unwrap();
        let conn = db.conn.lock().unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM pending_save_sync", [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(count, 1);
        drop(conn);

        db.clear_save_sync_failure(42, "pre_launch").unwrap();
        let conn = db.conn.lock().unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM pending_save_sync", [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(count, 0);
    }
}
