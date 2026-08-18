use anyhow::{Context, Result};
use std::io::Read;
use std::path::{Path, PathBuf};

const BUILDBOT_BASE: &str = "https://buildbot.libretro.com/nightly/windows/x86_64/latest";

/// Fixes `gambatte_libretro.dll_libretro.dll` produced by older builds where `retroarch_cores()`
/// values (already full `*_libretro.dll`) were concatenated with `_libretro.dll` again.
pub fn normalize_libretro_core_filename(name: &str) -> String {
    if name.ends_with("_libretro.dll_libretro.dll") {
        name.strip_suffix("_libretro.dll")
            .unwrap_or(name)
            .to_string()
    } else {
        name.to_string()
    }
}

pub fn resolve_core_filename(name: &str) -> Result<String> {
    let normalized_separators = name.replace('\\', "/");
    let filename = Path::new(&normalized_separators)
        .file_name()
        .and_then(|name| name.to_str())
        .filter(|name| !name.is_empty() && *name != "." && *name != "..")
        .context("RetroArch core name must include a file name")?;

    Ok(normalize_libretro_core_filename(filename))
}

pub fn core_download_url(core_filename: &str) -> String {
    // The buildbot uses .dll.zip extension for Windows cores
    // Core filename is like "mgba_libretro.dll", URL is "mgba_libretro.dll.zip"
    format!("{}/{}.zip", BUILDBOT_BASE, core_filename)
}

fn validate_zip_file(path: &Path) -> Result<()> {
    let mut file = std::fs::File::open(path)?;
    let mut magic = [0u8; 4];
    file.read_exact(&mut magic)?;
    
    // ZIP files start with PK (0x50 0x4B)
    if magic[0] != 0x50 || magic[1] != 0x4B {
        // Check if it's HTML (error page)
        let file_start = String::from_utf8_lossy(&magic);
        if file_start.contains('<') || file_start.contains("<!") {
            anyhow::bail!("Server returned HTML instead of ZIP (likely 404 error page). The core may not be available.");
        }
        anyhow::bail!("Invalid ZIP file: missing PK signature (got: {:02x} {:02x})", magic[0], magic[1]);
    }
    
    // Verify it's a proper ZIP (03 04 for local file header, 05 06 for empty archive)
    if magic[2] != 0x03 && magic[2] != 0x05 {
        anyhow::bail!("Invalid ZIP file: unexpected header version");
    }
    
    Ok(())
}

pub fn resolve_core_path(retroarch_path: &Path, core_filename: &str) -> Result<PathBuf> {
    let core_filename = resolve_core_filename(core_filename)?;
    let cores_dir = get_cores_dir(retroarch_path);
    let cores_dir = if cores_dir.is_absolute() {
        cores_dir
    } else {
        std::env::current_dir()
            .context("Failed to determine the working directory")?
            .join(cores_dir)
    };

    Ok(cores_dir.join(core_filename))
}

pub async fn download_core(core_filename: &str, retroarch_path: &Path) -> Result<PathBuf> {
    let requested_core_filename = core_filename;
    let core_path = resolve_core_path(retroarch_path, core_filename)?;
    let core_filename = core_path
        .file_name()
        .and_then(|name| name.to_str())
        .context("RetroArch core path must include a file name")?
        .to_owned();
    if core_filename != requested_core_filename {
        tracing::warn!(
            "[Cores] Correcting malformed core filename: {} -> {}",
            requested_core_filename,
            core_filename
        );
    }
    let cores_dir = core_path
        .parent()
        .context("RetroArch core path must include a parent directory")?;
    std::fs::create_dir_all(cores_dir).context("Failed to create cores directory")?;

    if core_path.is_file() {
        tracing::info!("[Cores] Core already exists: {:?}", core_path);
        return Ok(core_path);
    }

    let url = core_download_url(&core_filename);
    let zip_path = cores_dir.join(format!("{}.zip", core_filename));
    
    tracing::info!("[Cores] Downloading core from: {}", url);

    let dl = crate::api::download::DownloadManager::new();
    dl.download_file(&url, &zip_path, None, |_| {})
        .await
        .context(format!("Failed to download core from {}", url))?;

    // Validate the downloaded file is actually a ZIP
    if let Err(e) = validate_zip_file(&zip_path) {
        // Clean up invalid file
        std::fs::remove_file(&zip_path).ok();
        
        // Log file size for debugging
        if let Ok(metadata) = std::fs::metadata(&zip_path) {
            tracing::error!("[Cores] Invalid download (size: {} bytes): {}", metadata.len(), e);
        }
        
        return Err(e);
    }

    let file = std::fs::File::open(&zip_path).context("Failed to open downloaded ZIP")?;
    let mut zip = zip::ZipArchive::new(file).context(
        "Invalid ZIP archive: The downloaded file is corrupted or not a valid ZIP. \
         This can happen if the core is unavailable or the server returned an error page."
    )?;

    tracing::debug!("[Cores] ZIP contains {} entries", zip.len());
    
    let mut extracted_dll = None;
    for i in 0..zip.len() {
        let mut entry = zip.by_index(i).context("Failed to read ZIP entry")?;
        let entry_name = entry.name().to_string();
        
        if entry_name.ends_with(".dll") {
            let outpath = cores_dir.join(entry.mangled_name());
            tracing::debug!("[Cores] Extracting: {} -> {:?}", entry_name, outpath);
            
            let mut outfile = std::fs::File::create(&outpath)
                .context(format!("Failed to create output file: {:?}", outpath))?;
            std::io::copy(&mut entry, &mut outfile)
                .context("Failed to extract DLL from ZIP")?;
            
            extracted_dll = Some(outpath);
        }
    }

    std::fs::remove_file(&zip_path).ok();

    if let Some(dll_path) = extracted_dll {
        if core_path.is_file() {
            tracing::info!("[Cores] Core installed: {:?}", core_path);
            Ok(core_path)
        } else if dll_path.exists() {
            tracing::info!("[Cores] Core installed (different name): {:?}", dll_path);
            Ok(dll_path)
        } else {
            anyhow::bail!("Core extraction failed: DLL not found after extraction")
        }
    } else {
        anyhow::bail!(
            "No DLL found in ZIP archive for core: {}. \
             The archive may be empty or contain unexpected files.",
            core_filename
        )
    }
}

