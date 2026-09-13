use anyhow::{Context, Result};
use rusqlite::params;

use super::Database;
use crate::models::EmulatorConfig;

impl Database {
    pub fn insert_emulator_config(&self, config: &EmulatorConfig) -> Result<i64> {
        let conn = self.conn.lock().unwrap();

        conn.execute(
            r#"
            INSERT INTO emulator_configs (platform_id, game_id, emulator_id, core_name, is_default)
            VALUES (?1, ?2, ?3, ?4, ?5)
            "#,
            params![
                config.platform_id,
                config.game_id,
                config.emulator_id,
                config.core_name,
                config.is_default,
            ],
        )
        .context("Failed to insert emulator config")?;

        Ok(conn.last_insert_rowid())
    }

    pub fn get_emulator_for_game(
        &self,
        game_id: i64,
        platform_id: &str,
    ) -> Result<Option<EmulatorConfig>> {
        let conn = self.conn.lock().unwrap();

        let mut stmt = conn
            .prepare("SELECT * FROM emulator_configs WHERE game_id = ?1")
            .context("Failed to prepare statement")?;

        if let Ok(config) = stmt.query_row(params![game_id], |row: &rusqlite::Row| {
            Ok(EmulatorConfig {
                platform_id: row.get("platform_id")?,
                game_id: row.get("game_id")?,
                emulator_id: row.get("emulator_id")?,
                core_name: row.get("core_name")?,
                is_default: row.get("is_default")?,
            })
        }) {
            return Ok(Some(config));
        }

        let mut stmt = conn
            .prepare("SELECT * FROM emulator_configs WHERE platform_id = ?1 AND game_id IS NULL AND is_default = 1")
            .context("Failed to prepare statement")?;

        if let Ok(config) = stmt.query_row(params![platform_id], |row: &rusqlite::Row| {
            Ok(EmulatorConfig {
                platform_id: row.get("platform_id")?,
                game_id: row.get("game_id")?,
                emulator_id: row.get("emulator_id")?,
                core_name: row.get("core_name")?,
                is_default: row.get("is_default")?,
            })
        }) {
            return Ok(Some(config));
        }

        let mut stmt = conn
            .prepare("SELECT * FROM emulator_configs WHERE platform_id IS NULL AND game_id IS NULL AND is_default = 1")
            .context("Failed to prepare statement")?;

        if let Ok(config) = stmt.query_row([], |row: &rusqlite::Row| {
            Ok(EmulatorConfig {
                platform_id: row.get("platform_id")?,
                game_id: row.get("game_id")?,
                emulator_id: row.get("emulator_id")?,
                core_name: row.get("core_name")?,
                is_default: row.get("is_default")?,
            })
        }) {
            return Ok(Some(config));
        }

        Ok(None)
    }

    pub fn set_default_emulator_for_platform(
        &self,
        platform_id: &str,
        emulator_id: &str,
        core_name: Option<&str>,
    ) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        conn.execute(
            "UPDATE emulator_configs SET is_default = 0 WHERE platform_id = ?1 AND game_id IS NULL",
            params![platform_id],
        )
        .context("Failed to clear default")?;

        conn.execute(
            r#"
            INSERT INTO emulator_configs (platform_id, game_id, emulator_id, core_name, is_default)
            VALUES (?1, NULL, ?2, ?3, 1)
            ON CONFLICT DO UPDATE SET emulator_id = ?2, core_name = ?3, is_default = 1
            "#,
            params![platform_id, emulator_id, core_name],
        )
        .context("Failed to set default emulator")?;

        Ok(())
    }

    pub fn set_emulator_for_game(
        &self,
        game_id: i64,
        emulator_id: &str,
        core_name: Option<&str>,
    ) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        conn.execute(
            "DELETE FROM emulator_configs WHERE game_id = ?1",
            params![game_id],
        )
        .context("Failed to clear game emulator")?;

        conn.execute(
            r#"
            INSERT INTO emulator_configs (platform_id, game_id, emulator_id, core_name, is_default)
            VALUES (NULL, ?1, ?2, ?3, 0)
            "#,
            params![game_id, emulator_id, core_name],
        )
        .context("Failed to set game emulator")?;

        Ok(())
    }

    pub fn clear_game_emulator_override(&self, game_id: i64) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        conn.execute(
            "DELETE FROM emulator_configs WHERE game_id = ?1",
            params![game_id],
        )
        .context("Failed to clear game emulator override")?;

        Ok(())
    }

    pub fn get_platform_default_emulator(
        &self,
        platform_id: &str,
    ) -> Result<Option<EmulatorConfig>> {
        let conn = self.conn.lock().unwrap();

        let mut stmt = conn
            .prepare(
                "SELECT * FROM emulator_configs WHERE platform_id = ?1 AND game_id IS NULL AND is_default = 1",
            )
            .context("Failed to prepare statement")?;

        let config = stmt
            .query_row(params![platform_id], |row: &rusqlite::Row| {
                Ok(EmulatorConfig {
                    platform_id: row.get("platform_id")?,
                    game_id: row.get("game_id")?,
                    emulator_id: row.get("emulator_id")?,
                    core_name: row.get("core_name")?,
                    is_default: row.get("is_default")?,
                })
            })
            .optional()
            .context("Failed to query emulator config")?;

        Ok(config)
    }
}

trait OptionalExt<T> {
    fn optional(self) -> Result<Option<T>, rusqlite::Error>;
}

impl<T> OptionalExt<T> for std::result::Result<T, rusqlite::Error> {
    fn optional(self) -> Result<Option<T>, rusqlite::Error> {
        match self {
            Ok(v) => Ok(Some(v)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }
}
