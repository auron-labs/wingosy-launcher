use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub enum SyncState {
    #[default]
    LocalOnly,
    Synced,
    PendingUpload,
    PendingDownload,
    Conflict,
    RemoteOnly,
}

impl SyncState {
    pub fn to_db_str(self) -> &'static str {
        match self {
            SyncState::LocalOnly => "local_only",
            SyncState::Synced => "synced",
            SyncState::PendingUpload => "pending_upload",
            SyncState::PendingDownload => "pending_download",
            SyncState::Conflict => "conflict",
            SyncState::RemoteOnly => "remote_only",
        }
    }

    pub fn from_db_str(s: &str) -> Self {
        match s {
            "synced" => SyncState::Synced,
            "pending_upload" => SyncState::PendingUpload,
            "pending_download" => SyncState::PendingDownload,
            "conflict" => SyncState::Conflict,
            "remote_only" => SyncState::RemoteOnly,
            _ => SyncState::LocalOnly,
        }
    }

    pub fn icon(&self) -> &'static str {
        match self {
            SyncState::LocalOnly => "💾",
            SyncState::Synced => "✅",
            SyncState::PendingUpload => "⬆️",
            SyncState::PendingDownload => "⬇️",
            SyncState::Conflict => "⚠️",
            SyncState::RemoteOnly => "☁️",
        }
    }

    pub fn description(&self) -> &'static str {
        match self {
            SyncState::LocalOnly => "Local only",
            SyncState::Synced => "Synced",
            SyncState::PendingUpload => "Pending upload",
            SyncState::PendingDownload => "Pending download",
            SyncState::Conflict => "Sync conflict",
            SyncState::RemoteOnly => "Remote only",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SyncStatus {
    pub last_sync: Option<chrono::DateTime<chrono::Utc>>,
    pub pending_uploads: i32,
    pub pending_downloads: i32,
    pub conflicts: i32,
    pub is_syncing: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaveFile {
    pub id: i64,
    pub game_id: i64,
    pub emulator_id: String,
    pub file_name: String,
    pub local_path: Option<String>,
    pub remote_path: Option<String>,
    pub local_modified: Option<chrono::DateTime<chrono::Utc>>,
    pub remote_modified: Option<chrono::DateTime<chrono::Utc>>,
    pub sync_state: SyncState,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sync_state_roundtrip_all_variants() {
        let variants = [
            SyncState::LocalOnly,
            SyncState::Synced,
            SyncState::PendingUpload,
            SyncState::PendingDownload,
            SyncState::Conflict,
            SyncState::RemoteOnly,
        ];
        for variant in &variants {
            let s = variant.to_db_str();
            let roundtripped = SyncState::from_db_str(s);
            assert_eq!(*variant, roundtripped);
        }
    }

    #[test]
    fn sync_state_unknown_defaults_to_local_only() {
        assert_eq!(SyncState::from_db_str("garbage"), SyncState::LocalOnly);
        assert_eq!(SyncState::from_db_str(""), SyncState::LocalOnly);
        assert_eq!(SyncState::from_db_str("remoteonly"), SyncState::LocalOnly);
    }

    #[test]
    fn sync_state_db_strings_use_underscores() {
        assert_eq!(SyncState::RemoteOnly.to_db_str(), "remote_only");
        assert_eq!(SyncState::PendingUpload.to_db_str(), "pending_upload");
        assert_eq!(SyncState::PendingDownload.to_db_str(), "pending_download");
        assert_eq!(SyncState::LocalOnly.to_db_str(), "local_only");
    }

    #[test]
    fn sync_state_icons_are_emoji() {
        // Icons should be non-empty and valid display characters
        assert!(!SyncState::LocalOnly.icon().is_empty());
        assert!(!SyncState::Synced.icon().is_empty());
        assert!(!SyncState::RemoteOnly.icon().is_empty());
        assert!(!SyncState::Conflict.icon().is_empty());
    }

    #[test]
    fn sync_state_descriptions_are_readable() {
        assert_eq!(SyncState::LocalOnly.description(), "Local only");
        assert_eq!(SyncState::Synced.description(), "Synced");
        assert_eq!(SyncState::RemoteOnly.description(), "Remote only");
        assert_eq!(SyncState::Conflict.description(), "Sync conflict");
        assert_eq!(SyncState::PendingUpload.description(), "Pending upload");
        assert_eq!(SyncState::PendingDownload.description(), "Pending download");
    }

    #[test]
    fn sync_status_default_is_not_syncing() {
        let status = SyncStatus::default();
        assert!(!status.is_syncing);
        assert!(status.last_sync.is_none());
        assert_eq!(status.pending_uploads, 0);
        assert_eq!(status.pending_downloads, 0);
        assert_eq!(status.conflicts, 0);
    }

    #[test]
    fn sync_state_default_is_local_only() {
        let state = SyncState::default();
        assert_eq!(state, SyncState::LocalOnly);
    }
}
