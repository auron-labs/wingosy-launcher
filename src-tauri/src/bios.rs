use crate::{
    api::{RomMClient, RomMFirmware},
    config::{AppConfig, EmulatorPaths},
};
use aes::{
    cipher::{BlockCipherDecrypt, BlockCipherEncrypt, KeyInit},
    Aes128, Block,
};
use anyhow::{Context, Result};
use serde::Serialize;
use std::{
    fs::File,
    io::{Read, Write},
    path::{Path, PathBuf},
};
use tokio::io::AsyncWriteExt;
use zip::ZipArchive;

#[derive(Debug, Clone)]
struct FirmwareRecord {
    platform_slug: String,
    platform_name: String,
    firmware: RomMFirmware,
}

#[derive(Debug, Clone, Serialize)]
pub struct BiosFirmwareStatus {
    pub id: i64,
    pub platform_slug: String,
    pub platform_name: String,
    pub file_name: String,
    pub file_size_bytes: u64,
    pub md5_hash: Option<String>,
    pub missing_from_fs: bool,
    pub is_downloaded: bool,
    pub local_path: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct BiosDownloadSummary {
    pub downloaded: usize,
    pub skipped: usize,
    pub paths: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct BiosDistributionResult {
    pub emulator_id: String,
    pub target_path: String,
    pub files_copied: usize,
}

#[derive(Debug)]
struct BiosTarget {
    emulator_id: &'static str,
    path: PathBuf,
    platform_slugs: &'static [&'static str],
    rename_for_retroarch: bool,
}

fn configured_client(config: &AppConfig) -> Result<RomMClient> {
    let server_url = config
        .romm
        .server_url
        .clone()
        .context("RomM server is not configured")?;
    let token = crate::romm_credentials::load_device_token(&server_url)?
        .or_else(|| config.romm.auth_token.clone())
        .context("RomM access token is not configured; reconnect in Settings")?;
    Ok(RomMClient::new(server_url).with_token(token))
}

fn safe_component(value: &str, label: &str) -> Result<String> {
    let path = Path::new(value);
    if path.components().count() != 1 {
        anyhow::bail!("Invalid {label}");
    }
    let component = path
        .file_name()
        .and_then(|value| value.to_str())
        .context(format!("Invalid {label}"))?;
    if component.is_empty() || component == "." || component == ".." {
        anyhow::bail!("Invalid {label}");
    }
    Ok(component.to_string())
}

fn target_path(root: &Path, record: &FirmwareRecord) -> Result<PathBuf> {
    let platform = safe_component(&record.platform_slug, "platform slug")?;
    let file_name = safe_component(&record.firmware.file_name, "firmware filename")?;
    Ok(root.join(platform).join(file_name))
}

async fn fetch_firmware(config: &AppConfig) -> Result<(RomMClient, Vec<FirmwareRecord>)> {
    let client = configured_client(config)?;
    let platforms = client.get_platforms().await?;
    let mut records = Vec::new();

    for platform in platforms {
        let platform_name = platform
            .display_name
            .clone()
            .unwrap_or_else(|| platform.name.clone());
        for firmware in platform.firmware {
            records.push(FirmwareRecord {
                platform_slug: platform.slug.clone(),
                platform_name: platform_name.clone(),
                firmware,
            });
        }
    }

    records.sort_by(|a, b| {
        a.platform_name
            .cmp(&b.platform_name)
            .then_with(|| a.firmware.file_name.cmp(&b.firmware.file_name))
    });
    Ok((client, records))
}

fn status_for(root: &Path, record: &FirmwareRecord) -> Result<BiosFirmwareStatus> {
    let path = target_path(root, record)?;
    let is_downloaded = path.is_file();
    Ok(BiosFirmwareStatus {
        id: record.firmware.id,
        platform_slug: record.platform_slug.clone(),
        platform_name: record.platform_name.clone(),
        file_name: record.firmware.file_name.clone(),
        file_size_bytes: record.firmware.file_size_bytes,
        md5_hash: record.firmware.md5_hash.clone(),
        missing_from_fs: record.firmware.missing_from_fs,
        is_downloaded,
        local_path: is_downloaded.then(|| path.to_string_lossy().into_owned()),
    })
}

fn md5_file(path: &Path) -> Result<String> {
    let mut file = File::open(path)?;
    let mut context = md5::Context::new();
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        let read = file.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        context.consume(&buffer[..read]);
    }
    Ok(format!("{:x}", context.finalize()))
}

