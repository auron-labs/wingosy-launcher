use anyhow::{Context, Result};
use directories::ProjectDirs;
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AppConfig {
    pub romm: RomMConfig,
    pub library: LibraryConfig,
    pub display: DisplayConfig,
    pub emulators: EmulatorPaths,
    /// Immersive-mode audio: UI sound volume, ambient BGM (Argosy-style).
    #[serde(default)]
    pub audio: AudioConfig,
    /// Auto-update preferences (GitHub release check).
    #[serde(default)]
    pub updater: UpdaterConfig,
}

/// Background music and UI sound levels for Immersive mode (see Argosy launcher sounds).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioConfig {
    /// 0–100; scales bundled Argosy UI clips.
    #[serde(default = "default_ui_sounds_volume")]
    pub ui_sounds_volume: u8,
    #[serde(default)]
    pub ambient_enabled: bool,
    /// 0–100
    #[serde(default = "default_ambient_volume")]
    pub ambient_volume: u8,
    /// Audio file path, or directory when `ambient_is_folder` is true.
    pub ambient_path: Option<String>,
    #[serde(default)]
    pub ambient_is_folder: bool,
    #[serde(default)]
    pub ambient_shuffle: bool,
}

fn default_ui_sounds_volume() -> u8 {
    80
}

fn default_ambient_volume() -> u8 {
    35
}

const CONTROLLER_DEADZONE_DEFAULT: f32 = 0.35;
const CONTROLLER_DEADZONE_MIN: f32 = 0.1;
const CONTROLLER_DEADZONE_MAX: f32 = 0.8;

fn default_controller_deadzone() -> f32 {
    CONTROLLER_DEADZONE_DEFAULT
}

fn normalize_controller_deadzone(value: f32) -> f32 {
    if !value.is_finite() {
        return CONTROLLER_DEADZONE_DEFAULT;
    }
    value.clamp(CONTROLLER_DEADZONE_MIN, CONTROLLER_DEADZONE_MAX)
}

fn deserialize_controller_deadzone<'de, D>(deserializer: D) -> std::result::Result<f32, D::Error>
where
    D: Deserializer<'de>,
{
    Ok(normalize_controller_deadzone(f32::deserialize(
        deserializer,
    )?))
}

fn serialize_controller_deadzone<S>(
    value: &f32,
    serializer: S,
) -> std::result::Result<S::Ok, S::Error>
where
    S: Serializer,
{
    normalize_controller_deadzone(*value).serialize(serializer)
}

impl Default for AudioConfig {
    fn default() -> Self {
        Self {
            ui_sounds_volume: default_ui_sounds_volume(),
            ambient_enabled: false,
            ambient_volume: default_ambient_volume(),
            ambient_path: None,
            ambient_is_folder: false,
            ambient_shuffle: false,
        }
    }
}

/// Which GitHub release track to compare against ([`UpdaterConfig::channel`]).
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "lowercase")]
pub enum UpdateChannel {
    #[default]
    Stable,
    Beta,
    Nightly,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdaterConfig {
    /// Compare against the selected channel when the app starts (desktop shell).
    #[serde(default = "default_true")]
    pub check_on_startup: bool,
    /// When true, pre-release channels (beta / nightly) are available and future builds may install updates automatically.
    #[serde(default)]
    pub auto_update_enabled: bool,
    #[serde(default)]
    pub channel: UpdateChannel,
}

fn default_true() -> bool {
    true
}

impl Default for UpdaterConfig {
    fn default() -> Self {
        Self {
            check_on_startup: true,
            auto_update_enabled: false,
            channel: UpdateChannel::Stable,
        }
    }
}

impl AppConfig {
    pub fn load() -> Result<Self> {
        let config_path = Self::config_path()?;
        tracing::debug!("[Config] Loading config from {:?}", config_path);

        if config_path.exists() {
            let contents = std::fs::read_to_string(&config_path)
                .context("Failed to read config file")?;
            let mut config: Self = toml::from_str(&contents).context("Failed to parse config file")?;
            config.normalize_retroarch_identity();
            tracing::info!("[Config] Loaded configuration successfully");
            tracing::debug!("[Config] RomM server: {:?}", config.romm.server_url);
            tracing::debug!("[Config] ROMs directory: {:?}", config.library.roms_directory);
            Ok(config)
        } else {
            tracing::info!("[Config] No config file found, using defaults");
            Ok(Self::default())
        }
    }

