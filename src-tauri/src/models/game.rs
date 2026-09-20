use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use super::SyncState;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Game {
    pub id: i64,
    pub platform_id: String,
    pub name: String,
    pub file_path: String,
    pub source: GameSource,
    pub romm_id: Option<i32>,

    // Metadata
    pub summary: Option<String>,
    pub developer: Option<String>,
    pub publisher: Option<String>,
    pub release_year: Option<i32>,
    pub genres: Vec<String>,
    pub player_count: Option<String>,

    // Media
    pub cover_path: Option<String>,
    pub screenshot_paths: Vec<String>,

    // User data
    pub is_favorite: bool,
    pub is_hidden: bool,
    /// IGDB aggregated / total rating from RomM metadata (typically 0–100 when present).
    pub user_rating: Option<f32>,
    /// Local library status: `backlog`, `playing`, `completed`, `on_hold`, `dropped`, or unset.
    pub library_status: Option<String>,
    /// Personal 1–5 stars; `0` means unset.
    pub personal_rating: i32,
    /// Personal difficulty 1–5; `0` means unset.
    pub personal_difficulty: i32,
    pub last_played_at: Option<DateTime<Utc>>,
    pub play_count: i32,
    pub play_time_minutes: i32,

    // Sync
    pub sync_state: SyncState,
    pub local_file_path: Option<String>,
}

