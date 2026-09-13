use std::time::SystemTime;

use crate::api::{ClientSaveState, SyncNegotiateResponse, SyncOperation};

pub fn client_save_state(
    rom_id: i32,
    file_name: String,
    slot: String,
    emulator: &str,
    bytes: &[u8],
    modified: SystemTime,
) -> ClientSaveState {
    let updated_at: chrono::DateTime<chrono::Utc> = modified.into();
    ClientSaveState {
        rom_id,
        file_name,
        slot: Some(slot),
        emulator: Some(emulator.to_string()),
        content_hash: Some(format!("{:x}", md5::compute(bytes))),
        updated_at: updated_at.to_rfc3339(),
        file_size_bytes: bytes.len() as u64,
    }
}

pub fn operation_for<'a>(
    response: &'a SyncNegotiateResponse,
    rom_id: i32,
    slot: &str,
) -> Option<&'a SyncOperation> {
    response.operations.iter().find(|operation| {
        operation.rom_id == rom_id
            && operation
                .slot
                .as_deref()
                .map(|value| value.eq_ignore_ascii_case(slot))
                .unwrap_or(false)
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn client_state_uses_romm_md5_hash() {
        let state = client_save_state(
            7,
            "game.srm".to_string(),
            "autosave".to_string(),
            "retroarch",
            b"save",
            SystemTime::UNIX_EPOCH,
        );
        assert_eq!(
            state.content_hash.as_deref(),
            Some("43781db5c40ecc39fd718685594f0956")
        );
        assert_eq!(state.file_size_bytes, 4);
    }
}