fn file_is_current(path: &Path, expected_md5: Option<&str>) -> bool {
    if !path.is_file() {
        return false;
    }
    match expected_md5 {
        Some(expected) => md5_file(path)
            .map(|actual| actual.eq_ignore_ascii_case(expected))
            .unwrap_or(false),
        None => true,
    }
}

async fn download_record(
    client: &RomMClient,
    root: &Path,
    record: &FirmwareRecord,
) -> Result<PathBuf> {
    if record.firmware.missing_from_fs {
        anyhow::bail!(
            "{} is missing from the RomM server filesystem",
            record.firmware.file_name
        );
    }

    let target = target_path(root, record)?;
    if file_is_current(&target, record.firmware.md5_hash.as_deref()) {
        return Ok(target);
    }

    let parent = target
        .parent()
        .context("Firmware destination has no parent")?;
    tokio::fs::create_dir_all(parent).await?;
    let file_name = target
        .file_name()
        .and_then(|value| value.to_str())
        .context("Invalid firmware destination")?;
    let partial = target.with_file_name(format!("{file_name}.part"));

    let stream_result: Result<()> = async {
        let mut response = client
            .download_firmware(record.firmware.id, &record.firmware.file_name)
            .await?;
        let mut output = tokio::fs::File::create(&partial).await?;
        while let Some(chunk) = response.chunk().await? {
            output.write_all(&chunk).await?;
        }
        output.flush().await?;
        Ok(())
    }
    .await;
    if let Err(error) = stream_result {
        let _ = tokio::fs::remove_file(&partial).await;
        return Err(error);
    }

    if let Some(expected) = record.firmware.md5_hash.as_deref() {
        let actual = md5_file(&partial)?;
        if !actual.eq_ignore_ascii_case(expected) {
            let _ = tokio::fs::remove_file(&partial).await;
            anyhow::bail!(
                "MD5 mismatch for {}: expected {}, got {}",
                record.firmware.file_name,
                expected,
                actual
            );
        }
    }

    if target.exists() {
        tokio::fs::remove_file(&target).await?;
    }
    tokio::fs::rename(&partial, &target).await?;
    Ok(target)
}

#[tauri::command]
pub fn get_bios_directory() -> Result<String, String> {
    let config = AppConfig::load().unwrap_or_default();
    Ok(config.bios_dir().to_string_lossy().into_owned())
}

#[tauri::command]
pub fn set_bios_directory(path: Option<String>) -> Result<String, String> {
    let mut config = AppConfig::load().unwrap_or_default();
    config.library.bios_directory = path
        .filter(|value| !value.trim().is_empty())
        .map(PathBuf::from);
    let root = config.bios_dir();
    std::fs::create_dir_all(&root).map_err(|error| error.to_string())?;
    config.save().map_err(|error| error.to_string())?;
    Ok(root.to_string_lossy().into_owned())
}

#[tauri::command]
pub async fn list_bios_firmware() -> Result<Vec<BiosFirmwareStatus>, String> {
    let config = AppConfig::load().unwrap_or_default();
    let root = config.bios_dir();
    let (_, records) = fetch_firmware(&config)
        .await
        .map_err(|error| error.to_string())?;
    records
        .iter()
        .map(|record| status_for(&root, record).map_err(|error| error.to_string()))
        .collect()
}