pub fn get_cores_dir(retroarch_path: &Path) -> PathBuf {
    retroarch_path
        .parent()
        .map(|p| p.join("cores"))
        .unwrap_or_else(|| PathBuf::from("cores"))
}

pub fn is_core_installed(retroarch_path: &Path, core_filename: &str) -> bool {
    resolve_core_path(retroarch_path, core_filename)
        .map(|path| path.is_file())
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_fixes_doubled_libretro_suffix() {
        assert_eq!(
            normalize_libretro_core_filename("gambatte_libretro.dll_libretro.dll"),
            "gambatte_libretro.dll"
        );
        assert_eq!(
            normalize_libretro_core_filename("mgba_libretro.dll_libretro.dll"),
            "mgba_libretro.dll"
        );
    }

    #[test]
    fn normalize_leaves_valid_names_unchanged() {
        assert_eq!(
            normalize_libretro_core_filename("gambatte_libretro.dll"),
            "gambatte_libretro.dll"
        );
        assert_eq!(
            normalize_libretro_core_filename("fceumm_libretro.dll"),
            "fceumm_libretro.dll"
        );
    }

    #[test]
    fn resolve_core_filename_keeps_selection_beneath_cores_directory() {
        assert_eq!(
            resolve_core_filename(r"C:\other\fceumm_libretro.dll").unwrap(),
            "fceumm_libretro.dll"
        );
        assert_eq!(
            resolve_core_filename("../../outside.dll").unwrap(),
            "outside.dll"
        );
    }

    #[test]
    fn test_core_download_url_format() {
        let url = core_download_url("mgba_libretro.dll");
        assert_eq!(
            url,
            "https://buildbot.libretro.com/nightly/windows/x86_64/latest/mgba_libretro.dll.zip"
        );
    }

    #[test]
    fn test_core_download_url_various_cores() {
        let test_cases = [
            ("snes9x_libretro.dll", "snes9x_libretro.dll.zip"),
            ("gambatte_libretro.dll", "gambatte_libretro.dll.zip"),
            ("melonds_libretro.dll", "melonds_libretro.dll.zip"),
        ];

        for (core, expected_suffix) in test_cases {
            let url = core_download_url(core);
            assert!(url.ends_with(expected_suffix), "URL {} should end with {}", url, expected_suffix);
            assert!(url.starts_with("https://buildbot.libretro.com/"), "URL should use HTTPS");
        }
    }

    #[test]
    fn test_get_cores_dir() {
        let retroarch_path = Path::new("C:/RetroArch/retroarch.exe");
        let cores_dir = get_cores_dir(retroarch_path);
        assert_eq!(cores_dir, PathBuf::from("C:/RetroArch/cores"));
    }

    #[test]
    fn test_get_cores_dir_nested() {
        let retroarch_path = Path::new("C:/Games/Emulators/RetroArch/retroarch.exe");
        let cores_dir = get_cores_dir(retroarch_path);
        assert_eq!(cores_dir, PathBuf::from("C:/Games/Emulators/RetroArch/cores"));
    }

    #[test]
    fn resolve_core_path_uses_sanitized_filename_in_install_cores_directory() {
        let dir = tempfile::tempdir().unwrap();
        let retroarch_path = dir.path().join("retroarch.exe");
        let expected = dir.path().join("cores").join("fceumm_libretro.dll");

        assert_eq!(
            resolve_core_path(&retroarch_path, r"..\fceumm_libretro.dll").unwrap(),
            expected
        );
    }

    #[test]
    fn test_validate_zip_valid() {
        use std::io::Write;
        
        let temp_dir = tempfile::TempDir::new().unwrap();
        let zip_path = temp_dir.path().join("test.zip");
        
        // Create a minimal valid ZIP file
        let mut file = std::fs::File::create(&zip_path).unwrap();
        // PK\x03\x04 is the ZIP local file header signature
        file.write_all(&[0x50, 0x4B, 0x03, 0x04, 0x00, 0x00, 0x00, 0x00]).unwrap();
        
        assert!(validate_zip_file(&zip_path).is_ok());
    }

    #[test]
    fn test_validate_zip_html_error() {
        use std::io::Write;
        
        let temp_dir = tempfile::TempDir::new().unwrap();
        let zip_path = temp_dir.path().join("error.zip");
        
        // Write HTML content (simulating a 404 error page)
        let mut file = std::fs::File::create(&zip_path).unwrap();
        file.write_all(b"<!DOCTYPE html><html><body>404 Not Found</body></html>").unwrap();
        
        let result = validate_zip_file(&zip_path);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("HTML"));
    }

    #[test]
    fn test_validate_zip_invalid_signature() {
        use std::io::Write;
        
        let temp_dir = tempfile::TempDir::new().unwrap();
        let zip_path = temp_dir.path().join("invalid.zip");
        
        // Write invalid content
        let mut file = std::fs::File::create(&zip_path).unwrap();
        file.write_all(&[0x00, 0x00, 0x00, 0x00]).unwrap();
        
        let result = validate_zip_file(&zip_path);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("PK signature"));
    }

    #[test]
    fn test_is_core_installed_nonexistent() {
        let retroarch_path = Path::new("C:/NonExistent/retroarch.exe");
        assert!(!is_core_installed(retroarch_path, "test_libretro.dll"));
    }
}

