use anyhow::{bail, Context, Result};
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};

use super::Database;
use crate::api::RomMSave;

/// A local Eden save set held at an explicitly restored server revision until
/// its contents meaningfully change or the protection is explicitly cleared.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EdenRestoreProtection {
    pub game_id: i64,
    /// Identifies the local save set whose automatic autosave channel is protected.
    pub save_set: String,
    pub selected_revision: RomMSave,
    /// Content-derived fingerprint of the restored local save set.
    pub baseline_fingerprint: String,
}

impl Database {
    pub fn set_eden_restore_protection(&self, protection: &EdenRestoreProtection) -> Result<()> {
        validate_protection(protection)?;

        let revision = &protection.selected_revision;
        let conn = self.conn.lock().unwrap();
        conn.execute(
            r#"
            INSERT INTO eden_restore_protections (
                game_id, save_set, revision_id, revision_rom_id, revision_file_name,
                revision_file_size_bytes, revision_emulator, revision_created_at,
                revision_updated_at, revision_slot, baseline_fingerprint
            ) VALUES (
                ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11
            ) ON CONFLICT(game_id, save_set) DO UPDATE SET
                revision_id = excluded.revision_id,
                revision_rom_id = excluded.revision_rom_id,
                revision_file_name = excluded.revision_file_name,
                revision_file_size_bytes = excluded.revision_file_size_bytes,
                revision_emulator = excluded.revision_emulator,
                revision_created_at = excluded.revision_created_at,
                revision_updated_at = excluded.revision_updated_at,
                revision_slot = excluded.revision_slot,
                baseline_fingerprint = excluded.baseline_fingerprint,
                updated_at = CURRENT_TIMESTAMP
            "#,
            params![
                protection.game_id,
                protection.save_set,
                revision.id,
                revision.rom_id,
                revision.file_name,
                revision.file_size_bytes,
                revision.emulator,
                revision.created_at,
                revision.updated_at,
                revision.slot,
                protection.baseline_fingerprint,
            ],
        )
        .context("Failed to save Eden restore protection")?;

        Ok(())
    }

    pub fn get_eden_restore_protection(
        &self,
        game_id: i64,
        save_set: &str,
    ) -> Result<Option<EdenRestoreProtection>> {
        let conn = self.conn.lock().unwrap();
        conn.query_row(
            r#"
            SELECT
                revision_id, revision_rom_id, revision_file_name, revision_file_size_bytes,
                revision_emulator, revision_created_at, revision_updated_at, revision_slot,
                baseline_fingerprint
            FROM eden_restore_protections
            WHERE game_id = ?1 AND save_set = ?2
            "#,
            params![game_id, save_set],
            |row| {
                Ok(EdenRestoreProtection {
                    game_id,
                    save_set: save_set.to_string(),
                    selected_revision: RomMSave {
                        id: row.get(0)?,
                        rom_id: row.get(1)?,
                        file_name: row.get(2)?,
                        file_size_bytes: row.get(3)?,
                        emulator: row.get(4)?,
                        created_at: row.get(5)?,
                        updated_at: row.get(6)?,
                        slot: row.get(7)?,
                    },
                    baseline_fingerprint: row.get(8)?,
                })
            },
        )
        .optional()
        .context("Failed to read Eden restore protection")
    }

    pub fn clear_eden_restore_protection(&self, game_id: i64, save_set: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "DELETE FROM eden_restore_protections WHERE game_id = ?1 AND save_set = ?2",
            params![game_id, save_set],
        )
        .context("Failed to clear Eden restore protection")?;

        Ok(())
    }
}

fn validate_protection(protection: &EdenRestoreProtection) -> Result<()> {
    if protection.save_set.trim().is_empty() {
        bail!("Eden restore protection save set cannot be empty");
    }
    if protection.baseline_fingerprint.trim().is_empty() {
        bail!("Eden restore protection baseline fingerprint cannot be empty");
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn protection(revision_id: i32, baseline_fingerprint: &str) -> EdenRestoreProtection {
        EdenRestoreProtection {
            game_id: 42,
            save_set: "autosave".to_string(),
            selected_revision: RomMSave {
                id: revision_id,
                rom_id: 7,
                file_name: format!("save-{revision_id}.zip"),
                file_size_bytes: 1024 + i64::from(revision_id),
                emulator: Some("eden".to_string()),
                created_at: "2026-09-18T10:00:00Z".to_string(),
                updated_at: format!("2026-09-18T10:00:{revision_id:02}Z"),
                slot: Some(format!("slot-{revision_id}")),
            },
            baseline_fingerprint: baseline_fingerprint.to_string(),
        }
    }

    fn insert_game(db: &Database) {
        let conn = db.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO platforms (id, name, extensions) VALUES ('switch', 'Switch', 'nsp')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO games (id, platform_id, name, file_path) VALUES (42, 'switch', 'Game', 'game.nsp')",
            [],
        )
        .unwrap();
    }

    #[test]
    fn eden_restore_protection_updates_clears_and_survives_reopen() {
        let temp = TempDir::new().unwrap();
        let path = temp.path().join("wingosy.db");
        let first = protection(1, "sha256:before");

        let db = Database::open_at(&path).unwrap();
        insert_game(&db);
        db.set_eden_restore_protection(&first).unwrap();
        drop(db);

        let db = Database::open_at(&path).unwrap();
        let persisted = db
            .get_eden_restore_protection(42, "autosave")
            .unwrap()
            .unwrap();
        assert_eq!(persisted.selected_revision.id, 1);
        assert_eq!(persisted.selected_revision.rom_id, 7);
        assert_eq!(persisted.selected_revision.file_name, "save-1.zip");
        assert_eq!(persisted.selected_revision.file_size_bytes, 1025);
        assert_eq!(
            persisted.selected_revision.emulator.as_deref(),
            Some("eden")
        );
        assert_eq!(
            persisted.selected_revision.created_at,
            "2026-09-18T10:00:00Z"
        );
        assert_eq!(
            persisted.selected_revision.updated_at,
            "2026-09-18T10:00:01Z"
        );
        assert_eq!(persisted.selected_revision.slot.as_deref(), Some("slot-1"));
        assert_eq!(persisted.baseline_fingerprint, "sha256:before");

        db.set_eden_restore_protection(&protection(2, "sha256:after"))
            .unwrap();
        drop(db);

        let db = Database::open_at(&path).unwrap();
        let updated = db
            .get_eden_restore_protection(42, "autosave")
            .unwrap()
            .unwrap();
        assert_eq!(updated.selected_revision.id, 2);
        assert_eq!(updated.baseline_fingerprint, "sha256:after");

        db.clear_eden_restore_protection(42, "autosave").unwrap();
        assert!(db
            .get_eden_restore_protection(42, "autosave")
            .unwrap()
            .is_none());
    }
}