#[tauri::command]
pub async fn download_bios_firmware(firmware_id: i64) -> Result<String, String> {
    let config = AppConfig::load().unwrap_or_default();
    let root = config.bios_dir();
    let (client, records) = fetch_firmware(&config)
        .await
        .map_err(|error| error.to_string())?;
    let record = records
        .iter()
        .find(|record| record.firmware.id == firmware_id)
        .context("Firmware is no longer available from RomM")
        .map_err(|error| error.to_string())?;
    download_record(&client, &root, record)
        .await
        .map(|path| path.to_string_lossy().into_owned())
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn download_all_bios_firmware() -> Result<BiosDownloadSummary, String> {
    let config = AppConfig::load().unwrap_or_default();
    let root = config.bios_dir();
    let (client, records) = fetch_firmware(&config)
        .await
        .map_err(|error| error.to_string())?;
    let mut summary = BiosDownloadSummary {
        downloaded: 0,
        skipped: 0,
        paths: Vec::new(),
    };

    for record in records
        .iter()
        .filter(|record| !record.firmware.missing_from_fs)
    {
        let path = target_path(&root, record).map_err(|error| error.to_string())?;
        let existed = file_is_current(&path, record.firmware.md5_hash.as_deref());
        let downloaded_path = download_record(&client, &root, record)
            .await
            .map_err(|error| error.to_string())?;
        if existed {
            summary.skipped += 1;
        } else {
            summary.downloaded += 1;
        }
        summary
            .paths
            .push(downloaded_path.to_string_lossy().into_owned());
    }
    Ok(summary)
}

fn executable_parent(path: &Option<PathBuf>) -> Option<PathBuf> {
    path.as_ref()?.parent().map(Path::to_path_buf)
}

fn configured_targets(paths: &EmulatorPaths) -> Vec<BiosTarget> {
    let mut targets = Vec::new();
    if let Some(parent) = executable_parent(&paths.retroarch) {
        targets.push(BiosTarget {
            emulator_id: "retroarch",
            path: parent.join("system"),
            platform_slugs: &[],
            rename_for_retroarch: true,
        });
    }
    if let Some(parent) = executable_parent(&paths.duckstation) {
        targets.push(BiosTarget {
            emulator_id: "duckstation",
            path: parent.join("bios"),
            platform_slugs: &["psx"],
            rename_for_retroarch: false,
        });
    }
    if let Some(parent) = executable_parent(&paths.pcsx2) {
        targets.push(BiosTarget {
            emulator_id: "pcsx2",
            path: parent.join("bios"),
            platform_slugs: &["ps2"],
            rename_for_retroarch: false,
        });
    }
    if let Some(parent) = executable_parent(&paths.melonds) {
        targets.push(BiosTarget {
            emulator_id: "melonds",
            path: parent,
            platform_slugs: &["nds"],
            rename_for_retroarch: false,
        });
    }
    if let Some(parent) = executable_parent(&paths.flycast) {
        targets.push(BiosTarget {
            emulator_id: "flycast",
            path: parent.join("data"),
            platform_slugs: &["dreamcast", "dc"],
            rename_for_retroarch: false,
        });
    }
    if let Some(parent) = executable_parent(&paths.mgba) {
        targets.push(BiosTarget {
            emulator_id: "mgba",
            path: parent,
            platform_slugs: &["gba"],
            rename_for_retroarch: false,
        });
    }
    targets
}

fn retroarch_filename(path: &Path) -> String {
    let original = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("firmware.bin")
        .to_string();
    let Ok(hash) = md5_file(path) else {
        return original;
    };
    match hash.as_str() {
        "924e392ed05558ffdb115408c263dccf" => "scph1001.bin",
        "8dd7d5296a650fac7319bce665a6a53c" => "scph5500.bin",
        "490f666e1afb15b7362b406ed1cea246" => "scph5501.bin",
        "32736f17079d0b2b7024407c39bd3050" => "scph5502.bin",
        "a860e8c0b6d573d191e4ec7db1b1e4f6" => "gba_bios.bin",
        "24f67bdea115a2c847c8813a628571b3" | "df692a80a5b1bc90728bc3dfc76cd948" => "bios7.bin",
        "a392174eb3e572fed6447e956bde4b25" => "bios9.bin",
        "145eaef5bd3037cbc247c213bb3da1b3" | "94bc5094607c5e6598d50472c52f27f2" => "firmware.bin",
        "2efd74e3232ff260e371b99f84024f7f" | "854b9150240a198070150e4566ae1290" => "bios_CD_U.bin",
        "e66fa1dc5820d254611fdcdba0662372" => "bios_CD_E.bin",
        "278a9397d192149e84e820ac621a8edd" => "bios_CD_J.bin",
        _ => return original,
    }
    .to_string()
}

fn find_case_insensitive_file(
    directory: &Path,
    predicate: impl Fn(&str) -> bool,
) -> Option<PathBuf> {
    std::fs::read_dir(directory)
        .ok()?
        .filter_map(Result::ok)
        .find_map(|entry| {
            let path = entry.path();
            let name = entry.file_name();
            let name = name.to_string_lossy();
            (path.is_file() && predicate(&name)).then_some(path)
        })
}

fn switch_firmware_files(root: &Path) -> Result<Option<(PathBuf, PathBuf)>> {
    let directory = root.join("switch");
    if !directory.is_dir() {
        return Ok(None);
    }

    let prod_keys = find_case_insensitive_file(&directory, |name| {
        let name = name.to_ascii_lowercase();
        name.starts_with("prod") && name.ends_with(".keys")
    });
    let firmware_zip =
        find_case_insensitive_file(&directory, |name| name.eq_ignore_ascii_case("firmware.zip"))
            .or_else(|| {
                find_case_insensitive_file(&directory, |name| {
                    name.to_ascii_lowercase().ends_with(".zip")
                })
            });

    match (prod_keys, firmware_zip) {
        (None, None) => Ok(None),
        (Some(prod_keys), Some(firmware_zip)) => Ok(Some((prod_keys, firmware_zip))),
        (None, Some(_)) => anyhow::bail!(
            "Switch firmware is downloaded, but prod.keys is missing from {}",
            directory.display()
        ),
        (Some(_), None) => anyhow::bail!(
            "Switch prod.keys is downloaded, but firmware.zip is missing from {}",
            directory.display()
        ),
    }
}

fn read_header_key(path: &Path) -> Result<[u8; 32]> {
    let contents = std::fs::read_to_string(path)
        .with_context(|| format!("Failed to read {}", path.display()))?;
    let header_key = contents
        .lines()
        .find_map(|line| {
            let (name, value) = line.split_once('=')?;
            name.trim()
                .eq_ignore_ascii_case("header_key")
                .then(|| value.trim())
        })
        .context("prod.keys does not contain header_key")?;
    if header_key.len() != 64 || !header_key.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        anyhow::bail!("prod.keys contains an invalid header_key");
    }
    let mut key = [0_u8; 32];
    for (index, byte) in key.iter_mut().enumerate() {
        *byte = u8::from_str_radix(&header_key[index * 2..index * 2 + 2], 16)
            .context("prod.keys contains an invalid header_key")?;
    }
    Ok(key)
}