    pub fn save(&self) -> Result<()> {
        if self
            .romm
            .auth_token
            .as_deref()
            .is_some_and(|token| !token.is_empty())
        {
            anyhow::bail!(
                "Refusing to save config with a legacy RomM access token; reconnect required"
            );
        }

        let config_path = Self::config_path()?;
        tracing::debug!("[Config] Saving config to {:?}", config_path);

        if let Some(parent) = config_path.parent() {
            std::fs::create_dir_all(parent).context("Failed to create config directory")?;
        }

        let contents = toml::to_string_pretty(self).context("Failed to serialize config")?;
        std::fs::write(&config_path, contents).context("Failed to write config file")?;
        
        tracing::info!("[Config] Configuration saved successfully");
        Ok(())
    }

    pub fn config_path() -> Result<PathBuf> {
        let proj_dirs = ProjectDirs::from("com", "wingosy", "launcher")
            .context("Failed to determine config directory")?;

        Ok(proj_dirs.config_dir().join("config.toml"))
    }

    pub fn data_dir() -> Result<PathBuf> {
        let proj_dirs = ProjectDirs::from("com", "wingosy", "launcher")
            .context("Failed to determine data directory")?;

        Ok(proj_dirs.data_dir().to_path_buf())
    }

    pub fn cache_dir() -> Result<PathBuf> {
        let proj_dirs = ProjectDirs::from("com", "wingosy", "launcher")
            .context("Failed to determine cache directory")?;

        Ok(proj_dirs.cache_dir().to_path_buf())
    }

    pub fn covers_dir() -> Result<PathBuf> {
        Ok(Self::cache_dir()?.join("covers"))
    }

    pub fn saves_dir() -> Result<PathBuf> {
        Ok(Self::data_dir()?.join("saves"))
    }

    pub fn downloads_dir() -> Result<PathBuf> {
        Ok(Self::data_dir()?.join("downloads"))
    }

    pub fn emulators_dir() -> Result<PathBuf> {
        Ok(Self::data_dir()?.join("emulators"))
    }

    pub fn logs_dir() -> Result<PathBuf> {
        Ok(Self::data_dir()?.join("logs"))
    }

    pub fn roms_dir(&self) -> PathBuf {
        self.library.roms_directory.clone().unwrap_or_else(|| {
            Self::data_dir()
                .map(|d| d.join("roms"))
                .unwrap_or_else(|_| PathBuf::from("roms"))
        })
    }

    pub fn bios_dir(&self) -> PathBuf {
        self.library.bios_directory.clone().unwrap_or_else(|| {
            Self::data_dir()
                .map(|d| d.join("bios"))
                .unwrap_or_else(|_| PathBuf::from("bios"))
        })
    }

