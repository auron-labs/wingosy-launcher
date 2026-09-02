use anyhow::{Context, Result};
use sha2::{Digest, Sha256};
use std::fmt::Write as _;
use std::fs::OpenOptions;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::config::{AppConfig, RetroArchInstallKind};

pub const RETROARCH_VERSION: &str = "1.19.1";
pub const MANIFEST_VERSION: &str = "beta-2026-08-23";
pub const RETROARCH_EXECUTABLE_SHA256: &str = "738ca659d2360cedbc62bab7b53c6e9bb20c7d92dfe3de743fa4f3b1fa218e7b";
const RETROARCH_CORES_URL: &str =
    "https://buildbot.libretro.com/stable/1.19.1/windows/x86_64/RetroArch_cores.7z";
const RETROARCH_CORES_ARCHIVE_SHA256: &str =
    "4384854038d3e2a85cae6563e3a78ba7a8c0696fc6e1f9f4a0e6b8044cef8d92";

#[derive(Debug, Clone, Copy)]
pub struct Artifact {
    pub filename: &'static str,
    pub url: &'static str,
    pub format: &'static str,
    pub sha256: &'static str,
}

#[derive(Debug, Clone, Copy)]
pub struct CoreArtifact {
    pub platform_id: &'static str,
    pub filename: &'static str,
    /// All certified core DLLs are members of this one immutable bundle.
    pub archive_url: &'static str,
    pub archive_sha256: &'static str,
    pub installed_sha256: &'static str,
}

#[derive(Debug, Clone, Copy)]
pub(crate) struct ManagedCoreManifest<'a> {
    executable_sha256: &'a str,
    cores: &'a [CoreArtifact],
}

pub fn retroarch_artifact() -> Artifact {
    Artifact {
        filename: "RetroArch.7z",
        url: "https://buildbot.libretro.com/stable/1.19.1/windows/x86_64/RetroArch.7z",
        format: "7z",
        sha256: "49b13c10a8962c82b8dbffb6524f49d824a264c58e6d6ec4f27934d110168600",
    }
}

pub fn retroarch_cores_artifact() -> Artifact {
    Artifact {
        filename: "RetroArch_cores.7z",
        url: RETROARCH_CORES_URL,
        format: "7z",
        sha256: RETROARCH_CORES_ARCHIVE_SHA256,
    }
}

pub fn core_artifacts() -> &'static [CoreArtifact] {
    const CORES: &[CoreArtifact] = &[
        CoreArtifact {
            platform_id: "nes",
            filename: "fceumm_libretro.dll",
            archive_url: RETROARCH_CORES_URL,
            archive_sha256: RETROARCH_CORES_ARCHIVE_SHA256,
            installed_sha256: "2352c2592986fb3155c36dd316a20886f7fbaed0434130c6d464c8ffec9e08b3",
        },
        CoreArtifact {
            platform_id: "snes",
            filename: "snes9x_libretro.dll",
            archive_url: RETROARCH_CORES_URL,
            archive_sha256: RETROARCH_CORES_ARCHIVE_SHA256,
            installed_sha256: "1d7d68f6568f74e8de0599af718d9fce8e66b656d8b77594cd37b7ee2465cffd",
        },
        CoreArtifact {
            platform_id: "gb",
            filename: "gambatte_libretro.dll",
            archive_url: RETROARCH_CORES_URL,
            archive_sha256: RETROARCH_CORES_ARCHIVE_SHA256,
            installed_sha256: "588692d07db0c7fd28703326fe14b9b58cfaee19b88eec21952a39d8d7730fe2",
        },
        CoreArtifact {
            platform_id: "gbc",
            filename: "gambatte_libretro.dll",
            archive_url: RETROARCH_CORES_URL,
            archive_sha256: RETROARCH_CORES_ARCHIVE_SHA256,
            installed_sha256: "588692d07db0c7fd28703326fe14b9b58cfaee19b88eec21952a39d8d7730fe2",
        },
        CoreArtifact {
            platform_id: "gba",
            filename: "mgba_libretro.dll",
            archive_url: RETROARCH_CORES_URL,
            archive_sha256: RETROARCH_CORES_ARCHIVE_SHA256,
            installed_sha256: "1de88f427faf79353837a547070f9b74bde8454cb3f27f41a8f7ed4540e7d324",
        },
        CoreArtifact {
            platform_id: "genesis",
            filename: "genesis_plus_gx_libretro.dll",
            archive_url: RETROARCH_CORES_URL,
            archive_sha256: RETROARCH_CORES_ARCHIVE_SHA256,
            installed_sha256: "a5648038ee099670b7225d9acdb4a5afb77c2215d5038e70ae995877bdbed504",
        },
    ];

    CORES
}