fn multiply_xts_tweak_by_x(tweak: &mut [u8; 16]) {
    let carry = tweak[15] >> 7;
    for index in (1..16).rev() {
        tweak[index] = (tweak[index] << 1) | (tweak[index - 1] >> 7);
    }
    tweak[0] <<= 1;
    if carry != 0 {
        tweak[0] ^= 0x87;
    }
}

fn transform_nca_header_xts(data: &mut [u8], key: &[u8; 32], decrypt: bool) -> Result<()> {
    const SECTOR_SIZE: usize = 0x200;
    const BLOCK_SIZE: usize = 16;

    if !data.len().is_multiple_of(BLOCK_SIZE) {
        anyhow::bail!("NCA header length is not AES block aligned");
    }
    let data_cipher = Aes128::new_from_slice(&key[..16]).context("Invalid NCA data-key length")?;
    let tweak_cipher =
        Aes128::new_from_slice(&key[16..]).context("Invalid NCA tweak-key length")?;

    for (sector_index, sector) in data.chunks_mut(SECTOR_SIZE).enumerate() {
        let mut tweak = [0_u8; 16];
        tweak[8..].copy_from_slice(&(sector_index as u64).to_be_bytes());
        let tweak_block =
            Block::slice_as_mut_array(&mut tweak).context("Invalid AES tweak block length")?;
        tweak_cipher.encrypt_block(tweak_block);

        for block in sector.chunks_mut(BLOCK_SIZE) {
            for index in 0..BLOCK_SIZE {
                block[index] ^= tweak[index];
            }
            let block =
                Block::slice_as_mut_array(block).context("Invalid AES data block length")?;
            if decrypt {
                data_cipher.decrypt_block(block);
            } else {
                data_cipher.encrypt_block(block);
            }
            for index in 0..BLOCK_SIZE {
                block[index] ^= tweak[index];
            }
            multiply_xts_tweak_by_x(&mut tweak);
        }
    }
    Ok(())
}

