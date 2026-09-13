use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubRelease {
    pub tag_name: String,
    pub name: Option<String>,
    pub assets: Vec<GitHubAsset>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubAsset {
    pub name: String,
    pub browser_download_url: String,
    pub size: i64,
    pub content_type: Option<String>,
}

async fn fetch_latest_release_inner(url: &str, api_label: &str) -> Result<GitHubRelease> {
    let client = reqwest::Client::builder()
        .user_agent("wingosy-launcher/0.1")
        .build()?;
    let resp = client
        .get(url)
        .send()
        .await
        .with_context(|| format!("Failed to reach {}", api_label))?;
    let status = resp.status();
    if !status.is_success() {
        let text = resp.text().await.unwrap_or_default();
        anyhow::bail!(
            "{} API returned {}: {}",
            api_label,
            status,
            &text[..text.len().min(200)]
        );
    }
    resp.json()
        .await
        .with_context(|| format!("Failed to parse {} release JSON", api_label))
}

/// `repo` is `owner/name` as on github.com (e.g. `hrydgard/ppsspp`).
pub async fn fetch_latest_release(repo: &str) -> Result<GitHubRelease> {
    let url = format!("https://api.github.com/repos/{}/releases/latest", repo);
    fetch_latest_release_inner(&url, "GitHub").await
}

/// Forgejo/Gitea-compatible host (e.g. `https://git.eden-emu.dev`) plus `owner` and repo name.
pub async fn fetch_forgejo_latest_release(
    api_origin: &str,
    owner: &str,
    repo_name: &str,
) -> Result<GitHubRelease> {
    let origin = api_origin.trim_end_matches('/');
    let url = format!(
        "{}/api/v1/repos/{}/{}/releases/latest",
        origin, owner, repo_name
    );
    fetch_latest_release_inner(&url, "Forgejo").await
}

pub fn find_matching_asset<'a>(
    release: &'a GitHubRelease,
    pattern: &str,
) -> Option<&'a GitHubAsset> {
    let re = regex_lite::Regex::new(pattern).ok()?;
    release.assets.iter().find(|a| re.is_match(&a.name))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn mock_release() -> GitHubRelease {
        GitHubRelease {
            tag_name: "v1.0.0".into(),
            name: Some("Release 1.0".into()),
            assets: vec![
                GitHubAsset {
                    name: "ppsspp-v1.17-windows-x64.zip".into(),
                    browser_download_url: "https://example.com/ppsspp.zip".into(),
                    size: 50000000,
                    content_type: None,
                },
                GitHubAsset {
                    name: "ppsspp-v1.17-linux-x64.tar.gz".into(),
                    browser_download_url: "https://example.com/ppsspp.tar.gz".into(),
                    size: 45000000,
                    content_type: None,
                },
                GitHubAsset {
                    name: "ppsspp-v1.17-macos-arm64.dmg".into(),
                    browser_download_url: "https://example.com/ppsspp.dmg".into(),
                    size: 48000000,
                    content_type: None,
                },
                GitHubAsset {
                    name: "Source.zip".into(),
                    browser_download_url: "https://example.com/source.zip".into(),
                    size: 1000000,
                    content_type: None,
                },
            ],
        }
    }

    #[test]
    fn matches_windows_asset() {
        let release = mock_release();
        let asset = find_matching_asset(&release, "(?i)ppsspp.*windows.*x64.*\\.zip$");
        assert!(asset.is_some());
        assert!(asset.unwrap().name.contains("windows"));
    }

    #[test]
    fn skips_non_matching_assets() {
        let release = mock_release();
        let asset = find_matching_asset(&release, "(?i)ppsspp.*android.*\\.apk$");
        assert!(asset.is_none());
    }

    #[test]
    fn pattern_is_case_insensitive() {
        let release = GitHubRelease {
            tag_name: "v1.0".into(),
            name: None,
            assets: vec![GitHubAsset {
                name: "Dolphin-x64-Setup.7z".into(),
                browser_download_url: "https://example.com/d.7z".into(),
                size: 100,
                content_type: None,
            }],
        };
        let asset = find_matching_asset(&release, "(?i)dolphin.*x64.*\\.7z$");
        assert!(asset.is_some());
    }

    #[test]
    fn invalid_regex_returns_none() {
        let release = mock_release();
        // Invalid regex with unclosed bracket
        let asset = find_matching_asset(&release, "(?i)ppsspp[");
        assert!(asset.is_none());
    }

    #[test]
    fn empty_assets_returns_none() {
        let release = GitHubRelease {
            tag_name: "v1.0".into(),
            name: None,
            assets: vec![],
        };
        let asset = find_matching_asset(&release, ".*\\.zip$");
        assert!(asset.is_none());
    }

    #[test]
    fn returns_first_match() {
        let release = GitHubRelease {
            tag_name: "v1.0".into(),
            name: None,
            assets: vec![
                GitHubAsset {
                    name: "app-win32.zip".into(),
                    browser_download_url: "https://a.com/1".into(),
                    size: 100,
                    content_type: None,
                },
                GitHubAsset {
                    name: "app-win64.zip".into(),
                    browser_download_url: "https://a.com/2".into(),
                    size: 200,
                    content_type: None,
                },
            ],
        };
        let asset = find_matching_asset(&release, ".*\\.zip$");
        assert!(asset.is_some());
        assert_eq!(asset.unwrap().name, "app-win32.zip"); // First match
    }

    #[test]
    fn asset_size_is_preserved() {
        let release = mock_release();
        let asset = find_matching_asset(&release, "(?i)ppsspp.*windows.*x64.*\\.zip$").unwrap();
        assert_eq!(asset.size, 50000000);
    }

    #[test]
    fn asset_url_is_preserved() {
        let release = mock_release();
        let asset = find_matching_asset(&release, "(?i)ppsspp.*windows.*x64.*\\.zip$").unwrap();
        assert_eq!(asset.browser_download_url, "https://example.com/ppsspp.zip");
    }

    #[test]
    fn matches_mgba_pattern() {
        let release = GitHubRelease {
            tag_name: "0.10.3".into(),
            name: Some("mGBA 0.10.3".into()),
            assets: vec![
                GitHubAsset {
                    name: "mGBA-0.10.3-win64.7z".into(),
                    browser_download_url: "https://a.com/mgba.7z".into(),
                    size: 100,
                    content_type: None,
                },
                GitHubAsset {
                    name: "mGBA-0.10.3-ubuntu.tar.xz".into(),
                    browser_download_url: "https://a.com/mgba.tar.xz".into(),
                    size: 100,
                    content_type: None,
                },
            ],
        };
        let asset = find_matching_asset(&release, "(?i)mGBA.*win64.*\\.7z$");
        assert!(asset.is_some());
        assert!(asset.unwrap().name.contains("win64"));
    }

    #[test]
    fn matches_pcsx2_pattern() {
        let release = GitHubRelease {
            tag_name: "v1.7.5".into(),
            name: None,
            assets: vec![GitHubAsset {
                name: "pcsx2-v1.7.5-windows-x64-Qt.7z".into(),
                browser_download_url: "https://a.com/pcsx2.7z".into(),
                size: 100,
                content_type: None,
            }],
        };
        let asset = find_matching_asset(&release, "(?i)pcsx2.*windows.*x64.*\\.7z$");
        assert!(asset.is_some());
    }

    #[test]
    fn skips_source_archives() {
        let release = mock_release();
        // Pattern that should match zip but not Source.zip
        let asset = find_matching_asset(&release, "(?i)ppsspp.*\\.zip$");
        assert!(asset.is_some());
        assert!(!asset.unwrap().name.starts_with("Source"));
    }
}