/// Validates every RetroArch DLL listed in [`crate::models::retroarch_cores`]
/// against the same buildbot URL pattern used at runtime (`core_download_url`).
#[cfg(test)]
mod retroarch_buildbot_tests {
    use std::collections::HashSet;
    use std::time::Duration;

    use crate::models::retroarch_cores;

    use super::*;

    fn distinct_core_filenames_sorted() -> Vec<&'static str> {
        let map = retroarch_cores();
        let set: HashSet<&'static str> = map.into_values().collect();
        let mut v: Vec<_> = set.into_iter().collect();
        v.sort_unstable();
        v
    }

    #[tokio::test]
    #[ignore]
    async fn all_mapped_retroarch_core_buildbot_zips_are_valid() {
        let cores_to_test = distinct_core_filenames_sorted();
        println!(
            "\n=== RetroArch cores: validating {} distinct buildbot ZIPs ===\n",
            cores_to_test.len()
        );

        let client = reqwest::Client::builder()
            .user_agent("wingosy-launcher-tests/1.0")
            .timeout(Duration::from_secs(60))
            .build()
            .expect("reqwest Client");

        let mut failures = Vec::new();

        for core_dll in &cores_to_test {
            let url = core_download_url(core_dll);

            println!("  GET {core_dll}");

            match client.get(&url).send().await {
                Ok(resp) => {
                    let status = resp.status();
                    if !status.is_success() {
                        println!("      FAIL HTTP {status}");
                        failures.push(format!("{core_dll}: HTTP {status} ({url})"));
                        continue;
                    }

                    match resp.bytes().await {
                        Ok(bytes) => {
                            if bytes.len() < 4 {
                                println!("      FAIL reply too short ({} bytes)", bytes.len());
                                failures.push(format!("{core_dll}: response too short"));
                                continue;
                            }

                            let is_zip = bytes[0] == 0x50
                                && bytes[1] == 0x4B
                                && (bytes[2] == 0x03 || bytes[2] == 0x05);
                            let is_html = bytes.starts_with(b"<!") || bytes.starts_with(b"<html");

                            if is_html {
                                println!("      FAIL HTML (404 page?)");
                                failures.push(format!("{core_dll}: HTML error page ({url})"));
                            } else if !is_zip {
                                println!(
                                    "      FAIL not ZIP ({:02x} {:02x} {:02x})",
                                    bytes[0], bytes[1], bytes[2]
                                );
                                failures.push(format!(
                                    "{core_dll}: invalid ZIP signature ({url})"
                                ));
                            } else {
                                println!("      OK ({} KiB)", bytes.len() / 1024);
                            }
                        }
                        Err(e) => {
                            println!("      FAIL read body: {e}");
                            failures.push(format!("{core_dll}: {e}"));
                        }
                    }
                }
                Err(e) => {
                    println!("      FAIL {e}");
                    failures.push(format!("{core_dll}: {e}"));
                }
            }
        }

        if !failures.is_empty() {
            eprintln!("\n=== FAILURES ({}) ===", failures.len());
            for f in &failures {
                eprintln!("  - {}", f);
            }
            panic!(
                "{} core(s) failed buildbot ZIP validation (sync `retroarch_cores()`)",
                failures.len()
            );
        }

        println!(
            "\n=== OK: all {} RetroArch DLLs reachable as ZIP ===\n",
            cores_to_test.len()
        );
    }
}