pub fn core_artifact_for_filename(filename: &str) -> Option<CoreArtifact> {
    let filename = filename.trim_end_matches(".zip");
    core_artifacts()
        .iter()
        .find(|core| core.filename == filename)
        .copied()
}

pub fn core_artifact_for_platform(platform_id: &str) -> Option<CoreArtifact> {
    core_artifacts()
        .iter()
        .find(|core| core.platform_id == platform_id)
        .copied()
}

pub(crate) fn certified_managed_core_manifest() -> ManagedCoreManifest<'static> {
    ManagedCoreManifest {
        executable_sha256: RETROARCH_EXECUTABLE_SHA256,
        cores: core_artifacts(),
    }
}

pub fn profile_dir() -> Result<PathBuf> {
    Ok(AppConfig::data_dir()?.join("retroarch").join("profile"))
}

pub fn delta_path() -> Result<PathBuf> {
    Ok(profile_dir()?.join("wingosy-retroarch-v1.cfg"))
}

pub fn managed_delta_path() -> Result<PathBuf> {
    Ok(profile_dir()?.join("wingosy-retroarch-managed-v1.cfg"))
}

pub fn ensure_profile() -> Result<PathBuf> {
    let root = profile_dir()?;
    ensure_profile_at(&root)
}

pub fn ensure_profile_at(root: &Path) -> Result<PathBuf> {
    std::fs::create_dir_all(root)
        .context("Failed to create Wingosy RetroArch profile directory")?;

    let config_path = root.join("wingosy-retroarch-v1.cfg");
    if !config_path.exists() {
        write_profile_atomically(&config_path, &profile_contents())?;
    }

    Ok(config_path)
}

pub fn repair_profile_at(root: &Path) -> Result<Option<PathBuf>> {
    std::fs::create_dir_all(root)
        .context("Failed to create Wingosy RetroArch profile directory")?;
    let config_path = root.join("wingosy-retroarch-v1.cfg");
    let backup = backup_profile_at(root, &config_path)?;
    write_profile_atomically(&config_path, &profile_contents())?;
    Ok(backup)
}

pub fn ensure_managed_profile(retroarch_executable: &Path) -> Result<PathBuf> {
    let root = profile_dir()?;
    std::fs::create_dir_all(&root)
        .context("Failed to create Wingosy RetroArch profile directory")?;
    let config_path = managed_delta_path()?;
    let contents = managed_profile_contents(retroarch_executable)?;
    if std::fs::read_to_string(&config_path).ok().as_deref() != Some(contents.as_str()) {
        write_profile_atomically(&config_path, &contents)?;
    }
    Ok(config_path)
}

pub fn repair_managed_profile(retroarch_executable: &Path) -> Result<Option<PathBuf>> {
    let root = profile_dir()?;
    std::fs::create_dir_all(&root)
        .context("Failed to create Wingosy RetroArch profile directory")?;
    let config_path = managed_delta_path()?;
    let backup = backup_profile_at(&root, &config_path)?;
    let contents = managed_profile_contents(retroarch_executable)?;
    write_profile_atomically(&config_path, &contents)?;
    Ok(backup)
}

pub fn reset_profile() -> Result<Option<PathBuf>> {
    let root = profile_dir()?;
    reset_profile_at(&root)
}

pub fn reset_profile_at(root: &Path) -> Result<Option<PathBuf>> {
    let config_path = root.join("wingosy-retroarch-v1.cfg");
    if !config_path.is_file() {
        return Ok(None);
    }

    let backup = backup_profile_at(root, &config_path)?;
    std::fs::remove_file(config_path).context("Failed to remove Wingosy RetroArch profile")?;
    Ok(backup)
}

