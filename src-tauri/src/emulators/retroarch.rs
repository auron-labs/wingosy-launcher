use anyhow::{Context, Result};
use sha2::{Digest, Sha256};
use std::io::Read;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::config::{AppConfig, RetroArchInstallKind};

pub const RETROARCH_VERSION: &str = "1.19.1";
pub const MANIFEST_VERSION: &str = "beta-2026-08-23";

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
    pub sha256: &'static str,
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
        url: "https://buildbot.libretro.com/stable/1.19.1/windows/x86_64/RetroArch_cores.7z",
        format: "7z",
        sha256: "4384854038d3e2a85cae6563e3a78ba7a8c0696fc6e1f9f4a0e6b8044cef8d92",
    }
}

pub fn core_artifacts() -> &'static [CoreArtifact] {
    const CORES: &[CoreArtifact] = &[
        CoreArtifact {
            platform_id: "nes",
            filename: "fceumm_libretro.dll",
            sha256: "2352c2592986fb3155c36dd316a20886f7fbaed0434130c6d464c8ffec9e08b3",
        },
        CoreArtifact {
            platform_id: "snes",
            filename: "snes9x_libretro.dll",
            sha256: "1d7d68f6568f74e8de0599af718d9fce8e66b656d8b77594cd37b7ee2465cffd",
        },
        CoreArtifact {
            platform_id: "gb",
            filename: "gambatte_libretro.dll",
            sha256: "588692d07db0c7fd28703326fe14b9b58cfaee19b88eec21952a39d8d7730fe2",
        },
        CoreArtifact {
            platform_id: "gbc",
            filename: "gambatte_libretro.dll",
            sha256: "588692d07db0c7fd28703326fe14b9b58cfaee19b88eec21952a39d8d7730fe2",
        },
        CoreArtifact {
            platform_id: "gba",
            filename: "mgba_libretro.dll",
            sha256: "1de88f427faf79353837a547070f9b74bde8454cb3f27f41a8f7ed4540e7d324",
        },
        CoreArtifact {
            platform_id: "genesis",
            filename: "genesis_plus_gx_libretro.dll",
            sha256: "a5648038ee099670b7225d9acdb4a5afb77c2215d5038e70ae995877bdbed504",
        },
    ];

    CORES
}

pub fn core_artifact_for_filename(filename: &str) -> Option<Artifact> {
    let filename = filename.trim_end_matches(".zip");
    core_artifacts()
        .iter()
        .find(|core| core.filename == filename)
        .map(|_| retroarch_cores_artifact())
}

pub fn profile_dir() -> Result<PathBuf> {
    Ok(AppConfig::data_dir()?.join("retroarch").join("profile"))
}

pub fn delta_path() -> Result<PathBuf> {
    Ok(profile_dir()?.join("wingosy-retroarch-v1.cfg"))
}

pub fn autoconfig_dir() -> Result<PathBuf> {
    Ok(profile_dir()?.join("controller-profiles"))
}

pub fn remaps_dir() -> Result<PathBuf> {
    Ok(profile_dir()?.join("remaps"))
}

pub fn ensure_profile() -> Result<PathBuf> {
    let root = profile_dir()?;
    ensure_profile_at(&root)
}

pub fn ensure_profile_at(root: &Path) -> Result<PathBuf> {
    std::fs::create_dir_all(root.join("controller-profiles"))
        .context("Failed to create RetroArch controller profile directory")?;
    std::fs::create_dir_all(root.join("remaps"))
        .context("Failed to create RetroArch remap directory")?;

    let config_path = root.join("wingosy-retroarch-v1.cfg");
    if !config_path.exists() {
        std::fs::write(&config_path, profile_contents(root))
            .context("Failed to write Wingosy RetroArch profile")?;
    }

    Ok(config_path)
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

    let backups = root.join("backups");
    std::fs::create_dir_all(&backups)
        .context("Failed to create RetroArch profile backup directory")?;
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .context("System clock is before Unix epoch")?
        .as_nanos();
    let backup_path = backups.join(format!("wingosy-retroarch-v1-{timestamp}.cfg"));
    std::fs::copy(&config_path, &backup_path)
        .context("Failed to back up Wingosy RetroArch profile")?;
    std::fs::remove_file(config_path).context("Failed to remove Wingosy RetroArch profile")?;
    Ok(Some(backup_path))
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
    manifest_identity_matches(config)
        && managed_manifest_marker_matches(retroarch_executable)
        && managed_core_set_is_present(retroarch_executable)
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
    let actual = format!("{:x}", digest.finalize());
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

fn profile_contents(root: &Path) -> String {
    let value = |path: PathBuf| {
        path.to_string_lossy()
            .replace('\\', "/")
            .replace('"', "\\\"")
    };
    format!(
        "# Wingosy RetroArch beta profile {MANIFEST_VERSION}\nconfig_save_on_exit = false\ninput_autodetect_enable = true\njoypad_autoconfig_dir = \"{}\"\ninput_remapping_directory = \"{}\"\n",
        value(root.join("controller-profiles")),
        value(root.join("remaps")),
    )
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
        assert!(core_artifacts()
            .iter()
            .all(|core| core.sha256.len() == 64));
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
    fn profile_reset_preserves_user_remaps() {
        let dir = tempfile::tempdir().unwrap();
        let config_path = ensure_profile_at(dir.path()).unwrap();
        let sentinel = dir.path().join("remaps").join("user.rmp");
        std::fs::write(&sentinel, b"keep me").unwrap();

        let backup = reset_profile_at(dir.path()).unwrap().unwrap();

        assert!(!config_path.exists());
        assert_eq!(std::fs::read(&sentinel).unwrap(), b"keep me");
        assert!(backup.exists());
    }

    #[test]
    fn profile_contains_only_directory_and_autodetect_settings() {
        let contents = profile_contents(Path::new("C:/Wingosy/profile"));

        assert!(contents.contains("input_autodetect_enable = true"));
        assert!(contents.contains("joypad_autoconfig_dir"));
        assert!(contents.contains("input_remapping_directory"));
        assert!(!contents.contains("input_player"));
        assert!(!contents.contains("input_device"));
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
    fn extra_user_cores_do_not_invalidate_managed_readiness() {
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

        let mut config = AppConfig::default();
        config.emulators.retroarch_install_kind = RetroArchInstallKind::Managed;
        config.emulators.retroarch_manifest_version = Some(MANIFEST_VERSION.to_string());

        assert!(managed_install_is_ready(&config, &executable));
    }
}