fn validate_switch_firmware(path: &Path, header_key: &[u8; 32]) -> Result<usize> {
    const NCA_HEADER_SIZE: usize = 0xC00;
    const NCA_MAGIC_OFFSET: usize = 0x200;

    let file = File::open(path)
        .with_context(|| format!("Failed to open Switch firmware archive {}", path.display()))?;
    let mut archive =
        ZipArchive::new(file).context("Switch firmware is not a valid ZIP archive")?;
    let mut count = 0;
    let mut compatible_nca_found = false;
    for index in 0..archive.len() {
        let mut entry = archive.by_index(index)?;
        let Some(enclosed) = entry.enclosed_name() else {
            continue;
        };
        if !entry.is_dir()
            && enclosed
                .extension()
                .and_then(|extension| extension.to_str())
                .is_some_and(|extension| extension.eq_ignore_ascii_case("nca"))
        {
            count += 1;
            if !compatible_nca_found {
                let mut encrypted_header = vec![0_u8; NCA_HEADER_SIZE];
                let mut read = 0;
                while read < encrypted_header.len() {
                    let amount = entry.read(&mut encrypted_header[read..])?;
                    if amount == 0 {
                        break;
                    }
                    read += amount;
                }
                if read == NCA_HEADER_SIZE {
                    transform_nca_header_xts(&mut encrypted_header, header_key, true)?;
                    compatible_nca_found =
                        &encrypted_header[NCA_MAGIC_OFFSET..NCA_MAGIC_OFFSET + 4] == b"NCA3";
                }
            }
        }
    }
    if count == 0 {
        anyhow::bail!("Switch firmware ZIP does not contain any .nca files");
    }
    if !compatible_nca_found {
        anyhow::bail!("prod.keys is not compatible with the Switch firmware ZIP");
    }
    Ok(count)
}

fn eden_data_root(eden_executable: &Path, appdata: Option<&Path>) -> Result<PathBuf> {
    let parent = eden_executable
        .parent()
        .context("Configured Eden executable has no parent directory")?;
    let portable_user = parent.join("user");

    if parent.join("portable.txt").is_file()
        || portable_user.join("nand").is_dir()
        || portable_user.join("keys").is_dir()
    {
        return Ok(portable_user);
    }
    if parent.join("nand").is_dir() || parent.join("keys").is_dir() {
        return Ok(parent.to_path_buf());
    }
    if let Some(appdata) = appdata {
        return Ok(appdata.join("Eden"));
    }
    Ok(portable_user)
}

fn replace_file(source: &Path, target: &Path) -> Result<()> {
    if target.exists() {
        std::fs::remove_file(target)?;
    }
    std::fs::rename(source, target)?;
    Ok(())
}

