use anyhow::{Context, Result};
use std::path::{Path, PathBuf};

pub async fn download_file(url: &str, dest: &Path) -> Result<()> {
    download_file_with_progress(url, dest, |_| {}).await
}

pub async fn download_file_with_progress<F>(url: &str, dest: &Path, progress: F) -> Result<()>
where
    F: Fn(crate::api::download::DownloadProgress) + Send + 'static,
{
    let dl = crate::api::download::DownloadManager::new();
    dl.download_file(url, dest, None, progress).await
}

pub fn extract_archive(archive: &Path, dest_dir: &Path, format: &str) -> Result<PathBuf> {
    std::fs::create_dir_all(dest_dir).context("Failed to create destination directory")?;

    match format {
        "zip" => extract_zip(archive, dest_dir),
        "7z" => extract_7z(archive, dest_dir),
        _ => anyhow::bail!("Unsupported archive format: {}", format),
    }
}

fn extract_zip(archive: &Path, dest_dir: &Path) -> Result<PathBuf> {
    let file = std::fs::File::open(archive).context("Failed to open archive")?;
    let mut zip = zip::ZipArchive::new(file).context("Failed to read zip")?;

    for i in 0..zip.len() {
        let mut entry = zip.by_index(i)?;
        let outpath = dest_dir.join(entry.mangled_name());

        if entry.is_dir() {
            std::fs::create_dir_all(&outpath).ok();
        } else {
            if let Some(parent) = outpath.parent() {
                std::fs::create_dir_all(parent).ok();
            }
            let mut outfile = std::fs::File::create(&outpath)?;
            std::io::copy(&mut entry, &mut outfile)?;
        }
    }

    Ok(dest_dir.to_path_buf())
}

fn extract_7z(archive: &Path, dest_dir: &Path) -> Result<PathBuf> {
    sevenz_rust::decompress_file(archive, dest_dir).context("Failed to extract 7z archive")?;
    Ok(dest_dir.to_path_buf())
}

pub fn find_executable(dir: &Path, exe_names: &[&str]) -> Option<PathBuf> {
    // First check direct path
    for exe in exe_names {
        let direct = dir.join(exe);
        if direct.exists() {
            return Some(direct);
        }
    }

    // Then check one level deep (common for archives with a root folder)
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.filter_map(|e| e.ok()) {
            if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                for exe in exe_names {
                    let nested = entry.path().join(exe);
                    if nested.exists() {
                        return Some(nested);
                    }
                }
            }
        }
    }

    // Finally, do a recursive search up to 3 levels deep
    fn search_recursive(dir: &Path, exe_names: &[&str], depth: u8) -> Option<PathBuf> {
        if depth > 3 {
            return None;
        }

        if let Ok(entries) = std::fs::read_dir(dir) {
            for entry in entries.filter_map(|e| e.ok()) {
                let path = entry.path();

                if path.is_file() {
                    if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                        for exe in exe_names {
                            if name.eq_ignore_ascii_case(exe) {
                                return Some(path);
                            }
                        }
                    }
                } else if path.is_dir() {
                    if let Some(found) = search_recursive(&path, exe_names, depth + 1) {
                        return Some(found);
                    }
                }
            }
        }
        None
    }

    search_recursive(dir, exe_names, 0)
}
