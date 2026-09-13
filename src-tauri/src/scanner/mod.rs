use anyhow::Result;
use std::path::{Path, PathBuf};
use tokio::sync::mpsc;
use walkdir::WalkDir;

use crate::models::{detect_platform_by_extension, Game, Platform};

#[derive(Debug, Clone)]
#[allow(clippy::large_enum_variant)]
pub enum ScanEvent {
    Started { total_files: usize },
    Progress { current: usize, total: usize },
    GameFound { game: Game },
    Error { path: PathBuf, error: String },
    Completed { games_found: usize },
}

pub struct RomScanner {
    platforms: Vec<Platform>,
}

impl RomScanner {
    pub fn new(platforms: Vec<Platform>) -> Self {
        Self { platforms }
    }

    pub async fn scan(
        &self,
        directory: &Path,
        recursive: bool,
        tx: mpsc::Sender<ScanEvent>,
    ) -> Result<Vec<Game>> {
        tracing::info!(
            "[Scanner] Starting scan of {:?} (recursive={})",
            directory,
            recursive
        );

        let files = self.collect_files(directory, recursive)?;
        let total_files = files.len();

        tracing::info!("[Scanner] Found {} ROM files to process", total_files);

        tx.send(ScanEvent::Started { total_files }).await.ok();

        let mut games = Vec::new();
        let mut errors = 0;

        for (index, file_path) in files.iter().enumerate() {
            tx.send(ScanEvent::Progress {
                current: index + 1,
                total: total_files,
            })
            .await
            .ok();

            match self.process_file(file_path) {
                Ok(Some(game)) => {
                    tracing::debug!("[Scanner] Found game: {} ({})", game.name, game.platform_id);
                    tx.send(ScanEvent::GameFound { game: game.clone() })
                        .await
                        .ok();
                    games.push(game);
                }
                Ok(None) => {}
                Err(e) => {
                    errors += 1;
                    tracing::warn!("[Scanner] Error processing {:?}: {}", file_path, e);
                    tx.send(ScanEvent::Error {
                        path: file_path.clone(),
                        error: e.to_string(),
                    })
                    .await
                    .ok();
                }
            }
        }

        tracing::info!(
            "[Scanner] Scan complete: {} games found, {} errors",
            games.len(),
            errors
        );

        tx.send(ScanEvent::Completed {
            games_found: games.len(),
        })
        .await
        .ok();

        Ok(games)
    }

    fn collect_files(&self, directory: &Path, recursive: bool) -> Result<Vec<PathBuf>> {
        let walker = if recursive {
            WalkDir::new(directory)
        } else {
            WalkDir::new(directory).max_depth(1)
        };

        let extensions: Vec<String> = self
            .platforms
            .iter()
            .flat_map(|p| p.extensions.clone())
            .map(|e| e.to_lowercase())
            .collect();

        let files: Vec<PathBuf> = walker
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_file())
            .filter(|e| {
                if let Some(ext) = e.path().extension() {
                    let ext_str = format!(".{}", ext.to_string_lossy().to_lowercase());
                    extensions.contains(&ext_str)
                } else {
                    false
                }
            })
            .map(|e| e.path().to_path_buf())
            .collect();

        Ok(files)
    }

    fn process_file(&self, file_path: &Path) -> Result<Option<Game>> {
        let extension = file_path
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| format!(".{}", e.to_lowercase()))
            .unwrap_or_default();

        let platform_id = match detect_platform_by_extension(&extension) {
            Some(id) => id,
            None => return Ok(None),
        };

        let name = file_path
            .file_stem()
            .and_then(|n| n.to_str())
            .map(clean_rom_name)
            .unwrap_or_else(|| "Unknown".to_string());

        let file_path_str = file_path.to_string_lossy().to_string();

        let game = Game::new(name, file_path_str.clone(), platform_id);

        Ok(Some(Game {
            local_file_path: Some(file_path_str),
            ..game
        }))
    }

    pub fn scan_single(&self, file_path: &Path) -> Result<Option<Game>> {
        self.process_file(file_path)
    }
}

fn clean_rom_name(name: &str) -> String {
    let mut result = name.to_string();

    let patterns = [
        (r"\s*\([^)]*\)", ""),
        (r"\s*\[[^\]]*\]", ""),
        (r"\s*\{[^}]*\}", ""),
    ];

    for (pattern, replacement) in patterns {
        if let Ok(re) = regex_lite::Regex::new(pattern) {
            result = re.replace_all(&result, replacement).to_string();
        }
    }

    result = result.replace('_', " ");

    result.split_whitespace().collect::<Vec<_>>().join(" ")
}

