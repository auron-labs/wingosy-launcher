use anyhow::{Context, Result};
use reqwest::Client;
use std::path::{Path, PathBuf};
use std::time::Instant;
use tokio::fs::File;
use tokio::io::AsyncWriteExt;
use tokio_stream::StreamExt;

#[derive(Debug, Clone)]
pub struct DownloadManager {
    client: Client,
}

impl DownloadManager {
    pub fn new() -> Self {
        Self {
            client: Client::new(),
        }
    }

    pub async fn download_file<F>(
        &self,
        url: &str,
        dest_path: &Path,
        auth_token: Option<&str>,
        progress_callback: F,
    ) -> Result<()>
    where
        F: Fn(DownloadProgress) + Send + 'static,
    {
        let mut request = self.client.get(url);

        if let Some(token) = auth_token {
            request = request.header("Authorization", format!("Bearer {}", token));
        }

        let response = request.send().await.context("Failed to start download")?;

        // Check for HTTP errors
        let status = response.status();
        if !status.is_success() {
            anyhow::bail!(
                "HTTP error {}: {}",
                status.as_u16(),
                status.canonical_reason().unwrap_or("Unknown")
            );
        }

        let total_size = response.content_length();

        if let Some(parent) = dest_path.parent() {
            tokio::fs::create_dir_all(parent)
                .await
                .context("Failed to create destination directory")?;
        }

        let mut file = File::create(dest_path)
            .await
            .context("Failed to create destination file")?;

        let mut downloaded: u64 = 0;
        let mut rate_estimator = DownloadRateEstimator::new();
        let mut stream = response.bytes_stream();

        while let Some(chunk) = stream.next().await {
            let chunk = chunk.context("Error reading download chunk")?;
            file.write_all(&chunk)
                .await
                .context("Error writing to file")?;

            downloaded += chunk.len() as u64;

            let progress = DownloadProgress::from_transfer(
                downloaded,
                total_size,
                &mut rate_estimator,
                Instant::now(),
            );

            progress_callback(progress);
        }

        file.flush().await.context("Failed to flush file")?;

        Ok(())
    }

    /// Downloads a RomM file without exposing a partial or failed transfer at the final path.
    /// Existing non-empty files are reused when they match the supplied expected size, or whenever
    /// RomM does not provide one.
    pub async fn download_file_atomic<F>(
        &self,
        url: &str,
        dest_path: &Path,
        auth_token: Option<&str>,
        expected_size: Option<u64>,
        progress_callback: F,
    ) -> Result<()>
    where
        F: Fn(DownloadProgress) + Send + 'static,
    {
        if let Ok(metadata) = tokio::fs::metadata(dest_path).await {
            if metadata.is_file()
                && expected_size.map_or(metadata.len() > 0, |expected| metadata.len() == expected)
            {
                return Ok(());
            }
        }

        let partial_path = partial_path(dest_path)?;
        if let Err(error) = self
            .download_file(url, &partial_path, auth_token, progress_callback)
            .await
        {
            return Err(fail_with_partial_cleanup(error, &partial_path).await);
        }

        let actual_size = match tokio::fs::metadata(&partial_path).await {
            Ok(metadata) => metadata.len(),
            Err(error) => {
                return Err(fail_with_partial_cleanup(
                    anyhow::Error::from(error).context("Failed to inspect partial download"),
                    &partial_path,
                )
                .await);
            }
        };

        if let Some(expected) = expected_size {
            if actual_size != expected {
                return Err(
                    fail_with_partial_cleanup(
                        anyhow::anyhow!(
                            "Downloaded file size mismatch: expected {expected} bytes, got {actual_size}"
                        ),
                        &partial_path,
                    )
                    .await,
                );
            }
        }

        if let Err(error) = tokio::fs::rename(&partial_path, dest_path).await {
            return Err(fail_with_partial_cleanup(
                anyhow::Error::from(error).context("Failed to finalize atomic download"),
                &partial_path,
            )
            .await);
        }

        Ok(())
    }

