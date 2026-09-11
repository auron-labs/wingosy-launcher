import CloudIcon from "@mui/icons-material/Cloud";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import * as Mui from "@mui/material";

import * as Components from "./settings-components";
import * as Shared from "./settings-view-shared";

/** @param {import("./settings-types").SettingsPanelProps} settings - Settings panel state and actions. */
export default function RommSettings(settings) {
  return (
    <>
  <Mui.Paper sx={Shared.SETTINGS_CARD_SX} data-testid="romm-settings-card">
    <Mui.Box
      sx={{ alignItems: "center", display: "flex", gap: 1, mb: 2 }}
    >
      <CloudIcon color="primary" />
      <Mui.Typography variant="h6">RomM Server</Mui.Typography>
    </Mui.Box>
    <Mui.TextField
      fullWidth
      label="Server URL"
      placeholder="romm.example.com or 192.168.1.2:3000"
      value={settings.rommUrl}
      onChange={(e) => {
        settings.setRommUrl(e.target.value);
      }}
      disabled={settings.rommUrlLocked}
      helperText={
        settings.rommUrlLocked
          ? "Connected. Disconnect before changing the server URL."
          : "Choose the RomM server Wingosy should connect to."
      }
      sx={{ mb: 2 }}
      size="small"
    />

    {/* Auth mode toggle */}
    <Mui.Box sx={{ mb: 2 }}>
      <Mui.Typography
        variant="body2"
        color="text.secondary"
        sx={{ mb: 1 }}
      >
        Authentication method
      </Mui.Typography>
      <Mui.ToggleButtonGroup
        value={settings.rommAuthMode}
        disabled={settings.rommSessionActive}
        exclusive
        onChange={(e, newMode) => {
          if (!newMode) {
            return;
          }
          settings.cancelDevicePairing();
          settings.setRommAuthMode(newMode);
        }}
        size="small"
        sx={{ mb: 2 }}
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

    {settings.rommAuthMode === "token" && (
      <Mui.Box sx={{ mb: 2 }}>
        <Mui.TextField
          fullWidth
          label="Device Name"
          value={settings.rommDeviceName}
          onChange={(e) => {
            settings.setRommDeviceName(e.target.value);
          }}
          size="small"
          sx={{ mb: 2 }}
          helperText={`Registered as wingosy-${(
            settings.rommDeviceName.trim() || "windows-pc"
          )
            .toLowerCase()
            .replaceAll(/\s+/g, "-")
            .replace(/^wingosy-/, "")}`}
        />
        <Mui.TextField
          fullWidth
          label="Access token"
          placeholder="Paste your RomM access token here"
          value={settings.rommDirectToken}
          onChange={(e) => {
            settings.setRommDirectToken(e.target.value);
          }}
          size="small"
          type="password"
        />
      </Mui.Box>
    )}

    <Mui.Box sx={{ display: "flex", gap: 2 }}>
      {!settings.rommSessionActive && (
        <Mui.Button
          variant="contained"
          onClick={settings.handleConnectRomM}
          disabled={
            !settings.rommUrl ||
            (settings.rommAuthMode === "token"
              ? !settings.rommDirectToken.trim()
              : Boolean(settings.rommPairing))
          }
        >
          {settings.rommPairing
            ? "Waiting for approval..."
            : settings.rommAuthMode === "pairing"
              ? "Pair with RomM"
              : "Connect"}
        </Mui.Button>
      )}
      {settings.rommPairing && (
        <Mui.Button variant="text" onClick={settings.cancelDevicePairing}>
          Cancel
        </Mui.Button>
      )}
      <Mui.Button
        variant="outlined"
        onClick={settings.handleSyncRomM}
        disabled={!settings.rommUrl}
      >
        Sync Library
      </Mui.Button>
      {settings.rommSessionActive && (
        <Mui.Button
          color="error"
          variant="outlined"
          onClick={() => {
            settings.setRommDisconnectDialogOpen(true);
          }}
        >
          Disconnect
        </Mui.Button>
      )}
    </Mui.Box>
    <Mui.Box data-testid="romm-sync-metadata" sx={{ mt: 3 }}>
      <Mui.Typography variant="subtitle2" sx={{ mb: 1 }}>
        Sync metadata
      </Mui.Typography>
      <Mui.Box
        sx={{
          display: "grid",
          gap: 1.5,
          gridTemplateColumns: {
            sm: "repeat(3, minmax(0, 1fr))",
            xs: "1fr",
          },
        }}
      >
        <Mui.Paper
          variant="outlined"
          sx={{ bgcolor: "action.hover", p: 1.5 }}
        >
          <Mui.Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block" }}
          >
            Last synced
          </Mui.Typography>
          <Mui.Typography
            variant="body2"
            data-testid="romm-last-synced-value"
          >
            {Shared.formatSyncTimestamp(settings.rommSyncMetadata.lastSyncedAt)}
          </Mui.Typography>
        </Mui.Paper>
        <Mui.Paper
          variant="outlined"
          sx={{ bgcolor: "action.hover", p: 1.5 }}
        >
          <Mui.Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block" }}
          >
            RomM library
          </Mui.Typography>
          <Mui.Typography
            variant="body2"
            data-testid="romm-library-count-value"
          >
            {Shared.formatSyncLibraryCount(settings.rommSyncMetadata.libraryCount)}
          </Mui.Typography>
        </Mui.Paper>
        <Mui.Paper
          variant="outlined"
          sx={{ bgcolor: "action.hover", p: 1.5 }}
        >
          <Mui.Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block" }}
          >
            Next scheduled sync
          </Mui.Typography>
          <Mui.Typography
            variant="body2"
            data-testid="romm-next-sync-value"
          >
            {settings.rommSyncMetadata.autoSync
              ? "Automatic (next run not reported)"
              : "Not scheduled"}
          </Mui.Typography>
        </Mui.Paper>
      </Mui.Box>
      <Mui.Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "block", mt: 1 }}
      >
        Values are shown from existing RomM configuration or the most
        recent manual sync in this session.
      </Mui.Typography>
    </Mui.Box>
    {settings.rommStatus && (
      <Mui.Alert severity={settings.rommStatus.type} sx={{ mt: 2 }}>
        {settings.rommStatus.message}
      </Mui.Alert>
    )}
  </Mui.Paper>
<Components.ConfirmDestructiveDialog
  open={settings.rommDisconnectDialogOpen}
  title="Disconnect from RomM?"
  message="Wingosy removes the saved RomM session from this device. Your library stays locally, and you can pair or connect again at any time."
  confirmLabel="Disconnect"
  onCancel={() => {
    settings.setRommDisconnectDialogOpen(false);
  }}
  onConfirm={() => {
    settings.setRommDisconnectDialogOpen(false);
    settings.handleDisconnectRomM();
  }}
/>
    </>
  );
}