fn install_switch_firmware(
    root: &Path,
    eden_executable: &Path,
    appdata: Option<&Path>,
) -> Result<Option<BiosDistributionResult>> {
    let Some((prod_keys, firmware_zip)) = switch_firmware_files(root)? else {
        return Ok(None);
    };

    let header_key = read_header_key(&prod_keys)?;
    let nca_count = validate_switch_firmware(&firmware_zip, &header_key)?;
    let eden_root = eden_data_root(eden_executable, appdata)?;
    let keys_directory = eden_root.join("keys");
    let registered_directory = eden_root
        .join("nand")
        .join("system")
        .join("Contents")
        .join("registered");
    std::fs::create_dir_all(&keys_directory)?;
    std::fs::create_dir_all(&registered_directory)?;

    let prod_keys_partial = keys_directory.join("prod.keys.part");
    std::fs::copy(&prod_keys, &prod_keys_partial).context("Failed to stage prod.keys for Eden")?;
    replace_file(&prod_keys_partial, &keys_directory.join("prod.keys"))
        .context("Failed to install prod.keys for Eden")?;

    let file = File::open(&firmware_zip)?;
    let mut archive = ZipArchive::new(file)?;
    let mut installed = 0;
    for index in 0..archive.len() {
        let mut entry = archive.by_index(index)?;
        let Some(enclosed) = entry.enclosed_name() else {
            continue;
        };
        if entry.is_dir()
            || !enclosed
                .extension()
                .and_then(|extension| extension.to_str())
                .is_some_and(|extension| extension.eq_ignore_ascii_case("nca"))
        {
            continue;
        }
        let file_name = enclosed
            .file_name()
            .context("Switch firmware archive contains an invalid NCA filename")?;
        let target = registered_directory.join(file_name);
        let partial = target.with_extension("nca.part");
        let extraction_result: Result<()> = (|| {
            let mut output = File::create(&partial)?;
            std::io::copy(&mut entry, &mut output)?;
            output.flush()?;
            replace_file(&partial, &target)
        })();
        if let Err(error) = extraction_result {
            let _ = std::fs::remove_file(&partial);
            return Err(error).context(format!(
                "Failed to install Switch firmware file {}",
                file_name.to_string_lossy()
            ));
        }
        installed += 1;
    }

    if installed != nca_count {
        anyhow::bail!(
            "Installed {installed} of {nca_count} Switch firmware files; Eden firmware was not fully installed"
        );
    }

    tracing::info!(
        "[BIOS] Installed Switch prod.keys and {} NCA files into Eden at {}",
        installed,
        eden_root.display()
    );
    Ok(Some(BiosDistributionResult {
        emulator_id: "eden".to_string(),
        target_path: eden_root.to_string_lossy().into_owned(),
        files_copied: installed + 1,
    }))
}