fn backup_profile_at(root: &Path, config_path: &Path) -> Result<Option<PathBuf>> {
    if !config_path.is_file() {
        return Ok(None);
    }

    let backups = root.join("backups");
    std::fs::create_dir_all(&backups)
        .context("Failed to create RetroArch profile backup directory")?;
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .context("System clock is before Unix epoch")?
        .as_nanos();
    let backup_path = backups.join(format!("wingosy-retroarch-v1-{timestamp}.cfg"));
    std::fs::copy(config_path, &backup_path)
        .context("Failed to back up Wingosy RetroArch profile")?;
    Ok(Some(backup_path))
}

fn write_profile_atomically(config_path: &Path, contents: &str) -> Result<()> {
    let parent = config_path
        .parent()
        .context("Wingosy RetroArch profile must have a parent directory")?;
    let filename = config_path
        .file_name()
        .and_then(|name| name.to_str())
        .context("Wingosy RetroArch profile must have a file name")?;
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .context("System clock is before Unix epoch")?
        .as_nanos();
    let temporary = parent.join(format!(".{filename}-{nonce}-{}.tmp", std::process::id()));

    let result = (|| {
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temporary)
            .context("Failed to create temporary Wingosy RetroArch profile")?;
        file.write_all(contents.as_bytes())
            .context("Failed to write temporary Wingosy RetroArch profile")?;
        file.sync_all()
            .context("Failed to flush temporary Wingosy RetroArch profile")?;
        drop(file);

        #[cfg(windows)]
        if config_path.exists() {
            std::fs::remove_file(config_path)
                .context("Failed to replace Wingosy RetroArch profile")?;
        }
        std::fs::rename(&temporary, config_path)
            .context("Failed to replace Wingosy RetroArch profile")?;
        Ok(())
    })();

    if result.is_err() {
        std::fs::remove_file(&temporary).ok();
    }
    result
}

pub fn manifest_identity_matches(config: &AppConfig) -> bool {
    config.emulators.retroarch_install_kind == RetroArchInstallKind::Managed
        && config.emulators.retroarch_manifest_version.as_deref() == Some(MANIFEST_VERSION)
}

pub fn manifest_marker_path(retroarch_executable: &Path) -> Option<PathBuf> {
    retroarch_executable
        .parent()
        .map(|parent| parent.join("wingosy-retroarch-manifest.txt"))
}

pub fn write_manifest_marker(retroarch_executable: &Path) -> Result<()> {
    let marker = manifest_marker_path(retroarch_executable)
        .context("RetroArch executable must have a parent directory")?;
    std::fs::write(
        marker,
        format!("retroarch_version={RETROARCH_VERSION}\nmanifest_version={MANIFEST_VERSION}\n"),
    )
    .context("Failed to record RetroArch manifest identity")
}

pub fn managed_manifest_marker_matches(retroarch_executable: &Path) -> bool {
    manifest_marker_path(retroarch_executable)
        .and_then(|path| std::fs::read_to_string(path).ok())
        .map(|contents| {
            contents
                .lines()
                .any(|line| line == format!("retroarch_version={RETROARCH_VERSION}"))
                && contents
                    .lines()
                    .any(|line| line == format!("manifest_version={MANIFEST_VERSION}"))
        })
        .unwrap_or(false)
}

pub fn managed_profile_enabled(config: &AppConfig, retroarch_executable: &Path) -> bool {
    manifest_identity_matches(config) && managed_manifest_marker_matches(retroarch_executable)
}

pub fn managed_install_is_ready(config: &AppConfig, retroarch_executable: &Path) -> bool {
    validate_managed_install(config, retroarch_executable).is_ok()
}

pub fn validate_managed_install(config: &AppConfig, retroarch_executable: &Path) -> Result<()> {
    validate_managed_install_identity(config, retroarch_executable)?;
    validate_managed_artifacts(retroarch_executable)
}

pub fn validate_managed_install_identity(
    config: &AppConfig,
    retroarch_executable: &Path,
) -> Result<()> {
    validate_managed_install_identity_with_hash(
        config,
        retroarch_executable,
        RETROARCH_EXECUTABLE_SHA256,
    )
}

