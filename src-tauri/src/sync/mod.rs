//! RomM save sync helpers (Argosy-compatible layouts where noted).
pub mod negotiation;
pub mod retroarch_romm;
pub mod switch_content;
pub mod switch_romm;
pub mod switch_save;

#[cfg(test)]
mod switch_save_roundtrip;

pub use switch_romm::{
    download_switch_save_to_eden, resume_switch_save_normal_sync, upload_switch_save_from_eden,
    SwitchSaveSyncResult,
};