impl Game {
    pub fn new(name: String, file_path: String, platform_id: String) -> Self {
        Self {
            id: 0,
            platform_id,
            name,
            file_path,
            source: GameSource::Local,
            romm_id: None,
            summary: None,
            developer: None,
            publisher: None,
            release_year: None,
            genres: Vec::new(),
            player_count: None,
            cover_path: None,
            screenshot_paths: Vec::new(),
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

    pub fn formatted_play_time(&self) -> String {
        let hours = self.play_time_minutes / 60;
        let minutes = self.play_time_minutes % 60;
        if hours > 0 {
            format!("{}h {}m", hours, minutes)
        } else {
            format!("{}m", minutes)
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum GameSource {
    Local,
    RomM,
}

impl GameSource {
    pub fn to_db_str(self) -> &'static str {
        match self {
            GameSource::Local => "local",
            GameSource::RomM => "romm",
        }
    }

    pub fn from_db_str(s: &str) -> Self {
        match s {
            "romm" => GameSource::RomM,
            _ => GameSource::Local,
        }
    }
}

impl std::fmt::Display for GameSource {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            GameSource::Local => write!(f, "Local"),
            GameSource::RomM => write!(f, "RomM"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct GameFilter {
    pub platform_id: Option<String>,
    pub genre: Option<String>,
    pub main_filter: GameMainFilter,
    pub availability: GameAvailability,
    /// Legacy favorite-only flag retained for existing non-paged callers.
    pub favorites_only: bool,
    pub search_query: Option<String>,
    pub sort_by: GameSort,
    pub sort_descending: bool,
}

impl Default for GameFilter {
    fn default() -> Self {
        Self {
            platform_id: None,
            genre: None,
            main_filter: GameMainFilter::All,
            availability: GameAvailability::All,
            favorites_only: false,
            search_query: None,
            sort_by: GameSort::Name,
            sort_descending: false,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum GameMainFilter {
    #[default]
    All,
    Favorites,
    Recent,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum GameAvailability {
    #[default]
    All,
    Downloaded,
    NotDownloaded,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum GameSort {
    #[default]
    Name,
    LastPlayed,
    PlayCount,
    PlayTime,
    ReleaseYear,
    RecentlyAdded,
    Rating,
}

impl GameSort {
    pub fn default_descending(self) -> bool {
        !matches!(self, Self::Name)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn game_source_roundtrip() {
        assert_eq!(
            GameSource::from_db_str(GameSource::Local.to_db_str()),
            GameSource::Local
        );
        assert_eq!(
            GameSource::from_db_str(GameSource::RomM.to_db_str()),
            GameSource::RomM
        );
    }

    #[test]
    fn game_source_unknown_defaults_to_local() {
        assert_eq!(GameSource::from_db_str("unknown"), GameSource::Local);
    }

    #[test]
    fn formatted_play_time_hours_and_minutes() {
        let mut game = Game::new("Test".into(), "test.rom".into(), "snes".into());
        game.play_time_minutes = 125;
        assert_eq!(game.formatted_play_time(), "2h 5m");
    }

    #[test]
    fn formatted_play_time_minutes_only() {
        let mut game = Game::new("Test".into(), "test.rom".into(), "snes".into());
        game.play_time_minutes = 45;
        assert_eq!(game.formatted_play_time(), "45m");
    }

    #[test]
    fn formatted_play_time_zero() {
        let game = Game::new("Test".into(), "test.rom".into(), "snes".into());
        assert_eq!(game.formatted_play_time(), "0m");
    }

    #[test]
    fn formatted_play_time_exact_hours() {
        let mut game = Game::new("Test".into(), "test.rom".into(), "snes".into());
        game.play_time_minutes = 120;
        assert_eq!(game.formatted_play_time(), "2h 0m");
    }

    #[test]
    fn game_new_sets_defaults() {
        let game = Game::new("Super Mario".into(), "mario.sfc".into(), "snes".into());

        assert_eq!(game.id, 0);
        assert_eq!(game.name, "Super Mario");
        assert_eq!(game.file_path, "mario.sfc");
        assert_eq!(game.platform_id, "snes");
        assert_eq!(game.source, GameSource::Local);
        assert!(!game.is_favorite);
        assert!(!game.is_hidden);
        assert_eq!(game.play_count, 0);
        assert_eq!(game.play_time_minutes, 0);
        assert!(game.genres.is_empty());
        assert!(game.screenshot_paths.is_empty());
    }

    #[test]
    fn game_source_display() {
        assert_eq!(format!("{}", GameSource::Local), "Local");
        assert_eq!(format!("{}", GameSource::RomM), "RomM");
    }

    #[test]
    fn game_source_db_str() {
        assert_eq!(GameSource::Local.to_db_str(), "local");
        assert_eq!(GameSource::RomM.to_db_str(), "romm");
    }

    #[test]
    fn game_filter_default() {
        let filter = GameFilter::default();

        assert!(filter.platform_id.is_none());
        assert!(filter.genre.is_none());
        assert_eq!(filter.main_filter, GameMainFilter::All);
        assert_eq!(filter.availability, GameAvailability::All);
        assert!(!filter.favorites_only);
        assert!(filter.search_query.is_none());
        assert_eq!(filter.sort_by, GameSort::Name);
        assert!(!filter.sort_descending);
    }

    #[test]
    fn game_sort_equality() {
        assert_eq!(GameSort::Name, GameSort::Name);
        assert_ne!(GameSort::Name, GameSort::LastPlayed);
        assert_ne!(GameSort::PlayCount, GameSort::PlayTime);
    }

    #[test]
    fn game_clone() {
        let game = Game::new("Test".into(), "test.rom".into(), "gba".into());
        let cloned = game.clone();

        assert_eq!(game.name, cloned.name);
        assert_eq!(game.file_path, cloned.file_path);
        assert_eq!(game.platform_id, cloned.platform_id);
    }

    #[test]
    fn game_with_metadata() {
        let mut game = Game::new("Final Fantasy".into(), "ff.iso".into(), "psx".into());
        game.summary = Some("An RPG game".into());
        game.developer = Some("Square".into());
        game.publisher = Some("Sony".into());
        game.release_year = Some(1997);
        game.genres = vec!["RPG".into(), "Adventure".into()];
        game.player_count = Some("1".into());

        assert_eq!(game.summary, Some("An RPG game".into()));
        assert_eq!(game.developer, Some("Square".into()));
        assert_eq!(game.release_year, Some(1997));
        assert_eq!(game.genres.len(), 2);
    }

    #[test]
    fn game_source_copy() {
        let source = GameSource::Local;
        let copied = source;
        assert_eq!(source, copied);
    }
}