fn validate_managed_install_identity_with_hash(
    config: &AppConfig,
    retroarch_executable: &Path,
    executable_sha256: &str,
) -> Result<()> {
    if !manifest_identity_matches(config) {
        anyhow::bail!("RetroArch is not a Wingosy-managed installation");
    }
    if !managed_manifest_marker_matches(retroarch_executable) {
        anyhow::bail!("The Wingosy RetroArch installation marker is missing or invalid");
    }
    verify_sha256(retroarch_executable, executable_sha256)
        .context("The Wingosy RetroArch executable could not be verified")
}

pub fn validate_managed_artifacts(retroarch_executable: &Path) -> Result<()> {
    if !retroarch_executable.is_file() {
        anyhow::bail!("Managed RetroArch executable was not found");
    }
    let cores_dir = retroarch_executable
        .parent()
        .context("RetroArch executable must have a parent directory")?
        .join("cores");
    for filename in certified_core_filenames() {
        let artifact = core_artifacts()
            .iter()
            .find(|artifact| artifact.filename == *filename)
            .context("A required RetroArch core is missing from the Wingosy installation")?;
        verify_sha256(&cores_dir.join(filename), artifact.installed_sha256)
            .with_context(|| format!("RetroArch core {} could not be verified", filename))?;
    }
    if !managed_autoconfig_is_present(retroarch_executable) {
        anyhow::bail!("Managed RetroArch XInput autoconfiguration assets are missing");
    }

    Ok(())
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CoreAvailability {
    Installed,
    Missing,
    Invalid,
}

impl CoreAvailability {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Installed => "installed",
            Self::Missing => "missing",
            Self::Invalid => "invalid",
        }
    }
}

pub fn core_availability(
    retroarch_executable: Option<&Path>,
    artifact: &CoreArtifact,
    managed: bool,
) -> CoreAvailability {
    let Some(executable) = retroarch_executable else {
        return CoreAvailability::Missing;
    };
    if !executable.is_file() {
        return CoreAvailability::Missing;
    }
    let Some(root) = executable.parent() else {
        return CoreAvailability::Missing;
    };
    let path = root.join("cores").join(artifact.filename);
    if !path.is_file() {
        return CoreAvailability::Missing;
    }
    if managed && verify_sha256(&path, artifact.installed_sha256).is_err() {
        return CoreAvailability::Invalid;
    }
    CoreAvailability::Installed
}

pub(crate) fn managed_core_path(
    config: &AppConfig,
    retroarch_executable: &Path,
    platform_id: &str,
    manifest: ManagedCoreManifest<'_>,
) -> Result<PathBuf> {
    validate_managed_install_identity_with_hash(
        config,
        retroarch_executable,
        manifest.executable_sha256,
    )
    .context("Wingosy RetroArch installation could not be verified")?;
    let artifact = manifest
        .cores
        .iter()
        .find(|core| core.platform_id == platform_id)
        .copied()
        .with_context(|| format!("No compatible RetroArch core is installed for {platform_id}"))?;
    let path = retroarch_executable
        .parent()
        .context("RetroArch executable must have a parent directory")?
        .join("cores")
        .join(artifact.filename);
    match core_availability(Some(retroarch_executable), &artifact, true) {
        CoreAvailability::Installed => Ok(path),
        CoreAvailability::Missing => anyhow::bail!(
            "RetroArch core {} is missing from the Wingosy installation",
            artifact.filename
        ),
        CoreAvailability::Invalid => anyhow::bail!(
            "RetroArch core {} could not be verified",
            artifact.filename
        ),
    }
}

pub fn promised_core_path(retroarch_executable: &Path, platform_id: &str) -> Result<PathBuf> {
    let artifact = core_artifact_for_platform(platform_id)
        .with_context(|| format!("No compatible RetroArch core is installed for {platform_id}"))?;
    Ok(retroarch_executable
        .parent()
        .context("RetroArch executable must have a parent directory")?
        .join("cores")
        .join(artifact.filename))
}

pub fn managed_core_set_is_present(retroarch_executable: &Path) -> bool {
    let Some(cores_dir) = retroarch_executable.parent().map(|path| path.join("cores")) else {
        return false;
    };

    certified_core_filenames()
        .iter()
        .all(|filename| cores_dir.join(filename).is_file())
}

pub fn certified_core_filenames() -> &'static [&'static str] {
    &[
        "fceumm_libretro.dll",
        "snes9x_libretro.dll",
        "gambatte_libretro.dll",
        "mgba_libretro.dll",
        "genesis_plus_gx_libretro.dll",
    ]
}