pub fn detect_multi_disc(name: &str) -> Option<(String, u8)> {
    let patterns = [
        r"(?i)\s*\(disc\s*(\d+)\)",
        r"(?i)\s*\(cd\s*(\d+)\)",
        r"(?i)\s*disc\s*(\d+)",
        r"(?i)\s*cd\s*(\d+)",
        r"(?i)\s*d(\d+)$",
    ];

    for pattern in patterns {
        if let Ok(re) = regex_lite::Regex::new(pattern) {
            if let Some(caps) = re.captures(name) {
                if let Some(disc_num) = caps.get(1) {
                    if let Ok(num) = disc_num.as_str().parse::<u8>() {
                        let base_name = re.replace(name, "").trim().to_string();
                        return Some((base_name, num));
                    }
                }
            }
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_clean_rom_name() {
        assert_eq!(
            clean_rom_name("Final Fantasy VII (USA) (Disc 1)"),
            "Final Fantasy VII"
        );
        assert_eq!(clean_rom_name("Chrono_Trigger_(USA)"), "Chrono Trigger");
        assert_eq!(
            clean_rom_name("Legend of Zelda, The [USA] [Rev 1]"),
            "Legend of Zelda, The"
        );
    }

    #[test]
    fn test_clean_rom_name_preserves_core_title() {
        assert_eq!(clean_rom_name("Super Mario Bros"), "Super Mario Bros");
        assert_eq!(clean_rom_name("Sonic the Hedgehog"), "Sonic the Hedgehog");
    }

    #[test]
    fn test_clean_rom_name_removes_region_codes() {
        assert_eq!(clean_rom_name("Game (USA)"), "Game");
        assert_eq!(clean_rom_name("Game (Europe)"), "Game");
        assert_eq!(clean_rom_name("Game (Japan)"), "Game");
        assert_eq!(clean_rom_name("Game (U) (E)"), "Game");
    }

    #[test]
    fn test_clean_rom_name_removes_revision_info() {
        assert_eq!(clean_rom_name("Game [Rev A]"), "Game");
        assert_eq!(clean_rom_name("Game [!]"), "Game");
        assert_eq!(clean_rom_name("Game [h1]"), "Game");
    }

    #[test]
    fn test_clean_rom_name_removes_curly_braces() {
        assert_eq!(clean_rom_name("Game {pirate}"), "Game");
    }

    #[test]
    fn test_clean_rom_name_normalizes_whitespace() {
        assert_eq!(
            clean_rom_name("Game   Extra    Spaces"),
            "Game Extra Spaces"
        );
        assert_eq!(clean_rom_name("  Leading Trailing  "), "Leading Trailing");
    }

    #[test]
    fn test_clean_rom_name_replaces_underscores() {
        assert_eq!(clean_rom_name("My_Cool_Game"), "My Cool Game");
        assert_eq!(clean_rom_name("Game_Name_(USA)"), "Game Name");
    }

    #[test]
    fn test_detect_multi_disc() {
        let (name, disc) = detect_multi_disc("Final Fantasy VII (Disc 1)").unwrap();
        assert_eq!(name, "Final Fantasy VII");
        assert_eq!(disc, 1);

        let (name, disc) = detect_multi_disc("Metal Gear Solid CD2").unwrap();
        assert_eq!(name, "Metal Gear Solid");
        assert_eq!(disc, 2);
    }

    #[test]
    fn test_detect_multi_disc_various_formats() {
        // (Disc X)
        let (name, disc) = detect_multi_disc("Game (Disc 3)").unwrap();
        assert_eq!(name, "Game");
        assert_eq!(disc, 3);

        // (CD X)
        let (name, disc) = detect_multi_disc("Game (CD 2)").unwrap();
        assert_eq!(name, "Game");
        assert_eq!(disc, 2);

        // Disc X (no parens)
        let (name, disc) = detect_multi_disc("Game Disc 4").unwrap();
        assert_eq!(name, "Game");
        assert_eq!(disc, 4);
    }

    #[test]
    fn test_detect_multi_disc_case_insensitive() {
        let (_, disc) = detect_multi_disc("Game (DISC 1)").unwrap();
        assert_eq!(disc, 1);

        let (_, disc) = detect_multi_disc("Game (disc 2)").unwrap();
        assert_eq!(disc, 2);
    }

    #[test]
    fn test_detect_multi_disc_returns_none_for_single() {
        assert!(detect_multi_disc("Regular Game Name").is_none());
        assert!(detect_multi_disc("Game (USA)").is_none());
    }

    #[test]
    fn test_detect_multi_disc_d_suffix() {
        let result = detect_multi_disc("Final Fantasy VIII D2");
        assert!(result.is_some());
        let (name, disc) = result.unwrap();
        assert_eq!(disc, 2);
        assert!(name.contains("Final Fantasy VIII"));
    }

    #[test]
    fn test_rom_scanner_new() {
        let platforms = vec![Platform::new(
            "snes",
            "Super Nintendo",
            vec![".sfc", ".smc"],
        )];
        let scanner = RomScanner::new(platforms);
        assert_eq!(scanner.platforms.len(), 1);
    }
}
