use anyhow::Result;

#[cfg(target_os = "windows")]
use anyhow::Context;

const ROMM_CREDENTIAL_SERVICE: &str = "com.wingosy.launcher.romm.refresh-token";
const ROMM_DEVICE_TOKEN_SERVICE: &str = "com.wingosy.launcher.romm.device-token";

fn credential_username(server_url: &str, username: &str) -> String {
    format!(
        "{}|{}",
        server_url.trim().trim_end_matches('/'),
        username.trim()
    )
}

#[cfg(target_os = "windows")]
pub fn store_refresh_token(server_url: &str, username: &str, refresh_token: &str) -> Result<()> {
    let entry = keyring::v1::Entry::new(
        ROMM_CREDENTIAL_SERVICE,
        &credential_username(server_url, username),
    )
    .context("Failed to open Windows Credential Manager")?;
    entry
        .set_password(refresh_token)
        .context("Failed to save the RomM refresh token in Windows Credential Manager")
}

#[cfg(target_os = "windows")]
pub fn load_refresh_token(server_url: &str, username: &str) -> Result<Option<String>> {
    let entry = keyring::v1::Entry::new(
        ROMM_CREDENTIAL_SERVICE,
        &credential_username(server_url, username),
    )
    .context("Failed to open Windows Credential Manager")?;
    match entry.get_password() {
        Ok(password) => Ok(Some(password)),
        Err(keyring::v1::Error::NoEntry) => Ok(None),
        Err(error) => Err(error)
            .context("Failed to read the RomM refresh token from Windows Credential Manager"),
    }
}

#[cfg(target_os = "windows")]
pub fn delete_refresh_token(server_url: &str, username: &str) -> Result<()> {
    let entry = keyring::v1::Entry::new(
        ROMM_CREDENTIAL_SERVICE,
        &credential_username(server_url, username),
    )
    .context("Failed to open Windows Credential Manager")?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::v1::Error::NoEntry) => Ok(()),
        Err(error) => Err(error)
            .context("Failed to remove the RomM refresh token from Windows Credential Manager"),
    }
}

#[cfg(target_os = "windows")]
pub fn store_device_token(server_url: &str, token: &str) -> Result<()> {
    let entry = keyring::v1::Entry::new(
        ROMM_DEVICE_TOKEN_SERVICE,
        server_url.trim().trim_end_matches('/'),
    )
    .context("Failed to open Windows Credential Manager")?;
    entry
        .set_password(token)
        .context("Failed to save the RomM device token in Windows Credential Manager")
}

#[cfg(target_os = "windows")]
pub fn load_device_token(server_url: &str) -> Result<Option<String>> {
    let entry = keyring::v1::Entry::new(
        ROMM_DEVICE_TOKEN_SERVICE,
        server_url.trim().trim_end_matches('/'),
    )
    .context("Failed to open Windows Credential Manager")?;
    match entry.get_password() {
        Ok(token) => Ok(Some(token)),
        Err(keyring::v1::Error::NoEntry) => Ok(None),
        Err(error) => Err(error)
            .context("Failed to read the RomM device token from Windows Credential Manager"),
    }
}

#[cfg(target_os = "windows")]
pub fn delete_device_token(server_url: &str) -> Result<()> {
    let entry = keyring::v1::Entry::new(
        ROMM_DEVICE_TOKEN_SERVICE,
        server_url.trim().trim_end_matches('/'),
    )
    .context("Failed to open Windows Credential Manager")?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::v1::Error::NoEntry) => Ok(()),
        Err(error) => Err(error)
            .context("Failed to remove the RomM device token from Windows Credential Manager"),
    }
}

#[cfg(not(target_os = "windows"))]
pub fn store_refresh_token(_server_url: &str, _username: &str, _refresh_token: &str) -> Result<()> {
    anyhow::bail!("Secure RomM session storage is currently available on Windows only")
}

#[cfg(not(target_os = "windows"))]
pub fn load_refresh_token(_server_url: &str, _username: &str) -> Result<Option<String>> {
    Ok(None)
}

#[cfg(not(target_os = "windows"))]
pub fn delete_refresh_token(_server_url: &str, _username: &str) -> Result<()> {
    Ok(())
}

#[cfg(not(target_os = "windows"))]
pub fn store_device_token(_server_url: &str, _token: &str) -> Result<()> {
    anyhow::bail!("Secure RomM device storage is currently available on Windows only")
}

#[cfg(not(target_os = "windows"))]
pub fn load_device_token(_server_url: &str) -> Result<Option<String>> {
    Ok(None)
}

#[cfg(not(target_os = "windows"))]
pub fn delete_device_token(_server_url: &str) -> Result<()> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn credential_key_normalizes_server_but_preserves_username() {
        assert_eq!(
            credential_username(" HTTPS://RomM.Example/ ", " PlayerOne "),
            "HTTPS://RomM.Example|PlayerOne"
        );
    }
}