pub fn managed_autoconfig_dir(retroarch_executable: &Path) -> Option<PathBuf> {
    retroarch_executable
        .parent()
        .map(|parent| parent.join("autoconfig"))
}

pub fn managed_autoconfig_is_present(retroarch_executable: &Path) -> bool {
    if !retroarch_executable.is_file() {
        return false;
    }
    let Some(xinput_dir) = managed_autoconfig_dir(retroarch_executable)
        .map(|path| path.join("xinput"))
    else {
        return false;
    };
    std::fs::read_dir(xinput_dir)
        .map(|entries| {
            entries.filter_map(|entry| entry.ok()).any(|entry| {
                let path = entry.path();
                entry.file_type().map(|kind| kind.is_file()).unwrap_or(false)
                    && path
                        .extension()
                        .is_some_and(|extension| extension.eq_ignore_ascii_case("cfg"))
                    && std::fs::read_to_string(path)
                        .map(|contents| {
                            contents
                                .lines()
                                .any(|line| line.trim() == r#"input_driver = "xinput""#)
                        })
                        .unwrap_or(false)
            })
        })
        .unwrap_or(false)
}

pub fn temporary_archive_path(filename: &str) -> PathBuf {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or_default();
    std::env::temp_dir().join(format!("wingosy-{nonce}-{}-{filename}", std::process::id()))
}

pub fn verify_sha256(path: &Path, expected: &str) -> Result<()> {
    let mut file = std::fs::File::open(path).context("Failed to open downloaded artifact")?;
    let mut digest = Sha256::new();
    let mut buffer = [0u8; 64 * 1024];
    loop {
        let read = file
            .read(&mut buffer)
            .context("Failed to hash downloaded artifact")?;
        if read == 0 {
            break;
        }
        digest.update(&buffer[..read]);
    }
    let mut actual = String::with_capacity(64);
    for byte in digest.finalize() {
        write!(&mut actual, "{byte:02x}")
            .expect("writing a SHA-256 digest to a String cannot fail");
    }
    if actual != expected {
        anyhow::bail!(
            "SHA-256 mismatch for {}: expected {}, got {}",
            path.display(),
            expected,
            actual
        );
    }
    Ok(())
}

fn profile_contents() -> String {
    "config_save_on_exit = false\ninput_autodetect_enable = true\n".to_string()
}

fn managed_profile_contents(retroarch_executable: &Path) -> Result<String> {
    let autoconfig_dir = managed_autoconfig_dir(retroarch_executable)
        .context("RetroArch executable must have a parent directory")?;
    let autoconfig_dir = autoconfig_dir
        .to_string_lossy()
        .replace('\\', "/")
        .replace('"', "\\\"");
    Ok(format!(
        "config_save_on_exit = false\ninput_autodetect_enable = true\ninput_joypad_driver = \"xinput\"\njoypad_autoconfig_dir = \"{autoconfig_dir}\"\ninput_menu_toggle_gamepad_combo = \"2\"\n"
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn manifest_contains_six_beta_platform_entries() {
        assert_eq!(core_artifacts().len(), 6);
        assert_eq!(
            core_artifacts()
                .iter()
                .map(|core| core.platform_id)
                .collect::<Vec<_>>(),
            vec!["nes", "snes", "gb", "gbc", "gba", "genesis"]
        );
        assert_eq!(
            core_artifacts()
                .iter()
                .map(|core| core.filename)
                .collect::<std::collections::HashSet<_>>()
                .len(),
            5,
            "six promised platforms intentionally resolve to five unique DLLs"
        );
        assert_eq!(
            core_artifacts()
                .iter()
                .filter(|core| core.platform_id == "gb" || core.platform_id == "gbc")
                .map(|core| core.filename)
                .collect::<Vec<_>>(),
            vec!["gambatte_libretro.dll", "gambatte_libretro.dll"],
            "GB and GBC intentionally share gambatte_libretro.dll"
        );
    }

    #[test]
    fn manifest_uses_two_pinned_verified_archives() {
        let retroarch = retroarch_artifact();
        let cores = retroarch_cores_artifact();

        assert_eq!(
            retroarch.url,
            "https://buildbot.libretro.com/stable/1.19.1/windows/x86_64/RetroArch.7z"
        );
        assert_eq!(
            retroarch.sha256,
            "49b13c10a8962c82b8dbffb6524f49d824a264c58e6d6ec4f27934d110168600"
        );
        assert_eq!(
            cores.url,
            "https://buildbot.libretro.com/stable/1.19.1/windows/x86_64/RetroArch_cores.7z"
        );
        assert_eq!(
            cores.sha256,
            "4384854038d3e2a85cae6563e3a78ba7a8c0696fc6e1f9f4a0e6b8044cef8d92"
        );
        assert!(retroarch.sha256.len() == 64 && cores.sha256.len() == 64);
        assert!(core_artifacts()
            .iter()
            .all(|core| core.filename.ends_with("_libretro.dll")));
        assert!(core_artifacts().iter().all(|core| {
            core.archive_url == cores.url
                && core.archive_sha256 == cores.sha256
                && core.installed_sha256.len() == 64
        }));
    }

    #[test]
    fn every_promised_core_records_the_same_pinned_bundle_url_and_its_own_hash() {
        let bundle = retroarch_cores_artifact();

        assert_eq!(core_artifacts().len(), 6);
        assert!(core_artifacts().iter().all(|core| {
            core.archive_url == bundle.url
                && core.archive_sha256 == bundle.sha256
                && !core.archive_url.contains("latest")
                && core.archive_sha256 != core.installed_sha256
                && core.installed_sha256.len() == 64
        }));
    }

    #[test]
    fn managed_manifest_has_no_moving_download_urls() {
        assert!(!retroarch_artifact().url.contains("latest"));
        assert!(!retroarch_cores_artifact().url.contains("latest"));
    }

    #[test]
    fn digest_mismatch_is_rejected() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("artifact.zip");
        std::fs::write(&path, b"not the expected artifact").unwrap();

        let expected = "00".repeat(32);
        let error = verify_sha256(&path, &expected).unwrap_err();
        assert!(error.to_string().contains("SHA-256 mismatch"));
    }

    #[test]
    fn profile_repair_preserves_user_files_and_regenerates_only_delta() {
        let dir = tempfile::tempdir().unwrap();
        let config_path = ensure_profile_at(&dir.path().join("wingosy-profile")).unwrap();
        let sentinels = [
            dir.path().join("retroarch").join("retroarch.cfg"),
            dir.path().join("retroarch").join("autoconfig").join("user.cfg"),
            dir.path().join("retroarch").join("remaps").join("user.rmp"),
            dir.path().join("retroarch").join("saves").join("game.srm"),
            dir.path().join("retroarch").join("states").join("game.state"),
            dir.path().join("retroarch").join("system").join("firmware.bin"),
        ];
        for sentinel in &sentinels {
            std::fs::create_dir_all(sentinel.parent().unwrap()).unwrap();
            std::fs::write(sentinel, b"keep me").unwrap();
        }
        std::fs::write(&config_path, b"stale profile").unwrap();

        let backup = repair_profile_at(&dir.path().join("wingosy-profile"))
            .unwrap()
            .unwrap();

        assert_eq!(
            std::fs::read(&config_path).unwrap(),
            profile_contents().as_bytes()
        );
        for sentinel in &sentinels {
            assert_eq!(std::fs::read(sentinel).unwrap(), b"keep me");
        }
        assert!(backup.exists());
        assert_eq!(std::fs::read(backup).unwrap(), b"stale profile");
    }

    #[test]
    fn profile_contains_exactly_the_two_managed_settings() {
        let contents = profile_contents();

        assert_eq!(
            contents,
            "config_save_on_exit = false\ninput_autodetect_enable = true\n"
        );
    }

    #[test]
    fn manifest_marker_records_current_identity() {
        let dir = tempfile::tempdir().unwrap();
        let executable = dir.path().join("retroarch.exe");
        std::fs::write(&executable, b"retroarch").unwrap();

        write_manifest_marker(&executable).unwrap();

        assert!(managed_manifest_marker_matches(&executable));
    }

    #[test]
    fn extra_user_cores_do_not_change_the_certified_core_set() {
        let dir = tempfile::tempdir().unwrap();
        let executable = dir.path().join("retroarch.exe");
        let cores = dir.path().join("cores");
        std::fs::create_dir_all(&cores).unwrap();
        std::fs::write(&executable, b"retroarch").unwrap();
        write_manifest_marker(&executable).unwrap();
        for filename in certified_core_filenames() {
            std::fs::write(cores.join(filename), b"core").unwrap();
        }
        std::fs::write(cores.join("user_core_libretro.dll"), b"user core").unwrap();

        assert!(managed_core_set_is_present(&executable));
    }

    #[test]
    fn managed_readiness_revalidates_the_executable_and_cores() {
        let dir = tempfile::tempdir().unwrap();
        let executable = dir.path().join("retroarch.exe");
        let cores = dir.path().join("cores");
        std::fs::create_dir_all(&cores).unwrap();
        std::fs::write(&executable, b"modified executable").unwrap();
        write_manifest_marker(&executable).unwrap();
        for filename in certified_core_filenames() {
            std::fs::write(cores.join(filename), b"modified core").unwrap();
        }

        let mut config = AppConfig::default();
        config.emulators.retroarch_install_kind = RetroArchInstallKind::Managed;
        config.emulators.retroarch_manifest_version = Some(MANIFEST_VERSION.to_string());

        assert!(!managed_install_is_ready(&config, &executable));
    }

    #[test]
    fn managed_validation_rejects_modified_core_before_repair() {
        let dir = tempfile::tempdir().unwrap();
        let executable = dir.path().join("retroarch.exe");
        let cores = dir.path().join("cores");
        std::fs::create_dir_all(&cores).unwrap();
        std::fs::write(&executable, b"retroarch").unwrap();
        write_manifest_marker(&executable).unwrap();
        std::fs::write(cores.join("fceumm_libretro.dll"), b"modified core").unwrap();

        let mut config = AppConfig::default();
        config.emulators.retroarch_install_kind = RetroArchInstallKind::Managed;
        config.emulators.retroarch_manifest_version = Some(MANIFEST_VERSION.to_string());

        let error = validate_managed_install(&config, &executable).unwrap_err();

        assert!(error.to_string().contains("failed validation"));
    }

    #[test]
    fn core_availability_distinguishes_missing_installed_and_invalid_managed_cores() {
        let dir = tempfile::tempdir().unwrap();
        let executable = dir.path().join("retroarch.exe");
        let cores = dir.path().join("cores");
        std::fs::create_dir_all(&cores).unwrap();
        std::fs::write(&executable, b"retroarch").unwrap();
        let artifact = CoreArtifact {
            platform_id: "test",
            filename: "test_libretro.dll",
            archive_url: "https://example.invalid/cores.7z",
            archive_sha256: "archive",
            installed_sha256: "ec654fac9599f62e79e2706abef23dfb7c07c08185aa86db4d8695f0b718d1b3",
        };

        assert_eq!(
            core_availability(Some(&executable), &artifact, true),
            CoreAvailability::Missing
        );
        std::fs::write(cores.join(artifact.filename), b"invalid").unwrap();
        assert_eq!(
            core_availability(Some(&executable), &artifact, true),
            CoreAvailability::Invalid
        );
        std::fs::write(cores.join(artifact.filename), b"valid").unwrap();
        assert_eq!(
            core_availability(Some(&executable), &artifact, true),
            CoreAvailability::Installed
        );
    }

    #[test]
    fn managed_profile_points_native_xinput_autoconfiguration_at_the_install() {
        let dir = tempfile::tempdir().unwrap();
        let executable = dir.path().join("RetroArch").join("retroarch.exe");
        let profile = managed_profile_contents(&executable).unwrap();

        assert!(profile.contains("input_autodetect_enable = true"));
        assert!(profile.contains("input_joypad_driver = \"xinput\""));
        assert!(profile.contains("joypad_autoconfig_dir = \""));
        assert!(profile.contains("input_menu_toggle_gamepad_combo = \"2\""));
        assert!(!profile.contains("input_player1_"));
        assert!(!profile.contains("input_vendor_id"));
    }

    #[test]
    fn managed_autoconfig_requires_a_native_xinput_profile() {
        let dir = tempfile::tempdir().unwrap();
        let executable = dir.path().join("retroarch.exe");
        std::fs::write(&executable, b"retroarch").unwrap();
        assert!(!managed_autoconfig_is_present(&executable));

        let xinput = dir.path().join("autoconfig").join("xinput");
        std::fs::create_dir_all(&xinput).unwrap();
        std::fs::write(xinput.join("native-controller.cfg"), b"input_driver = \"xinput\"\n")
            .unwrap();

        assert!(managed_autoconfig_is_present(&executable));
    }

    #[test]
    fn promised_core_path_resolves_the_certified_nes_core() {
        let dir = tempfile::tempdir().unwrap();
        let executable = dir.path().join("retroarch.exe");

        assert_eq!(
            promised_core_path(&executable, "nes").unwrap(),
            dir.path().join("cores").join("fceumm_libretro.dll")
        );
    }

    #[test]
    fn managed_core_path_accepts_identity_valid_install_with_valid_promised_core() {
        let dir = tempfile::tempdir().unwrap();
        let executable = dir.path().join("retroarch.exe");
        let core = dir.path().join("cores").join("fceumm_libretro.dll");
        std::fs::create_dir_all(core.parent().unwrap()).unwrap();
        std::fs::write(&executable, b"valid").unwrap();
        std::fs::write(&core, b"valid").unwrap();
        write_manifest_marker(&executable).unwrap();

        let mut config = AppConfig::default();
        config.emulators.retroarch_install_kind = RetroArchInstallKind::Managed;
        config.emulators.retroarch_manifest_version = Some(MANIFEST_VERSION.to_string());
        let artifact = CoreArtifact {
            platform_id: "nes",
            filename: "fceumm_libretro.dll",
            archive_url: "https://example.invalid/cores.7z",
            archive_sha256: "archive",
            installed_sha256:
                "ec654fac9599f62e79e2706abef23dfb7c07c08185aa86db4d8695f0b718d1b3",
        };
        let manifest = ManagedCoreManifest {
            executable_sha256:
                "ec654fac9599f62e79e2706abef23dfb7c07c08185aa86db4d8695f0b718d1b3",
            cores: std::slice::from_ref(&artifact),
        };

        let resolved = managed_core_path(
            &config,
            &executable,
            "nes",
            manifest,
        )
        .unwrap();

        assert_eq!(resolved, core);
    }

    #[test]
    fn managed_core_path_rejects_a_missing_promised_core() {
        let dir = tempfile::tempdir().unwrap();
        let executable = dir.path().join("retroarch.exe");
        std::fs::write(&executable, b"valid").unwrap();
        write_manifest_marker(&executable).unwrap();

        let mut config = AppConfig::default();
        config.emulators.retroarch_install_kind = RetroArchInstallKind::Managed;
        config.emulators.retroarch_manifest_version = Some(MANIFEST_VERSION.to_string());
        let artifact = CoreArtifact {
            platform_id: "nes",
            filename: "fceumm_libretro.dll",
            archive_url: "https://example.invalid/cores.7z",
            archive_sha256: "archive",
            installed_sha256:
                "ec654fac9599f62e79e2706abef23dfb7c07c08185aa86db4d8695f0b718d1b3",
        };
        let manifest = ManagedCoreManifest {
            executable_sha256:
                "ec654fac9599f62e79e2706abef23dfb7c07c08185aa86db4d8695f0b718d1b3",
            cores: std::slice::from_ref(&artifact),
        };

        let error = managed_core_path(&config, &executable, "nes", manifest).unwrap_err();

        assert!(error.to_string().contains("is missing"));
    }

    #[test]
    fn managed_core_path_rejects_an_unverified_install() {
        let dir = tempfile::tempdir().unwrap();
        let executable = dir.path().join("retroarch.exe");
        std::fs::write(&executable, b"modified executable").unwrap();
        write_manifest_marker(&executable).unwrap();

        let mut config = AppConfig::default();
        config.emulators.retroarch_install_kind = RetroArchInstallKind::Managed;
        config.emulators.retroarch_manifest_version = Some(MANIFEST_VERSION.to_string());

        let error = managed_core_path(
            &config,
            &executable,
            "nes",
            certified_managed_core_manifest(),
        )
        .unwrap_err();

        assert!(error.to_string().contains("integrity validation"));
    }
}
