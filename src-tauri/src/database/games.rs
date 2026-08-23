use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use rusqlite::{params, Row};

use super::Database;
use crate::models::{Game, GameFilter, GameSort, GameSource, SyncState};

impl Database {
    pub fn insert_game(&self, game: &Game) -> Result<i64> {
        let conn = self.conn.lock().unwrap();

        conn.execute(
            r#"
            INSERT INTO games (
                platform_id, name, file_path, source, romm_id,
                summary, developer, publisher, release_year, genres, player_count,
                cover_path, screenshot_paths,
                is_favorite, is_hidden, user_rating,
                library_status, personal_rating, personal_difficulty,
                last_played_at, play_count, play_time_minutes,
                sync_state, local_file_path
            ) VALUES (
                ?1, ?2, ?3, ?4, ?5,
                ?6, ?7, ?8, ?9, ?10, ?11,
                ?12, ?13,
                ?14, ?15, ?16,
                ?17, ?18, ?19,
                ?20, ?21, ?22,
                ?23, ?24
            )
            "#,
            params![
                game.platform_id,
                game.name,
                game.file_path,
                game.source.to_db_str(),
                game.romm_id,
                game.summary,
                game.developer,
                game.publisher,
                game.release_year,
                serde_json::to_string(&game.genres).ok(),
                game.player_count,
                game.cover_path,
                serde_json::to_string(&game.screenshot_paths).ok(),
                game.is_favorite,
                game.is_hidden,
                game.user_rating,
                game.library_status.clone(),
                game.personal_rating,
                game.personal_difficulty,
                game.last_played_at.map(|d| d.to_rfc3339()),
                game.play_count,
                game.play_time_minutes,
                game.sync_state.to_db_str(),
                game.local_file_path,
            ],
        )
        .context("Failed to insert game")?;

        Ok(conn.last_insert_rowid())
    }

    pub fn update_game(&self, game: &Game) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        conn.execute(
            r#"
            UPDATE games SET
                platform_id = ?2,
                name = ?3,
                file_path = ?4,
                source = ?5,
                romm_id = ?6,
                summary = ?7,
                developer = ?8,
                publisher = ?9,
                release_year = ?10,
                genres = ?11,
                player_count = ?12,
                cover_path = ?13,
                screenshot_paths = ?14,
                is_favorite = ?15,
                is_hidden = ?16,
                user_rating = ?17,
                library_status = ?18,
                personal_rating = ?19,
                personal_difficulty = ?20,
                last_played_at = ?21,
                play_count = ?22,
                play_time_minutes = ?23,
                sync_state = ?24,
                local_file_path = ?25,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?1
            "#,
            params![
                game.id,
                game.platform_id,
                game.name,
                game.file_path,
                game.source.to_db_str(),
                game.romm_id,
                game.summary,
                game.developer,
                game.publisher,
                game.release_year,
                serde_json::to_string(&game.genres).ok(),
                game.player_count,
                game.cover_path,
                serde_json::to_string(&game.screenshot_paths).ok(),
                game.is_favorite,
                game.is_hidden,
                game.user_rating,
                game.library_status.clone(),
                game.personal_rating,
                game.personal_difficulty,
                game.last_played_at.map(|d| d.to_rfc3339()),
                game.play_count,
                game.play_time_minutes,
                game.sync_state.to_db_str(),
                game.local_file_path,
            ],
        )
        .context("Failed to update game")?;