#[tauri::command]
pub fn distribute_bios_firmware() -> Result<Vec<BiosDistributionResult>, String> {
    let config = AppConfig::load().unwrap_or_default();
    let root = config.bios_dir();
    if !root.is_dir() {
        return Ok(Vec::new());
    }

    let mut platform_files = Vec::new();
    for entry in std::fs::read_dir(&root).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        if !entry.path().is_dir() {
            continue;
        }
        let slug = entry.file_name().to_string_lossy().into_owned();
        for file in std::fs::read_dir(entry.path()).map_err(|error| error.to_string())? {
            let file = file.map_err(|error| error.to_string())?;
            if file.path().is_file()
                && file.path().extension().and_then(|ext| ext.to_str()) != Some("part")
            {
                platform_files.push((slug.clone(), file.path()));
            }
        }
    }

    let mut results = Vec::new();
    for target in configured_targets(&config.emulators) {
        std::fs::create_dir_all(&target.path).map_err(|error| error.to_string())?;
        let mut copied = 0;
        for (slug, source) in &platform_files {
            if !target.platform_slugs.is_empty() && !target.platform_slugs.contains(&slug.as_str())
            {
                continue;
            }
            let target_name = if target.rename_for_retroarch {
                retroarch_filename(source)
            } else {
                source
                    .file_name()
                    .and_then(|value| value.to_str())
                    .unwrap_or("firmware.bin")
                    .to_string()
            };
            std::fs::copy(source, target.path.join(target_name))
                .map_err(|error| error.to_string())?;
            copied += 1;
        }
        results.push(BiosDistributionResult {
            emulator_id: target.emulator_id.to_string(),
            target_path: target.path.to_string_lossy().into_owned(),
            files_copied: copied,
        });
    }
    if let Some(eden_executable) = config.emulators.eden.as_deref() {
        let appdata = std::env::var_os("APPDATA").map(PathBuf::from);
        if let Some(result) = install_switch_firmware(&root, eden_executable, appdata.as_deref())
            .map_err(|error| error.to_string())?
        {
            results.push(result);
        }
    }
    Ok(results)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn safe_component_rejects_parent_traversal() {
        assert!(safe_component("../firmware.bin", "filename").is_err());
        assert!(safe_component("..", "filename").is_err());
    }

    #[test]
    fn target_path_is_scoped_to_platform() {
        let record = FirmwareRecord {
            platform_slug: "psx".to_string(),
            platform_name: "PlayStation".to_string(),
            firmware: RomMFirmware {
                id: 1,
                file_name: "scph1001.bin".to_string(),
                file_path: String::new(),
                full_path: String::new(),
                file_size_bytes: 0,
                md5_hash: None,
                sha1_hash: None,
                missing_from_fs: false,
            },
        };
        assert_eq!(
            target_path(Path::new("C:/bios"), &record).unwrap(),
            PathBuf::from("C:/bios/psx/scph1001.bin")
        );
    }

    #[test]
    fn validates_prod_keys_header_key() {
        let temp = tempfile::tempdir().unwrap();
        let valid = temp.path().join("prod.keys");
        std::fs::write(
            &valid,
            "header_key = 00112233445566778899AABBCCDDEEFF00112233445566778899AABBCCDDEEFF\n",
        )
        .unwrap();
        assert!(read_header_key(&valid).is_ok());

        let invalid = temp.path().join("invalid.keys");
        std::fs::write(&invalid, "header_key = not-a-valid-key\n").unwrap();
        assert!(read_header_key(&invalid).is_err());
    }

    #[test]
    fn installs_switch_firmware_into_existing_portable_eden_layout() {
        use zip::write::SimpleFileOptions;

        let temp = tempfile::tempdir().unwrap();
        let bios = temp.path().join("bios");
        let switch = bios.join("switch");
        std::fs::create_dir_all(&switch).unwrap();
        std::fs::write(
            switch.join("prod.keys"),
            "header_key = 00112233445566778899AABBCCDDEEFF00112233445566778899AABBCCDDEEFF\n",
        )
        .unwrap();
        let header_key = read_header_key(&switch.join("prod.keys")).unwrap();
        let mut encrypted_nca = vec![0_u8; 0xC00];
        encrypted_nca[0x200..0x204].copy_from_slice(b"NCA3");
        transform_nca_header_xts(&mut encrypted_nca, &header_key, false).unwrap();

        let archive_file = File::create(switch.join("firmware.zip")).unwrap();
        let mut archive = zip::ZipWriter::new(archive_file);
        archive
            .start_file("nested/0100000000000001.nca", SimpleFileOptions::default())
            .unwrap();
        archive.write_all(&encrypted_nca).unwrap();
        archive
            .start_file("../ignored.nca", SimpleFileOptions::default())
            .unwrap();
        archive.write_all(b"ignored").unwrap();
        archive.finish().unwrap();
        assert!(validate_switch_firmware(&switch.join("firmware.zip"), &[0xAA; 32]).is_err());

        let eden = temp.path().join("Eden");
        let eden_user = eden.join("user");
        std::fs::create_dir_all(eden_user.join("nand")).unwrap();
        let eden_executable = eden.join("eden.exe");
        std::fs::write(&eden_executable, b"").unwrap();

        let result = install_switch_firmware(&bios, &eden_executable, None)
            .unwrap()
            .unwrap();
        assert_eq!(result.emulator_id, "eden");
        assert_eq!(result.files_copied, 2);
        assert!(eden_user.join("keys").join("prod.keys").is_file());
        assert!(eden_user
            .join("nand/system/Contents/registered/0100000000000001.nca")
            .is_file());
        assert!(!temp.path().join("ignored.nca").exists());
    }
}
