import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import * as Mui from "@mui/material";

import * as Components from "./settings-components";
import * as Shared from "./settings-view-shared";

/** @typedef {import("./settings-types").SettingsPanelProps} SettingsPanelProps */

/** @param {SettingsPanelProps} settings RomM settings. @returns {string} Connection button label. */
const getConnectLabel = (settings) => {
  if (settings.rommPairing !== null) {
    return "Waiting for approval...";
  }
  return settings.rommAuthMode === "pairing" ? "Pair with RomM" : "Connect";
};

/** @param {SettingsPanelProps} settings Server URL field properties. */
const RommServerUrlField = (settings) => (
  <Mui.TextField
    disabled={settings.rommUrlLocked}
    fullWidth
    helperText={
      settings.rommUrlLocked
        ? "Connected. Disconnect before changing the server URL."
        : "Choose the RomM server Wingosy should connect to."
    }
    label="Server URL"
    onChange={(event) => {
      settings.setRommUrl(event.target.value);
    }}
    placeholder="romm.example.com or 192.168.1.2:3000"
    size="small"
    sx={{ mb: 2 }}
    value={settings.rommUrl}
  />
);

/** @param {SettingsPanelProps} settings Authentication mode properties. */
const RommAuthModeField = (settings) => (
  <Mui.Box sx={{ mb: 2 }}>
    <Mui.Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
      Authentication method
    </Mui.Typography>
    <Mui.ToggleButtonGroup
      disabled={settings.rommSessionActive}
      exclusive
      onChange={(_event, newMode) => {
        if (newMode === null || newMode === "") {
          return;
        }
        settings.cancelDevicePairing();
        settings.setRommAuthMode(newMode);
      }}
      size="small"
      sx={{ mb: 2 }}
      value={settings.rommAuthMode}
    >
      <Mui.ToggleButton value="pairing" sx={{ px: 2 }}>
        <OpenInNewIcon sx={{ fontSize: 18, mr: 1 }} />
        Device pairing
      </Mui.ToggleButton>
      <Mui.ToggleButton value="token" sx={{ px: 2 }}>
        <VpnKeyIcon sx={{ fontSize: 18, mr: 1 }} />
        Access token
      </Mui.ToggleButton>
    </Mui.ToggleButtonGroup>
    <Mui.Typography
      variant="body2"
      color="text.secondary"
      sx={{ maxWidth: 640 }}
    >
      {settings.rommAuthMode === "pairing"
        ? "Secure device pairing opens RomM in your browser. Wingosy never receives or stores your password."
        : "Use a RomM access token for this device. The token is stored securely and never shown again after connecting."}
    </Mui.Typography>
  </Mui.Box>
);

/** @param {SettingsPanelProps} settings Token fields properties. */
const RommTokenFields = (settings) => {
  if (settings.rommAuthMode !== "token") {
    return null;
  }
  const deviceName = settings.rommDeviceName.trim() || "windows-pc";
  const deviceSlug = deviceName
    .toLowerCase()
    .replaceAll(/\s+/gu, "-")
    .replace(/^wingosy-/u, "");
  return (
    <Mui.Box sx={{ mb: 2 }}>
      <Mui.TextField
        fullWidth
        helperText={`Registered as wingosy-${deviceSlug}`}
        label="Device Name"
        onChange={(event) => {
          settings.setRommDeviceName(event.target.value);
        }}
        size="small"
        sx={{ mb: 2 }}
        value={settings.rommDeviceName}
      />
      <Mui.TextField
        fullWidth
        label="Access token"
        onChange={(event) => {
          settings.setRommDirectToken(event.target.value);
        }}
        placeholder="Paste your RomM access token here"
        size="small"
        type="password"
        value={settings.rommDirectToken}
      />
    </Mui.Box>
  );
};

/** @param {SettingsPanelProps} settings RomM authentication properties. */
const RommAuthenticationFields = (settings) => (
  <>
    <RommServerUrlField {...settings} />
    <RommAuthModeField {...settings} />
    <RommTokenFields {...settings} />
  </>
);