    pub async fn download_bytes(&self, url: &str, auth_token: Option<&str>) -> Result<Vec<u8>> {
        let mut request = self.client.get(url);

        if let Some(token) = auth_token {
            request = request.header("Authorization", format!("Bearer {}", token));
        }

        let response = request.send().await.context("Failed to download")?;

        response
            .bytes()
            .await
            .map(|b| b.to_vec())
            .context("Failed to read response bytes")
    }
}

fn partial_path(dest_path: &Path) -> Result<PathBuf> {
    let file_name = dest_path
        .file_name()
        .context("Destination path has no file name")?;
    let mut partial_name = file_name.to_os_string();
    partial_name.push(".partial");
    Ok(dest_path.with_file_name(partial_name))
}

async fn fail_with_partial_cleanup(error: anyhow::Error, partial_path: &Path) -> anyhow::Error {
    match tokio::fs::remove_file(partial_path).await {
        Ok(()) => error,
        Err(cleanup_error) if cleanup_error.kind() == std::io::ErrorKind::NotFound => error,
        Err(cleanup_error) => error.context(format!(
            "Failed to clean up partial download: {cleanup_error}"
        )),
    }
}

impl Default for DownloadManager {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug, Clone, Copy)]
pub struct DownloadProgress {
    pub downloaded: u64,
    pub total: Option<u64>,
    pub percent: Option<u8>,
    pub speed: Option<u64>,
}

impl DownloadProgress {
    pub fn from_transfer(
        downloaded: u64,
        total: Option<u64>,
        rate_estimator: &mut DownloadRateEstimator,
        observed_at: Instant,
    ) -> Self {
        Self {
            downloaded,
            total,
            percent: total.and_then(|total| {
                (total > 0).then(|| (downloaded as f64 / total as f64 * 100.0).min(100.0) as u8)
            }),
            speed: rate_estimator.observe(downloaded, observed_at),
        }
    }

    pub fn terminal(downloaded: u64, total: Option<u64>) -> Self {
        Self {
            downloaded,
            total,
            percent: total.and_then(|total| {
                (total > 0).then(|| (downloaded as f64 / total as f64 * 100.0).min(100.0) as u8)
            }),
            speed: None,
        }
    }

    pub fn format_size(bytes: u64) -> String {
        const KB: u64 = 1024;
        const MB: u64 = KB * 1024;
        const GB: u64 = MB * 1024;

        if bytes >= GB {
            format!("{:.2} GB", bytes as f64 / GB as f64)
        } else if bytes >= MB {
            format!("{:.2} MB", bytes as f64 / MB as f64)
        } else if bytes >= KB {
            format!("{:.2} KB", bytes as f64 / KB as f64)
        } else {
            format!("{} B", bytes)
        }
    }

    pub fn format_speed(bytes_per_second: u64) -> String {
        format!("{}/s", Self::format_size(bytes_per_second))
    }

    pub fn status_text(&self) -> String {
        let downloaded_str = Self::format_size(self.downloaded);

        match self.total {
            Some(total) => {
                let total_str = Self::format_size(total);
                let percent = self.percent.unwrap_or(0);
                format!("{} / {} ({}%)", downloaded_str, total_str, percent)
            }
            None => downloaded_str,
        }
    }
}

pub struct DownloadRateEstimator {
    last_sample: Option<(u64, Instant)>,
}

impl DownloadRateEstimator {
    pub fn new() -> Self {
        Self { last_sample: None }
    }

    fn observe(&mut self, downloaded: u64, observed_at: Instant) -> Option<u64> {
        let Some((previous_downloaded, previous_observed_at)) = self.last_sample else {
            self.last_sample = Some((downloaded, observed_at));
            return None;
        };
        self.last_sample = Some((downloaded, observed_at));

        let transferred = downloaded.checked_sub(previous_downloaded)?;
        let elapsed = observed_at.saturating_duration_since(previous_observed_at);
        if elapsed.is_zero() || transferred == 0 {
            return None;
        }

        const NANOS_PER_SECOND: u128 = 1_000_000_000;
        let elapsed_nanos = elapsed.as_nanos();
        let rate = (transferred as u128 * NANOS_PER_SECOND + elapsed_nanos - 1) / elapsed_nanos;
        Some(rate.min(u64::MAX as u128) as u64)
    }
}