    fn normalize_retroarch_identity(&mut self) {
        let managed_root = Self::emulators_dir().ok();
        let was_managed = self.emulators.retroarch_install_kind == RetroArchInstallKind::Managed;
        let had_retroarch_path = self.emulators.retroarch.is_some();
        let is_managed_identity = self.emulators.retroarch_install_kind == RetroArchInstallKind::Managed
            && self.emulators.retroarch_manifest_version.as_deref()
                == Some(crate::emulators::retroarch::MANIFEST_VERSION)
            && self
            .emulators
            .retroarch
            .as_ref()
            .is_some_and(|path| {
                path.is_file()
                    && managed_root
                        .as_ref()
                        .is_some_and(|root| path.starts_with(root))
                    && crate::emulators::retroarch::managed_manifest_marker_matches(path)
            });
        if !is_managed_identity {
            self.emulators.retroarch_install_kind = RetroArchInstallKind::External;
            self.emulators.retroarch_manifest_version = None;
            if was_managed || !had_retroarch_path {
                self.emulators.retroarch_use_beta_profile = false;
            }
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RomMConfig {
    pub server_url: Option<String>,
    /// Authentication path used for the saved session (`pairing` or `token`).
    #[serde(default)]
    pub auth_method: Option<String>,
    pub username: Option<String>,
    pub password: Option<String>,
    /// Legacy access token accepted on read; callers must clear it before saving.
    pub auth_token: Option<String>,
    pub auto_sync: bool,
    pub sync_saves: bool,
    /// Stable device id for RomM 4.7+ save sync (auto-generated if empty).
    #[serde(default)]
    pub device_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LibraryConfig {
    pub roms_directory: Option<PathBuf>,
    /// BIOS files downloaded from RomM. Defaults to the Wingosy data directory.
    #[serde(default)]
    pub bios_directory: Option<PathBuf>,
    pub scan_subdirectories: bool,
    pub auto_extract_archives: bool,
    pub show_hidden_games: bool,
}

impl Default for LibraryConfig {
    fn default() -> Self {
        Self {
            roms_directory: None,
            bios_directory: None,
            scan_subdirectories: true,
            auto_extract_archives: true,
            show_hidden_games: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DisplayConfig {
    pub theme: Theme,
    pub grid_columns: u8,
    pub show_platform_icons: bool,
    pub show_play_time: bool,
    pub cover_aspect_ratio: CoverAspectRatio,
    /// UI Mode: false = desktop (default), true = Immersive mode (large-type / controller UI).
    /// Stored as `big_picture` for backward compatibility with existing configs.
    #[serde(default)]
    pub big_picture: bool,
    /// Request OS fullscreen while Immersive mode is active.
    #[serde(default)]
    pub fullscreen: bool,
    /// Argosy-style UI feedback sounds (bundled assets from upstream `argosy-launcher` `res/raw`).
    #[serde(default)]
    pub ui_sounds_enabled: bool,
    /// When true, RetroAchievements integration is enabled app-wide (when implemented).
    #[serde(default)]
    pub retroachievements_enabled: bool,
    /// Stick threshold used by Immersive controller navigation.
    #[serde(
        default = "default_controller_deadzone",
        deserialize_with = "deserialize_controller_deadzone",
        serialize_with = "serialize_controller_deadzone"
    )]
    pub controller_deadzone: f32,
}

impl Default for DisplayConfig {
    fn default() -> Self {
        Self {
            theme: Theme::Dark,
            grid_columns: 5,
            show_platform_icons: true,
            show_play_time: true,
            cover_aspect_ratio: CoverAspectRatio::Vertical,
            big_picture: false,
            fullscreen: false,
            ui_sounds_enabled: false,
            retroachievements_enabled: false,
            controller_deadzone: default_controller_deadzone(),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub enum Theme {
    Light,
    #[default]
    Dark,
    System,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub enum CoverAspectRatio {
    #[default]
    Vertical,
    Square,
    Horizontal,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct EmulatorPaths {
    pub retroarch: Option<PathBuf>,
    #[serde(default)]
    pub retroarch_install_kind: RetroArchInstallKind,
    #[serde(default)]
    pub retroarch_manifest_version: Option<String>,
    #[serde(default)]
    pub retroarch_use_beta_profile: bool,
    pub dolphin: Option<PathBuf>,
    pub pcsx2: Option<PathBuf>,
    pub rpcs3: Option<PathBuf>,
    pub ppsspp: Option<PathBuf>,
    pub duckstation: Option<PathBuf>,
    pub cemu: Option<PathBuf>,
    pub eden: Option<PathBuf>,
    /// Override Eden `nand/user/save` directory (portable install or custom path).
    #[serde(default)]
    pub eden_save_root: Option<PathBuf>,
    pub citra: Option<PathBuf>,
    pub melonds: Option<PathBuf>,
    pub mgba: Option<PathBuf>,
    pub flycast: Option<PathBuf>,
    pub xemu: Option<PathBuf>,
    pub xenia: Option<PathBuf>,
    pub mame: Option<PathBuf>,
    /// Per-platform default emulator ID (e.g., "gba" -> "mgba")
    #[serde(default)]
    pub platform_defaults: std::collections::HashMap<String, String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum RetroArchInstallKind {
    #[default]
    External,
    Managed,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_app_config_default() {
        let config = AppConfig::default();
        assert!(config.romm.server_url.is_none());
        assert!(config.library.scan_subdirectories);
        assert_eq!(config.display.theme, Theme::Dark);
        assert_eq!(config.display.grid_columns, 5);
        assert_eq!(config.audio.ui_sounds_volume, 80);
        assert!(!config.audio.ambient_enabled);
        assert!(config.updater.check_on_startup);
        assert!(!config.updater.auto_update_enabled);
        assert_eq!(config.updater.channel, UpdateChannel::Stable);
        assert_eq!(config.emulators.retroarch_install_kind, RetroArchInstallKind::External);
        assert!(config.emulators.retroarch_manifest_version.is_none());
        assert!(!config.emulators.retroarch_use_beta_profile);
    }

    #[test]
    fn test_theme_default_is_dark() {
        let theme = Theme::default();
        assert_eq!(theme, Theme::Dark);
    }

    #[test]
    fn test_cover_aspect_ratio_default() {
        let ratio = CoverAspectRatio::default();
        assert_eq!(ratio, CoverAspectRatio::Vertical);
    }

    #[test]
    fn test_library_config_defaults() {
        let lib = LibraryConfig::default();
        assert!(lib.roms_directory.is_none());
        assert!(lib.scan_subdirectories);
        assert!(lib.auto_extract_archives);
        assert!(!lib.show_hidden_games);
    }

    #[test]
    fn test_display_config_defaults() {
        let display = DisplayConfig::default();
        assert_eq!(display.theme, Theme::Dark);
        assert_eq!(display.grid_columns, 5);
        assert!(display.show_platform_icons);
        assert!(display.show_play_time);
        assert_eq!(display.cover_aspect_ratio, CoverAspectRatio::Vertical);
        assert!(!display.big_picture);
        assert!(!display.fullscreen);
        assert!(!display.ui_sounds_enabled);
        assert!(!display.retroachievements_enabled);
        assert_eq!(display.controller_deadzone, 0.35);
    }

    #[test]
    fn test_audio_config_defaults() {
        let a = AudioConfig::default();
        assert_eq!(a.ui_sounds_volume, 80);
        assert!(!a.ambient_enabled);
        assert_eq!(a.ambient_volume, 35);
        assert!(a.ambient_path.is_none());
        assert!(!a.ambient_is_folder);
        assert!(!a.ambient_shuffle);
    }

    #[test]
    fn test_romm_config_defaults() {
        let romm = RomMConfig::default();
        assert!(romm.server_url.is_none());
        assert!(romm.username.is_none());
        assert!(romm.password.is_none());
        assert!(romm.auth_token.is_none());
        assert!(!romm.auto_sync);
        assert!(!romm.sync_saves);
    }

    #[test]
    fn test_emulator_paths_default() {
        let paths = EmulatorPaths::default();
        assert!(paths.retroarch.is_none());
        assert!(paths.dolphin.is_none());
        assert!(paths.pcsx2.is_none());
        assert!(paths.eden.is_none());
    }

    #[test]
    fn external_retroarch_path_cannot_keep_managed_identity() {
        let mut config = AppConfig::default();
        config.emulators.retroarch = Some(PathBuf::from("C:/Games/RetroArch/retroarch.exe"));
        config.emulators.retroarch_install_kind = RetroArchInstallKind::Managed;
        config.emulators.retroarch_manifest_version = Some("old-manifest".to_string());
        config.emulators.retroarch_use_beta_profile = true;

        config.normalize_retroarch_identity();

        assert_eq!(config.emulators.retroarch_install_kind, RetroArchInstallKind::External);
        assert!(config.emulators.retroarch_manifest_version.is_none());
        assert!(!config.emulators.retroarch_use_beta_profile);
    }

    #[test]
    fn incomplete_managed_retroarch_install_cannot_keep_managed_identity() {
        let mut config = AppConfig::default();
        config.emulators.retroarch = Some(
            AppConfig::emulators_dir()
                .expect("Wingosy emulators directory should be available")
                .join("incomplete-retroarch-install")
                .join("retroarch.exe"),
        );
        config.emulators.retroarch_install_kind = RetroArchInstallKind::Managed;
        config.emulators.retroarch_manifest_version =
            Some(crate::emulators::retroarch::MANIFEST_VERSION.to_string());
        config.emulators.retroarch_use_beta_profile = true;

        config.normalize_retroarch_identity();

        assert_eq!(config.emulators.retroarch_install_kind, RetroArchInstallKind::External);
        assert!(config.emulators.retroarch_manifest_version.is_none());
        assert!(!config.emulators.retroarch_use_beta_profile);
    }

    #[test]
    fn external_retroarch_opt_in_survives_normalization() {
        let mut config = AppConfig::default();
        config.emulators.retroarch = Some(PathBuf::from("C:/Games/RetroArch/retroarch.exe"));
        config.emulators.retroarch_use_beta_profile = true;

        config.normalize_retroarch_identity();

        assert_eq!(config.emulators.retroarch_install_kind, RetroArchInstallKind::External);
        assert!(config.emulators.retroarch_manifest_version.is_none());
        assert!(config.emulators.retroarch_use_beta_profile);
    }

    #[test]
    fn test_app_config_roms_dir_with_config() {
        let mut config = AppConfig::default();
        config.library.roms_directory = Some(PathBuf::from("C:/Games/ROMs"));
        
        assert_eq!(config.roms_dir(), PathBuf::from("C:/Games/ROMs"));
    }

    #[test]
    fn test_app_config_roms_dir_default() {
        let config = AppConfig::default();
        // Should not panic and return some path
        let roms_dir = config.roms_dir();
        assert!(!roms_dir.as_os_str().is_empty());
    }

    #[test]
    fn test_config_serialization() {
        let config = AppConfig::default();
        let toml_str = toml::to_string(&config).expect("Should serialize");
        assert!(toml_str.contains("[romm]"));
        assert!(toml_str.contains("[library]"));
        assert!(toml_str.contains("[display]"));
        assert!(toml_str.contains("[audio]"));
    }

    #[test]
    fn legacy_auth_token_deserializes_and_clears_before_serialization() {
        let serialized = toml::to_string(&AppConfig::default()).expect("Should serialize");
        let legacy = serialized.replace(
            "[romm]\n",
            "[romm]\nauth_token = \"synthetic-access-marker\"\n",
        );
        let mut restored: AppConfig =
            toml::from_str(&legacy).expect("Should deserialize legacy config");
        assert_eq!(
            restored.romm.auth_token.as_deref(),
            Some("synthetic-access-marker")
        );

        restored.romm.auth_token = None;
        let cleared = toml::to_string(&restored).expect("Should serialize cleared config");
        assert!(!cleared.contains("auth_token"));
        assert!(!cleared.contains("synthetic-access-marker"));
    }

    #[test]
    fn save_rejects_nonempty_legacy_auth_token() {
        let mut config = AppConfig::default();
        config.romm.auth_token = Some("synthetic-access-marker".to_string());

        let error = config
            .save()
            .expect_err("legacy access token must not be saved");
        assert!(error.to_string().contains("legacy RomM access token"));
    }

    #[test]
    fn test_config_deserialization() {
        let toml_str = r#"
            [romm]
            server_url = "http://localhost:8080"
            auto_sync = true
            sync_saves = false
            
            [library]
            scan_subdirectories = true
            auto_extract_archives = false
            show_hidden_games = true
            
            [display]
            theme = "Dark"
            grid_columns = 6
            show_platform_icons = true
            show_play_time = false
            cover_aspect_ratio = "Square"
            
            [emulators]
        "#;
        
        let config: AppConfig = toml::from_str(toml_str).expect("Should deserialize");
        assert_eq!(config.romm.server_url, Some("http://localhost:8080".to_string()));
        assert!(config.romm.auto_sync);
        assert!(!config.library.auto_extract_archives);
        assert!(config.library.show_hidden_games);
        assert_eq!(config.display.grid_columns, 6);
        assert_eq!(config.display.cover_aspect_ratio, CoverAspectRatio::Square);
        assert!(!config.display.big_picture);
        assert!(!config.display.fullscreen);
    }

    #[test]
    fn test_display_immersive_flags_deserialize() {
        let toml_str = r#"
            [romm]
            auto_sync = false
            sync_saves = false
            [library]
            scan_subdirectories = true
            auto_extract_archives = true
            show_hidden_games = false
            [display]
            theme = "Dark"
            grid_columns = 5
            show_platform_icons = true
            show_play_time = true
            cover_aspect_ratio = "Vertical"
            big_picture = true
            fullscreen = true
            [emulators]
        "#;
        let config: AppConfig = toml::from_str(toml_str).expect("Should deserialize");
        assert!(config.display.big_picture);
        assert!(config.display.fullscreen);
        assert_eq!(config.display.controller_deadzone, 0.35);
    }

    #[test]
    fn controller_deadzone_is_bounded_at_the_config_boundary() {
        let toml_str = r#"
            [romm]
            auto_sync = false
            sync_saves = false
            [library]
            scan_subdirectories = true
            auto_extract_archives = true
            show_hidden_games = false
            [display]
            theme = "Dark"
            grid_columns = 5
            show_platform_icons = true
            show_play_time = true
            cover_aspect_ratio = "Vertical"
            controller_deadzone = 1.5
            [emulators]
        "#;
        let config: AppConfig = toml::from_str(toml_str).expect("Should deserialize");
        assert_eq!(config.display.controller_deadzone, 0.8);

        let mut config = AppConfig::default();
        config.display.controller_deadzone = -0.2;
        let serialized = toml::to_string(&config).expect("Should serialize");
        assert!(serialized.contains("controller_deadzone = 0.1"));
    }

    #[test]
    fn test_theme_equality() {
        assert_eq!(Theme::Dark, Theme::Dark);
        assert_eq!(Theme::Light, Theme::Light);
        assert_ne!(Theme::Dark, Theme::Light);
        assert_ne!(Theme::System, Theme::Dark);
    }

    #[test]
    fn test_cover_aspect_ratio_equality() {
        assert_eq!(CoverAspectRatio::Vertical, CoverAspectRatio::Vertical);
        assert_ne!(CoverAspectRatio::Vertical, CoverAspectRatio::Square);
        assert_ne!(CoverAspectRatio::Square, CoverAspectRatio::Horizontal);
    }

    #[test]
    fn test_config_path_returns_path() {
        let path = AppConfig::config_path();
        assert!(path.is_ok());
        let path = path.unwrap();
        assert!(path.to_string_lossy().contains("config.toml"));
    }

    #[test]
    fn test_data_dir_returns_path() {
        let path = AppConfig::data_dir();
        assert!(path.is_ok());
    }

    #[test]
    fn test_cache_dir_returns_path() {
        let path = AppConfig::cache_dir();
        assert!(path.is_ok());
    }

    #[test]
    fn test_covers_dir_returns_path() {
        let path = AppConfig::covers_dir();
        assert!(path.is_ok());
        assert!(path.unwrap().to_string_lossy().contains("covers"));
    }

    #[test]
    fn test_saves_dir_returns_path() {
        let path = AppConfig::saves_dir();
        assert!(path.is_ok());
        assert!(path.unwrap().to_string_lossy().contains("saves"));
    }

    #[test]
    fn test_emulators_dir_returns_path() {
        let path = AppConfig::emulators_dir();
        assert!(path.is_ok());
        assert!(path.unwrap().to_string_lossy().contains("emulators"));
    }
}
