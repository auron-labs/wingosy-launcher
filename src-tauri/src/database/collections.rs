use anyhow::{Context, Result};
use rusqlite::params;

use super::Database;
use crate::models::{Collection, SmartFilter};

impl Database {
    pub fn insert_collection(&self, collection: &Collection) -> Result<i64> {
        let conn = self.conn.lock().unwrap();

        conn.execute(
            r#"
            INSERT INTO collections (name, is_smart, smart_filter, cover_path, sort_order)
            VALUES (?1, ?2, ?3, ?4, ?5)
            "#,
            params![
                collection.name,
                collection.is_smart,
                collection
                    .smart_filter
                    .as_ref()
                    .and_then(|f| serde_json::to_string(f).ok()),
                collection.cover_path,
                collection.sort_order,
            ],
        )
        .context("Failed to insert collection")?;

        Ok(conn.last_insert_rowid())
    }

    pub fn get_all_collections(&self) -> Result<Vec<Collection>> {
        let conn = self.conn.lock().unwrap();

        let mut stmt = conn
            .prepare("SELECT * FROM collections ORDER BY sort_order, name")
            .context("Failed to prepare statement")?;

        let collections = stmt
            .query_map([], |row: &rusqlite::Row| {
                let smart_filter_json: Option<String> = row.get("smart_filter")?;
                let smart_filter: Option<SmartFilter> =
                    smart_filter_json.and_then(|j: String| serde_json::from_str(&j).ok());

                Ok(Collection {
                    id: row.get("id")?,
                    name: row.get("name")?,
                    is_smart: row.get("is_smart")?,
                    smart_filter,
                    game_ids: Vec::new(),
                    cover_path: row.get("cover_path")?,
                    sort_order: row.get("sort_order")?,
                })
            })
            .context("Failed to query collections")?
            .filter_map(|r| r.ok())
            .collect();

        Ok(collections)
    }

    pub fn get_collection(&self, id: i64) -> Result<Option<Collection>> {
        let conn = self.conn.lock().unwrap();

        let mut stmt = conn
            .prepare("SELECT * FROM collections WHERE id = ?1")
            .context("Failed to prepare statement")?;

        let collection = stmt
            .query_row(params![id], |row: &rusqlite::Row| {
                let smart_filter_json: Option<String> = row.get("smart_filter")?;
                let smart_filter: Option<SmartFilter> =
                    smart_filter_json.and_then(|j: String| serde_json::from_str(&j).ok());

                Ok(Collection {
                    id: row.get("id")?,
                    name: row.get("name")?,
                    is_smart: row.get("is_smart")?,
                    smart_filter,
                    game_ids: Vec::new(),
                    cover_path: row.get("cover_path")?,
                    sort_order: row.get("sort_order")?,
                })
            })
            .optional()
            .context("Failed to query collection")?;

        Ok(collection)
    }

    pub fn add_game_to_collection(&self, collection_id: i64, game_id: i64) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        conn.execute(
            "INSERT OR IGNORE INTO collection_games (collection_id, game_id) VALUES (?1, ?2)",
            params![collection_id, game_id],
        )
        .context("Failed to add game to collection")?;

        Ok(())
    }

    pub fn remove_game_from_collection(&self, collection_id: i64, game_id: i64) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        conn.execute(
            "DELETE FROM collection_games WHERE collection_id = ?1 AND game_id = ?2",
            params![collection_id, game_id],
        )
        .context("Failed to remove game from collection")?;

        Ok(())
    }

    pub fn get_collection_game_ids(&self, collection_id: i64) -> Result<Vec<i64>> {
        let conn = self.conn.lock().unwrap();

        let mut stmt = conn
            .prepare(
                "SELECT game_id FROM collection_games WHERE collection_id = ?1 ORDER BY sort_order",
            )
            .context("Failed to prepare statement")?;

        let ids = stmt
            .query_map(params![collection_id], |row: &rusqlite::Row| row.get(0))
            .context("Failed to query collection games")?
            .filter_map(|r| r.ok())
            .collect();

        Ok(ids)
    }

    pub fn delete_collection(&self, id: i64) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        conn.execute("DELETE FROM collections WHERE id = ?1", params![id])
            .context("Failed to delete collection")?;

        Ok(())
    }

    pub fn initialize_default_collections(&self) -> Result<()> {
        let collections = crate::models::default_smart_collections();

        for (i, mut collection) in collections.into_iter().enumerate() {
            collection.sort_order = i as i32;
            self.insert_collection(&collection)?;
        }

        Ok(())
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