        Ok(())
    }

    pub fn get_game(&self, id: i64) -> Result<Option<Game>> {
        let conn = self.conn.lock().unwrap();

        let mut stmt = conn
            .prepare("SELECT * FROM games WHERE id = ?1")
            .context("Failed to prepare statement")?;

        let game = stmt
            .query_row(params![id], |row: &Row| Ok(Self::row_to_game(row)))
            .optional()
            .context("Failed to query game")?;

        match game {
            Some(Ok(g)) => Ok(Some(g)),
            Some(Err(e)) => Err(e),
            None => Ok(None),
        }
    }

    pub fn get_game_by_romm_id(&self, romm_id: i32) -> Result<Option<Game>> {
        let conn = self.conn.lock().unwrap();

        let mut stmt = conn
            .prepare("SELECT * FROM games WHERE romm_id = ?1")
            .context("Failed to prepare statement")?;

        let game = stmt
            .query_row(params![romm_id], |row: &Row| Ok(Self::row_to_game(row)))
            .optional()
            .context("Failed to query game")?;

        match game {
            Some(Ok(g)) => Ok(Some(g)),
            Some(Err(e)) => Err(e),
            None => Ok(None),
        }
    }

    pub fn get_all_games(&self) -> Result<Vec<Game>> {
        let conn = self.conn.lock().unwrap();

        let mut stmt = conn
            .prepare("SELECT * FROM games WHERE is_hidden = 0 ORDER BY name")
            .context("Failed to prepare statement")?;

        let games = stmt
            .query_map([], |row: &Row| Ok(Self::row_to_game(row)))
            .context("Failed to query games")?
            .filter_map(|r| r.ok().and_then(|g| g.ok()))
            .collect();

        Ok(games)
    }

    /// Get all games, including hidden entries, for storage maintenance operations.
    pub fn get_all_games_including_hidden(&self) -> Result<Vec<Game>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare("SELECT * FROM games ORDER BY name")
            .context("Failed to prepare statement")?;

        let games = stmt
            .query_map([], |row: &Row| Ok(Self::row_to_game(row)))
            .context("Failed to query games")?
            .filter_map(|result| result.ok().and_then(|game| game.ok()))
            .collect();

        Ok(games)
    }

    pub fn get_games_filtered(&self, filter: &GameFilter) -> Result<Vec<Game>> {
        self.query_games_filtered(filter, None)
    }

    pub fn get_games_page(
        &self,
        filter: &GameFilter,
        limit: i64,
        offset: i64,
    ) -> Result<(Vec<Game>, i64)> {
        let total = self.count_games_filtered(filter)?;
        let games = self.query_games_filtered(filter, Some((limit, offset)))?;
        Ok((games, total))
    }

    fn query_games_filtered(
        &self,
        filter: &GameFilter,
        pagination: Option<(i64, i64)>,
    ) -> Result<Vec<Game>> {
        let conn = self.conn.lock().unwrap();

        let (where_clause, mut params_vec) = Self::games_filter_where(filter);
        let mut sql = format!("SELECT * FROM games{where_clause}");

        let order = match filter.sort_by {
            GameSort::Name => "name",
            GameSort::LastPlayed => "last_played_at",
            GameSort::PlayCount => "play_count",
            GameSort::PlayTime => "play_time_minutes",
            GameSort::ReleaseYear => "release_year",
            GameSort::RecentlyAdded => "created_at",
            GameSort::Rating => "user_rating",
        };

        let direction = if filter.sort_descending { "DESC" } else { "ASC" };
        sql.push_str(&format!(" ORDER BY {} {} NULLS LAST", order, direction));

        if let Some((limit, offset)) = pagination {
            sql.push_str(" LIMIT ? OFFSET ?");
            params_vec.push(Box::new(limit));
            params_vec.push(Box::new(offset));
        }

        let mut stmt = conn.prepare(&sql).context("Failed to prepare statement")?;

        let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();

        let games = stmt
            .query_map(params_refs.as_slice(), |row: &Row| Ok(Self::row_to_game(row)))
            .context("Failed to query games")?
            .filter_map(|r| r.ok().and_then(|g| g.ok()))
            .collect();

        Ok(games)
    }

    fn count_games_filtered(&self, filter: &GameFilter) -> Result<i64> {
        let conn = self.conn.lock().unwrap();
        let (where_clause, params_vec) = Self::games_filter_where(filter);
        let params_refs: Vec<&dyn rusqlite::ToSql> =
            params_vec.iter().map(|param| param.as_ref()).collect();

        conn.query_row(
            &format!("SELECT COUNT(*) FROM games{where_clause}"),
            params_refs.as_slice(),
            |row| row.get(0),
        )
        .context("Failed to count games")
    }

    fn games_filter_where(
        filter: &GameFilter,
    ) -> (String, Vec<Box<dyn rusqlite::ToSql>>) {
        let mut sql = String::from(" WHERE 1=1");
        let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        if !filter.favorites_only {
            sql.push_str(" AND is_hidden = 0");
        }
        if let Some(ref platform_id) = filter.platform_id {
            sql.push_str(" AND platform_id = ?");
            params_vec.push(Box::new(platform_id.clone()));
        }
        if filter.favorites_only {
            sql.push_str(" AND is_favorite = 1");
        }
        if let Some(ref query) = filter.search_query {
            sql.push_str(" AND name LIKE ?");
            params_vec.push(Box::new(format!("%{}%", query)));
        }

        (sql, params_vec)
    }

    pub fn get_recent_games(&self, limit: i32) -> Result<Vec<Game>> {
        let conn = self.conn.lock().unwrap();

        let mut stmt = conn
            .prepare(
                "SELECT * FROM games WHERE last_played_at IS NOT NULL AND is_hidden = 0 
                 ORDER BY last_played_at DESC LIMIT ?1",
            )
            .context("Failed to prepare statement")?;

        let games = stmt
            .query_map(params![limit], |row: &Row| Ok(Self::row_to_game(row)))
            .context("Failed to query games")?
            .filter_map(|r| r.ok().and_then(|g| g.ok()))
            .collect();

        Ok(games)
    }

    pub fn get_favorite_games(&self) -> Result<Vec<Game>> {
        let conn = self.conn.lock().unwrap();

        let mut stmt = conn
            .prepare("SELECT * FROM games WHERE is_favorite = 1 AND is_hidden = 0 ORDER BY name")
            .context("Failed to prepare statement")?;

        let games = stmt
            .query_map([], |row: &Row| Ok(Self::row_to_game(row)))
            .context("Failed to query games")?
            .filter_map(|r| r.ok().and_then(|g| g.ok()))
            .collect();

        Ok(games)
    }

    pub fn set_favorite(&self, game_id: i64, is_favorite: bool) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        conn.execute(
            "UPDATE games SET is_favorite = ?2, updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
            params![game_id, is_favorite],
        )
        .context("Failed to update favorite status")?;

        Ok(())
    }

    pub fn record_play_session(&self, game_id: i64, duration_minutes: i32) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        conn.execute(
            r#"
            UPDATE games SET
                last_played_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now'),
                play_count = play_count + 1,
                play_time_minutes = play_time_minutes + ?2,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?1
            "#,
            params![game_id, duration_minutes],
        )
        .context("Failed to record play session")?;

        Ok(())
    }

    pub fn upsert_game(&self, game: &Game) -> Result<i64> {
        if let Some(romm_id) = game.romm_id {
            if let Some(existing) = self.get_game_by_romm_id(romm_id)? {
                let mut updated = game.clone();
                updated.id = existing.id;
                updated.is_favorite = existing.is_favorite;
                updated.is_hidden = existing.is_hidden;
                updated.play_count = existing.play_count;
                updated.play_time_minutes = existing.play_time_minutes;
                updated.last_played_at = existing.last_played_at;
                // Keep local library state across RomM metadata syncs
                if existing.local_file_path.is_some() {
                    updated.local_file_path = existing.local_file_path.clone();
                    updated.sync_state = crate::models::SyncState::Synced;
                }
                updated.library_status = existing.library_status.clone();
                updated.personal_rating = existing.personal_rating;
                updated.personal_difficulty = existing.personal_difficulty;
                self.update_game(&updated)?;
                return Ok(existing.id);
            }
        }
        self.insert_game(game)
    }

    pub fn delete_game(&self, game_id: i64) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        conn.execute("DELETE FROM games WHERE id = ?1", params![game_id])
            .context("Failed to delete game")?;

        Ok(())
    }

    fn row_to_game(row: &Row) -> Result<Game> {
        let source_str: String = row.get("source")?;
        let source = GameSource::from_db_str(&source_str);

        let sync_state_str: String = row.get("sync_state")?;
        let sync_state = SyncState::from_db_str(&sync_state_str);

        let genres_json: Option<String> = row.get("genres")?;
        let genres: Vec<String> = genres_json
            .and_then(|j: String| serde_json::from_str(&j).ok())
            .unwrap_or_default();

        let screenshots_json: Option<String> = row.get("screenshot_paths")?;
        let screenshot_paths: Vec<String> = screenshots_json
            .and_then(|j: String| serde_json::from_str(&j).ok())
            .unwrap_or_default();

        let last_played_str: Option<String> = row.get("last_played_at")?;
        let last_played_at = last_played_str.and_then(|s: String| DateTime::parse_from_rfc3339(&s).ok().map(|d| d.with_timezone(&Utc)));

        let library_status: Option<String> = row.get::<_, Option<String>>("library_status")?;
        let personal_rating: i32 = row
            .get::<_, Option<i32>>("personal_rating")?
            .unwrap_or(0);
        let personal_difficulty: i32 = row
            .get::<_, Option<i32>>("personal_difficulty")?
            .unwrap_or(0);

        Ok(Game {
            id: row.get("id")?,
            platform_id: row.get("platform_id")?,
            name: row.get("name")?,
            file_path: row.get("file_path")?,
            source,
            romm_id: row.get("romm_id")?,
            summary: row.get("summary")?,
            developer: row.get("developer")?,
            publisher: row.get("publisher")?,
            release_year: row.get("release_year")?,
            genres,
            player_count: row.get("player_count")?,
            cover_path: row.get("cover_path")?,
            screenshot_paths,
            is_favorite: row.get("is_favorite")?,
            is_hidden: row.get("is_hidden")?,
            user_rating: row.get("user_rating")?,
            library_status,
            personal_rating,
            personal_difficulty,
            last_played_at,
            play_count: row.get("play_count")?,
            play_time_minutes: row.get("play_time_minutes")?,
            sync_state,
            local_file_path: row.get("local_file_path")?,
        })
    }

    /// Set the hidden status of a game
    pub fn set_hidden(&self, game_id: i64, is_hidden: bool) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE games SET is_hidden = ?2, updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
            params![game_id, is_hidden],
        )
        .context("Failed to update hidden status")?;
        Ok(())
    }

    /// Get all hidden games
    pub fn get_hidden_games(&self) -> Result<Vec<Game>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare("SELECT * FROM games WHERE is_hidden = 1 ORDER BY name")
            .context("Failed to prepare statement")?;

        let games = stmt
            .query_map([], |row: &Row| Ok(Self::row_to_game(row)))
            .context("Failed to query games")?
            .filter_map(|r| r.ok().and_then(|g| g.ok()))
            .collect();

        Ok(games)
    }

    /// Clear the local file path (after deleting the ROM)
    pub fn clear_local_path(&self, game_id: i64) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE games SET local_file_path = NULL, sync_state = 'remote_only', updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
            params![game_id],
        )
        .context("Failed to clear local path")?;
        Ok(())
    }

    /// Mark all RomM games as dirty before sync (Argosy-style sync pattern)
    /// This allows us to detect games that no longer exist on the server
    pub fn mark_romm_games_dirty(&self) -> Result<i32> {
        let conn = self.conn.lock().unwrap();
        let count = conn.execute(
            "UPDATE games SET sync_dirty = 1 WHERE source = 'romm'",
            [],
        )
        .context("Failed to mark RomM games as dirty")?;
        Ok(count as i32)
    }

    /// Mark all RomM games for a specific platform as dirty
    pub fn mark_platform_games_dirty(&self, platform_id: &str) -> Result<i32> {
        let conn = self.conn.lock().unwrap();
        let count = conn.execute(
            "UPDATE games SET sync_dirty = 1 WHERE source = 'romm' AND platform_id = ?1",
            params![platform_id],
        )
        .context("Failed to mark platform games as dirty")?;
        Ok(count as i32)
    }

    /// Clear dirty flag for a game (called when game is seen during sync)
    pub fn clear_sync_dirty(&self, game_id: i64) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE games SET sync_dirty = 0 WHERE id = ?1",
            params![game_id],
        )
        .context("Failed to clear sync dirty flag")?;
        Ok(())
    }

    /// Clear dirty flag by romm_id (called when game is seen during sync)
    pub fn clear_sync_dirty_by_romm_id(&self, romm_id: i32) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE games SET sync_dirty = 0 WHERE romm_id = ?1",
            params![romm_id],
        )
        .context("Failed to clear sync dirty flag")?;
        Ok(())
    }

    /// Clear all dirty flags (called after sync completes)
    pub fn clear_all_sync_dirty(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("UPDATE games SET sync_dirty = 0", [])
            .context("Failed to clear all sync dirty flags")?;
        Ok(())
    }

    /// Get all games that are still marked dirty (orphaned games)
    pub fn get_dirty_games(&self) -> Result<Vec<Game>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare("SELECT * FROM games WHERE sync_dirty = 1")
            .context("Failed to prepare statement")?;

        let games = stmt
            .query_map([], |row: &Row| Ok(Self::row_to_game(row)))
            .context("Failed to query dirty games")?
            .filter_map(|r| r.ok().and_then(|g| g.ok()))
            .collect();

        Ok(games)
    }

    /// Delete all games that are still marked dirty (orphaned games from RomM)
    /// Returns the number of games deleted
    pub fn delete_dirty_games(&self) -> Result<i32> {
        let conn = self.conn.lock().unwrap();
        let count = conn.execute(
            "DELETE FROM games WHERE sync_dirty = 1 AND source = 'romm'",
            [],
        )
        .context("Failed to delete dirty games")?;
        Ok(count as i32)
    }

    /// Get all RomM games (including hidden ones) for sync validation
    pub fn get_all_romm_games(&self) -> Result<Vec<Game>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare("SELECT * FROM games WHERE source = 'romm' ORDER BY name")
            .context("Failed to prepare statement")?;

        let games = stmt
            .query_map([], |row: &Row| Ok(Self::row_to_game(row)))
            .context("Failed to query RomM games")?
            .filter_map(|r| r.ok().and_then(|g| g.ok()))
            .collect();

        Ok(games)
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{Game, GameSource, SyncState};

    fn create_test_game(name: &str) -> Game {
        Game {
            id: 0,
            platform_id: "gba".to_string(),
            name: name.to_string(),
            file_path: String::new(),
            source: GameSource::Local,
            romm_id: None,
            summary: None,
            developer: None,
            publisher: None,
            release_year: None,
            genres: vec![],
            player_count: None,
            cover_path: None,
            screenshot_paths: vec![],
            is_favorite: false,
            is_hidden: false,
            user_rating: None,
            library_status: None,
            personal_rating: 0,
            personal_difficulty: 0,
            last_played_at: None,
            play_count: 0,
            play_time_minutes: 0,
            sync_state: SyncState::LocalOnly,
            local_file_path: None,
        }
    }

    #[test]
    fn test_game_filter_default() {
        let filter = GameFilter::default();
        assert!(filter.platform_id.is_none());
        assert!(filter.genre.is_none());
        assert!(filter.search_query.is_none());
        assert!(!filter.favorites_only);
        assert!(!filter.sort_descending);
    }

    #[test]
    fn test_game_sort_variants() {
        let sorts = [
            GameSort::Name,
            GameSort::LastPlayed,
            GameSort::PlayCount,
            GameSort::PlayTime,
            GameSort::ReleaseYear,
            GameSort::RecentlyAdded,
            GameSort::Rating,
        ];
        assert_eq!(sorts.len(), 7);
    }

    #[test]
    fn test_create_test_game_defaults() {
        let game = create_test_game("Test Game");
        assert_eq!(game.name, "Test Game");
        assert_eq!(game.platform_id, "gba");
        assert!(!game.is_favorite);
        assert!(!game.is_hidden);
        assert_eq!(game.play_count, 0);
    }

    #[test]
    fn test_game_with_hidden_flag() {
        let mut game = create_test_game("Hidden Game");
        game.is_hidden = true;
        assert!(game.is_hidden);
    }

    #[test]
    fn test_game_with_romm_id() {
        let mut game = create_test_game("RomM Game");
        game.romm_id = Some(123);
        game.source = GameSource::RomM;
        assert_eq!(game.romm_id, Some(123));
        assert!(matches!(game.source, GameSource::RomM));
    }

    #[test]
    fn test_game_with_local_file_path() {
        let mut game = create_test_game("Local Game");
        game.local_file_path = Some("C:\\ROMs\\game.gba".to_string());
        game.sync_state = SyncState::Synced;
        assert!(game.local_file_path.is_some());
        assert!(matches!(game.sync_state, SyncState::Synced));
    }

    #[test]
    fn test_get_games_page_limits_results_and_returns_total() {
        let db = Database::open_in_memory().unwrap();
        db.insert_platform(&crate::models::Platform::new("gba", "GBA", vec![".gba"]))
            .unwrap();
        for name in ["Alpha", "Bravo", "Charlie", "Delta", "Echo"] {
            db.insert_game(&create_test_game(name)).unwrap();
        }

        let (games, total) = db.get_games_page(&GameFilter::default(), 2, 2).unwrap();

        assert_eq!(total, 5);
        assert_eq!(
            games
                .iter()
                .map(|game| game.name.as_str())
                .collect::<Vec<_>>(),
            ["Charlie", "Delta"]
        );
    }

    #[test]
    fn test_sync_state_variants() {
        let states = [
            SyncState::LocalOnly,
            SyncState::RemoteOnly,
            SyncState::Synced,
            SyncState::PendingUpload,
            SyncState::PendingDownload,
            SyncState::Conflict,
        ];
        assert_eq!(states.len(), 6);
    }

    #[test]
    fn test_game_source_to_db_str() {
        assert_eq!(GameSource::Local.to_db_str(), "local");
        assert_eq!(GameSource::RomM.to_db_str(), "romm");
    }

    fn create_romm_game(name: &str, romm_id: i32) -> Game {
        let mut game = create_test_game(name);
        game.source = GameSource::RomM;
        game.romm_id = Some(romm_id);
        game.sync_state = SyncState::RemoteOnly;
        game
    }

    #[test]
    fn test_record_play_session_updates_play_stats_and_last_played() {
        let db = Database::open_in_memory().unwrap();
        db.insert_platform(&crate::models::Platform::new("gba", "GBA", vec![".gba"]))
            .unwrap();
        let mut game = create_test_game("Played Game");
        game.play_count = 2;
        game.play_time_minutes = 41;
        let id = db.insert_game(&game).unwrap();

        db.record_play_session(id, 17).unwrap();

        let game = db.get_game(id).unwrap().unwrap();
        assert_eq!(game.play_count, 3);
        assert_eq!(game.play_time_minutes, 58);
        assert!(game.last_played_at.is_some());
    }

    #[test]
    fn test_clear_local_path_preserves_romm_game_as_remote_only() {
        let db = Database::open_in_memory().unwrap();
        db.insert_platform(&crate::models::Platform::new("gba", "GBA", vec![".gba"]))
            .unwrap();
        let mut game = create_romm_game("Cached RomM Game", 101);
        game.local_file_path = Some("/roms/cached.gba".to_string());
        game.sync_state = SyncState::Synced;
        let id = db.insert_game(&game).unwrap();

        db.clear_local_path(id).unwrap();

        let game = db.get_game(id).unwrap().unwrap();
        assert_eq!(game.source, GameSource::RomM);
        assert_eq!(game.romm_id, Some(101));
        assert!(game.local_file_path.is_none());
        assert_eq!(game.sync_state, SyncState::RemoteOnly);
    }

    #[test]
    fn test_mark_romm_games_dirty() {
        let db = Database::open_in_memory().unwrap();
        db.insert_platform(&crate::models::Platform::new("gba", "GBA", vec![".gba"])).unwrap();
        
        // Insert some RomM games
        let game1 = create_romm_game("RomM Game 1", 101);
        let game2 = create_romm_game("RomM Game 2", 102);
        let local_game = create_test_game("Local Game");
        
        db.insert_game(&game1).unwrap();
        db.insert_game(&game2).unwrap();
        db.insert_game(&local_game).unwrap();
        
        // Mark RomM games as dirty
        let count = db.mark_romm_games_dirty().unwrap();
        assert_eq!(count, 2); // Only RomM games should be marked
        
        // Verify dirty games
        let dirty = db.get_dirty_games().unwrap();
        assert_eq!(dirty.len(), 2);
        assert!(dirty.iter().all(|g| g.source == GameSource::RomM));
    }

    #[test]
    fn test_clear_sync_dirty() {
        let db = Database::open_in_memory().unwrap();
        db.insert_platform(&crate::models::Platform::new("gba", "GBA", vec![".gba"])).unwrap();
        
        let game = create_romm_game("RomM Game", 101);
        let id = db.insert_game(&game).unwrap();
        
        // Mark as dirty
        db.mark_romm_games_dirty().unwrap();
        assert_eq!(db.get_dirty_games().unwrap().len(), 1);
        
        // Clear dirty flag
        db.clear_sync_dirty(id).unwrap();
        assert_eq!(db.get_dirty_games().unwrap().len(), 0);
    }

    #[test]
    fn test_clear_sync_dirty_by_romm_id() {
        let db = Database::open_in_memory().unwrap();
        db.insert_platform(&crate::models::Platform::new("gba", "GBA", vec![".gba"])).unwrap();
        
        let game = create_romm_game("RomM Game", 101);
        db.insert_game(&game).unwrap();
        
        // Mark as dirty
        db.mark_romm_games_dirty().unwrap();
        assert_eq!(db.get_dirty_games().unwrap().len(), 1);
        
        // Clear dirty flag by romm_id
        db.clear_sync_dirty_by_romm_id(101).unwrap();
        assert_eq!(db.get_dirty_games().unwrap().len(), 0);
    }

    #[test]
    fn test_delete_dirty_games() {
        let db = Database::open_in_memory().unwrap();
        db.insert_platform(&crate::models::Platform::new("gba", "GBA", vec![".gba"])).unwrap();
        
        // Insert games
        let romm_game = create_romm_game("RomM Game", 101);
        let local_game = create_test_game("Local Game");
        
        db.insert_game(&romm_game).unwrap();
        db.insert_game(&local_game).unwrap();
        
        // Mark RomM games as dirty
        db.mark_romm_games_dirty().unwrap();
        
        // Delete dirty games
        let deleted = db.delete_dirty_games().unwrap();
        assert_eq!(deleted, 1); // Only the RomM game should be deleted
        
        // Verify only local game remains
        let all_games = db.get_all_games().unwrap();
        assert_eq!(all_games.len(), 1);
        assert_eq!(all_games[0].name, "Local Game");
    }

    #[test]
    fn test_sync_pattern_full_flow() {
        let db = Database::open_in_memory().unwrap();
        db.insert_platform(&crate::models::Platform::new("gba", "GBA", vec![".gba"])).unwrap();
        
        // Initial state: 3 RomM games
        let game1 = create_romm_game("Game A", 101);
        let game2 = create_romm_game("Game B", 102);
        let game3 = create_romm_game("Game C", 103);
        
        let id1 = db.insert_game(&game1).unwrap();
        let id2 = db.insert_game(&game2).unwrap();
        db.insert_game(&game3).unwrap();
        
        // Step 1: Mark all as dirty (before sync)
        let dirty_count = db.mark_romm_games_dirty().unwrap();
        assert_eq!(dirty_count, 3);
        
        // Step 2: Simulate sync - games A and B still exist, C is gone
        db.clear_sync_dirty(id1).unwrap(); // Game A seen
        db.clear_sync_dirty(id2).unwrap(); // Game B seen
        // Game C not seen (still dirty)
        
        // Step 3: Delete orphaned games
        let deleted = db.delete_dirty_games().unwrap();
        assert_eq!(deleted, 1); // Game C deleted
        
        // Step 4: Verify final state
        let remaining = db.get_all_romm_games().unwrap();
        assert_eq!(remaining.len(), 2);
        assert!(remaining.iter().any(|g| g.name == "Game A"));
        assert!(remaining.iter().any(|g| g.name == "Game B"));
        assert!(!remaining.iter().any(|g| g.name == "Game C"));
    }

    #[test]
    fn test_hidden_games_also_get_cleaned_up() {
        let db = Database::open_in_memory().unwrap();
        db.insert_platform(&crate::models::Platform::new("gba", "GBA", vec![".gba"])).unwrap();
        
        // Create a hidden RomM game
        let mut hidden_game = create_romm_game("Hidden RomM Game", 101);
        hidden_game.is_hidden = true;
        
        let visible_game = create_romm_game("Visible RomM Game", 102);
        
        db.insert_game(&hidden_game).unwrap();
        let visible_id = db.insert_game(&visible_game).unwrap();
        
        // Mark all RomM games dirty
        db.mark_romm_games_dirty().unwrap();
        
        // Simulate sync - only visible game seen
        db.clear_sync_dirty(visible_id).unwrap();
        
        // Delete dirty games - should include the hidden game!
        let deleted = db.delete_dirty_games().unwrap();
        assert_eq!(deleted, 1);
        
        // Verify hidden game was deleted
        let remaining = db.get_all_romm_games().unwrap();
        assert_eq!(remaining.len(), 1);
        assert_eq!(remaining[0].name, "Visible RomM Game");
    }

    #[test]
    fn test_clear_all_sync_dirty() {
        let db = Database::open_in_memory().unwrap();
        db.insert_platform(&crate::models::Platform::new("gba", "GBA", vec![".gba"])).unwrap();
        
        // Insert multiple games
        for i in 1..=5 {
            let game = create_romm_game(&format!("Game {}", i), 100 + i);
            db.insert_game(&game).unwrap();
        }
        
        // Mark all dirty
        db.mark_romm_games_dirty().unwrap();
        assert_eq!(db.get_dirty_games().unwrap().len(), 5);
        
        // Clear all
        db.clear_all_sync_dirty().unwrap();
        assert_eq!(db.get_dirty_games().unwrap().len(), 0);
    }

    #[test]
    fn test_mark_platform_games_dirty() {
        let db = Database::open_in_memory().unwrap();
        db.insert_platform(&crate::models::Platform::new("gba", "GBA", vec![".gba"])).unwrap();
        db.insert_platform(&crate::models::Platform::new("snes", "SNES", vec![".sfc"])).unwrap();
        
        // Insert games for different platforms
        let gba_game = create_romm_game("GBA Game", 101);
        let mut snes_game = create_romm_game("SNES Game", 102);
        snes_game.platform_id = "snes".to_string();
        
        db.insert_game(&gba_game).unwrap();
        db.insert_game(&snes_game).unwrap();
        
        // Mark only GBA games dirty
        let count = db.mark_platform_games_dirty("gba").unwrap();
        assert_eq!(count, 1);
        
        // Verify only GBA game is dirty
        let dirty = db.get_dirty_games().unwrap();
        assert_eq!(dirty.len(), 1);
        assert_eq!(dirty[0].platform_id, "gba");
    }
}