#[derive(Debug, Clone)]
pub struct DownloadTask {
    pub id: i64,
    pub name: String,
    pub url: String,
    pub dest_path: String,
    pub status: DownloadStatus,
    pub progress: Option<DownloadProgress>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DownloadStatus {
    Queued,
    Downloading,
    Extracting,
    Completed,
    Failed,
    Cancelled,
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::{Arc, Mutex};
    use std::time::Duration;
    use tempfile::tempdir;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpListener;

    async fn serve_once(
        body: &[u8],
        content_length: Option<u64>,
    ) -> (String, tokio::task::JoinHandle<()>, Arc<AtomicUsize>) {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let body = body.to_vec();
        let has_content_length = content_length.is_some();
        let declared_length = content_length.unwrap_or(body.len() as u64);
        let request_count = Arc::new(AtomicUsize::new(0));
        let server_request_count = Arc::clone(&request_count);
        let task = tokio::spawn(async move {
            let (mut stream, _) = listener.accept().await.unwrap();
            server_request_count.fetch_add(1, Ordering::SeqCst);
            let mut request = [0u8; 1024];
            let _ = stream.read(&mut request).await;
            let headers = if has_content_length {
                format!(
                    "HTTP/1.1 200 OK\r\nContent-Length: {declared_length}\r\nConnection: close\r\n\r\n"
                )
            } else {
                "HTTP/1.1 200 OK\r\nConnection: close\r\n\r\n".to_string()
            };
            stream.write_all(headers.as_bytes()).await.unwrap();
            stream.write_all(&body).await.unwrap();
        });
        (format!("http://{address}/rom"), task, request_count)
    }

    #[tokio::test]
    async fn atomic_download_succeeds_for_spaces_and_unicode_paths() {
        let temp = tempdir().unwrap();
        let destination = temp
            .path()
            .join("ROM Library 日本語")
            .join("My Game - äö.nes");
        let body = b"rom contents";
        let progress = Arc::new(Mutex::new(Vec::new()));
        let (url, server, _) = serve_once(body, None).await;
        let progress_callback = Arc::clone(&progress);

        DownloadManager::new()
            .download_file_atomic(
                &url,
                &destination,
                None,
                Some(body.len() as u64),
                move |value| {
                    progress_callback.lock().unwrap().push(value);
                },
            )
            .await
            .unwrap();

        server.await.unwrap();
        assert_eq!(tokio::fs::read(&destination).await.unwrap(), body);
        assert!(!destination
            .with_file_name("My Game - äö.nes.partial")
            .exists());
        assert!(!progress.lock().unwrap().is_empty());
    }

    #[tokio::test]
    async fn atomic_download_reuses_cached_file_without_content_request() {
        let temp = tempdir().unwrap();
        let destination = temp.path().join("cached.rom");
        let body = b"cached rom";
        tokio::fs::write(&destination, body).await.unwrap();
        let (url, server, request_count) = serve_once(b"new rom", None).await;

        DownloadManager::new()
            .download_file_atomic(&url, &destination, None, Some(body.len() as u64), |_| {})
            .await
            .unwrap();

        assert_eq!(request_count.load(Ordering::SeqCst), 0);
        assert_eq!(tokio::fs::read(&destination).await.unwrap(), body);
        server.abort();
        let _ = server.await;
    }

    #[tokio::test]
    async fn atomic_download_accepts_missing_expected_size() {
        let temp = tempdir().unwrap();
        let destination = temp.path().join("unknown-size.rom");
        let body = b"rom without metadata";
        let (url, server, _) = serve_once(body, None).await;

        DownloadManager::new()
            .download_file_atomic(&url, &destination, None, None, |_| {})
            .await
            .unwrap();

        server.await.unwrap();
        assert_eq!(tokio::fs::read(&destination).await.unwrap(), body);
    }

    #[tokio::test]
    async fn zero_byte_unknown_size_cache_is_not_reused() {
        let temp = tempdir().unwrap();
        let destination = temp.path().join("empty-cache.rom");
        tokio::fs::write(&destination, []).await.unwrap();
        let body = b"replacement rom";
        let (url, server, request_count) = serve_once(body, None).await;

        DownloadManager::new()
            .download_file_atomic(&url, &destination, None, None, |_| {})
            .await
            .unwrap();

        assert_eq!(request_count.load(Ordering::SeqCst), 1);
        server.await.unwrap();
        assert_eq!(tokio::fs::read(&destination).await.unwrap(), body);
    }

    #[tokio::test]
    async fn atomic_download_replaces_known_invalid_destination_after_validation() {
        let temp = tempdir().unwrap();
        let destination = temp.path().join("stale-cache.rom");
        tokio::fs::write(&destination, b"stale").await.unwrap();
        let body = b"validated replacement rom";
        let (url, server, request_count) = serve_once(body, None).await;

        DownloadManager::new()
            .download_file_atomic(&url, &destination, None, Some(body.len() as u64), |_| {})
            .await
            .unwrap();

        server.await.unwrap();
        assert_eq!(request_count.load(Ordering::SeqCst), 1);
        assert_eq!(tokio::fs::read(&destination).await.unwrap(), body);
        assert!(!destination
            .with_file_name("stale-cache.rom.partial")
            .exists());
    }

    #[tokio::test]
    async fn atomic_download_cleans_truncated_transfer_and_preserves_cache() {
        let temp = tempdir().unwrap();
        let destination = temp.path().join("cached.rom");
        let cached_body = b"known-good cached rom";
        tokio::fs::write(&destination, cached_body).await.unwrap();
        let (url, server, request_count) = serve_once(b"short", None).await;

        let error = DownloadManager::new()
            .download_file_atomic(&url, &destination, None, Some(99), |_| {})
            .await
            .unwrap_err();

        server.await.unwrap();
        assert!(error.to_string().contains("size mismatch"));
        assert_eq!(request_count.load(Ordering::SeqCst), 1);
        assert_eq!(tokio::fs::read(&destination).await.unwrap(), cached_body);
        assert!(!destination.with_file_name("cached.rom.partial").exists());
    }

    #[tokio::test]
    async fn atomic_download_retry_recovers_after_validation_failure() {
        let temp = tempdir().unwrap();
        let destination = temp.path().join("retry.rom");
        let body = b"retryable rom";
        let (first_url, first_server, _) = serve_once(body, None).await;

        let first_error = DownloadManager::new()
            .download_file_atomic(&first_url, &destination, None, Some(99), |_| {})
            .await
            .unwrap_err();

        first_server.await.unwrap();
        assert!(first_error.to_string().contains("size mismatch"));
        assert!(!destination.exists());

        let (second_url, second_server, _) = serve_once(body, None).await;
        DownloadManager::new()
            .download_file_atomic(
                &second_url,
                &destination,
                None,
                Some(body.len() as u64),
                |_| {},
            )
            .await
            .unwrap();

        second_server.await.unwrap();
        assert_eq!(tokio::fs::read(&destination).await.unwrap(), body);
    }

    #[test]
    fn test_format_size_bytes() {
        assert_eq!(DownloadProgress::format_size(0), "0 B");
        assert_eq!(DownloadProgress::format_size(500), "500 B");
        assert_eq!(DownloadProgress::format_size(1023), "1023 B");
    }

    #[test]
    fn test_format_size_kilobytes() {
        assert_eq!(DownloadProgress::format_size(1024), "1.00 KB");
        assert_eq!(DownloadProgress::format_size(1536), "1.50 KB");
        assert_eq!(DownloadProgress::format_size(10240), "10.00 KB");
    }

    #[test]
    fn test_format_size_megabytes() {
        assert_eq!(DownloadProgress::format_size(1024 * 1024), "1.00 MB");
        assert_eq!(DownloadProgress::format_size(5 * 1024 * 1024), "5.00 MB");
        assert_eq!(DownloadProgress::format_size(1536 * 1024), "1.50 MB");
    }

    #[test]
    fn test_format_size_gigabytes() {
        assert_eq!(DownloadProgress::format_size(1024 * 1024 * 1024), "1.00 GB");
        assert_eq!(
            DownloadProgress::format_size(2 * 1024 * 1024 * 1024),
            "2.00 GB"
        );
    }

    #[test]
    fn test_status_text_with_total() {
        let progress = DownloadProgress {
            downloaded: 512 * 1024,
            total: Some(1024 * 1024),
            percent: Some(50),
            speed: None,
        };

        let status = progress.status_text();
        assert!(status.contains("512.00 KB"));
        assert!(status.contains("1.00 MB"));
        assert!(status.contains("50%"));
    }

    #[test]
    fn test_status_text_without_total() {
        let progress = DownloadProgress {
            downloaded: 512 * 1024,
            total: None,
            percent: None,
            speed: None,
        };

        let status = progress.status_text();
        assert_eq!(status, "512.00 KB");
    }

    #[test]
    fn last_sample_rate_skips_the_first_observation() {
        let start = Instant::now();
        let mut rate = DownloadRateEstimator::new();

        assert_eq!(rate.observe(1024, start + Duration::from_secs(1)), None);
        assert_eq!(
            rate.observe(3072, start + Duration::from_secs(3)),
            Some(1024)
        );
        assert_eq!(DownloadProgress::format_speed(1024), "1.00 KB/s");
    }

    #[test]
    fn last_sample_rate_excludes_an_idle_observation() {
        let start = Instant::now();
        let mut rate = DownloadRateEstimator::new();

        assert_eq!(rate.observe(0, start + Duration::from_secs(2)), None);
        assert_eq!(
            rate.observe(1024, start + Duration::from_secs(3)),
            Some(1024)
        );
    }

    #[test]
    fn transfer_progress_is_determinate_only_when_a_total_is_available() {
        let start = Instant::now();
        let mut rate = DownloadRateEstimator::new();
        let known = DownloadProgress::from_transfer(512, Some(1024), &mut rate, start);
        let unknown =
            DownloadProgress::from_transfer(1024, None, &mut rate, start + Duration::from_secs(1));

        assert_eq!(known.percent, Some(50));
        assert_eq!(unknown.total, None);
        assert_eq!(unknown.percent, None);
        assert_eq!(unknown.speed, Some(512));
    }

    #[test]
    fn test_download_status_equality() {
        assert_eq!(DownloadStatus::Queued, DownloadStatus::Queued);
        assert_ne!(DownloadStatus::Queued, DownloadStatus::Downloading);
        assert_eq!(DownloadStatus::Completed, DownloadStatus::Completed);
    }

    #[test]
    fn test_download_manager_default() {
        let _dm = DownloadManager::default();
        // Construction without a panic is the behavior under test.
    }

    #[test]
    fn test_progress_percent_calculation() {
        // Test typical progress scenario
        let total: u64 = 1000;
        let downloaded: u64 = 250;
        let percent = (downloaded as f64 / total as f64 * 100.0) as u8;
        assert_eq!(percent, 25);
    }

    #[test]
    fn test_progress_percent_edge_cases() {
        // 0%
        let percent = (0f64 / 1000f64 * 100.0) as u8;
        assert_eq!(percent, 0);

        // 100%
        let percent = (1000f64 / 1000f64 * 100.0) as u8;
        assert_eq!(percent, 100);

        // Rounding
        let percent = (333f64 / 1000f64 * 100.0) as u8;
        assert_eq!(percent, 33);
    }
}