/** @param {SettingsPanelProps} settings Connect button properties. */
const RommConnectButton = (settings) => {
  if (settings.rommSessionActive) {
    return null;
  }
  const pairingActive = settings.rommPairing !== null;
  const canConnect =
    settings.rommUrl !== "" &&
    (settings.rommAuthMode !== "token" ||
      settings.rommDirectToken.trim() !== "") &&
    (settings.rommAuthMode === "token" || !pairingActive);
  return (
    <Mui.Button
      disabled={!canConnect}
      onClick={settings.handleConnectRomM}
      variant="contained"
    >
      {getConnectLabel(settings)}
    </Mui.Button>
  );
};

/** @param {SettingsPanelProps} settings RomM connection controls. */
const RommConnectionControls = (settings) => {
  const pairingActive = settings.rommPairing !== null;
  return (
    <Mui.Box sx={{ display: "flex", gap: 2 }}>
      <RommConnectButton {...settings} />
      {pairingActive ? (
        <Mui.Button
          onClick={() => {
            settings.cancelDevicePairing();
          }}
          variant="text"
        >
          Cancel
        </Mui.Button>
      ) : null}
      <Mui.Button
        disabled={settings.rommUrl === ""}
        onClick={settings.handleSyncRomM}
        variant="outlined"
      >
        Sync Library
      </Mui.Button>
      {settings.rommSessionActive ? (
        <Mui.Button
          color="error"
          onClick={() => {
            settings.setRommDisconnectDialogOpen(true);
          }}
          variant="outlined"
        >
          Disconnect
        </Mui.Button>
      ) : null}
    </Mui.Box>
  );
};

/** @param {SettingsPanelProps} settings RomM sync metadata. */
const RommSyncMetadata = (settings) => (
  <Mui.Box data-testid="romm-sync-metadata" sx={{ mt: 3 }}>
    <Mui.Typography variant="subtitle2" sx={{ mb: 1 }}>
      Sync metadata
    </Mui.Typography>
    <Mui.Box
      sx={{
        display: "grid",
        gap: 1.5,
        gridTemplateColumns: { sm: "repeat(3, minmax(0, 1fr))", xs: "1fr" },
      }}
    >
      <Components.SettingsStatTile
        label="Last synced"
        testId="romm-last-synced-value"
        value={Shared.formatSyncTimestamp(
          settings.rommSyncMetadata.lastSyncedAt
        )}
      />
      <Components.SettingsStatTile
        label="RomM library"
        testId="romm-library-count-value"
        value={Shared.formatSyncLibraryCount(
          settings.rommSyncMetadata.libraryCount
        )}
      />
      <Components.SettingsStatTile
        label="Next scheduled sync"
        testId="romm-next-sync-value"
        value={
          settings.rommSyncMetadata.autoSync
            ? "Automatic (next run not reported)"
            : "Not scheduled"
        }
      />
    </Mui.Box>
    <Mui.Typography
      variant="caption"
      color="text.secondary"
      sx={{ display: "block", mt: 1 }}
    >
      Values are shown from existing RomM configuration or the most recent
      manual sync in this session.
    </Mui.Typography>
  </Mui.Box>
);

/** @param {SettingsPanelProps} settings RomM settings. */
const RommSettings = (settings) => (
  <>
    <Components.SettingsCard
      data-testid="romm-settings-card"
      title="Connection"
    >
      <RommAuthenticationFields {...settings} />
      <RommConnectionControls {...settings} />
      <RommSyncMetadata {...settings} />
      {settings.rommStatus === null ? null : (
        <Mui.Alert severity={settings.rommStatus.type} sx={{ mt: 2 }}>
          {settings.rommStatus.message}
        </Mui.Alert>
      )}
    </Components.SettingsCard>
    <Components.ConfirmDestructiveDialog
      confirmLabel="Disconnect"
      message="Wingosy removes the saved RomM session from this device. Your library stays locally, and you can pair or connect again at any time."
      onCancel={() => {
        settings.setRommDisconnectDialogOpen(false);
      }}
      onConfirm={() => {
        settings.setRommDisconnectDialogOpen(false);
        settings.handleDisconnectRomM();
      }}
      open={settings.rommDisconnectDialogOpen}
      title="Disconnect from RomM?"
    />
  </>
);

export default RommSettings;
