import DriveFileMoveIcon from "@mui/icons-material/DriveFileMove";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import * as Mui from "@mui/material";

import { formatStorageBytes } from "./settingsPresentation";
import * as Components from "./settings-components";
import * as Shared from "./settings-view-shared";

/** @param {import("./settings-types").SettingsPanelProps} settings - Settings panel state and actions. */
export default function SettingsDialogs(settings) {
  return (
    <>
      <Mui.Dialog
        open={settings.storageMigrationDialogOpen}
        onClose={() =>
!settings.storageChangeBusy && settings.setStorageMigrationDialogOpen(false)
        }
        maxWidth="sm"
        fullWidth
      >
        <Mui.DialogTitle>
<Mui.Box sx={{ alignItems: "center", display: "flex", gap: 1 }}>
  <DriveFileMoveIcon />
  Move existing ROMs?
</Mui.Box>
        </Mui.DialogTitle>
        <Mui.DialogContent>
<Mui.Typography variant="body2" sx={{ mb: 2 }}>
  Wingosy found{" "}
  <strong>{settings.storageOverview?.migratable_rom_count || 0}</strong>{" "}
  tracked game
  {(settings.storageOverview?.migratable_rom_count || 0) === 1 ? "" : "s"} (
  {formatStorageBytes(settings.storageOverview?.migratable_rom_bytes)}) in the
  current ROM folder.
</Mui.Typography>
<Mui.Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
  <strong>Migrate ROMs</strong> copies each game into the new folder,
  updates its library path, and removes the old copy only after the
  database update succeeds. Existing destination files are never
  overwritten.
</Mui.Typography>
<Mui.Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
  <strong>Don&apos;t migrate</strong> leaves existing games where they
  are and sends future downloads to the new folder. Those existing
  games remain launchable from their saved paths.
</Mui.Typography>
<Mui.Box sx={{ bgcolor: "action.hover", borderRadius: 2, p: 1.5 }}>
  <Mui.Typography variant="caption" color="text.secondary">
    New ROM folder
  </Mui.Typography>
  <Mui.Typography
    variant="body2"
    sx={{ fontFamily: "monospace", overflowWrap: "anywhere" }}
  >
    {settings.pendingRomsDirectory}
  </Mui.Typography>
</Mui.Box>
{settings.storageChangeBusy && (
  <Mui.LinearProgress sx={{ borderRadius: 1, mt: 2 }} />
)}
{settings.activeRomDownloadCount > 0 && (
  <Mui.Alert severity="warning" sx={{ mt: 2 }}>
    Wait for {settings.activeRomDownloadCount} active ROM download
    {settings.activeRomDownloadCount === 1 ? "" : "s"} to finish before
    changing storage.
  </Mui.Alert>
)}
        </Mui.DialogContent>
        <Mui.DialogActions sx={{ flexWrap: "wrap" }}>
<Mui.Button
  onClick={() => {
    settings.setStorageMigrationDialogOpen(false);
    settings.setPendingRomsDirectory("");
  }}
  disabled={settings.storageChangeBusy}
>
  Cancel
</Mui.Button>
<Mui.Button
  variant="outlined"
  onClick={async () =>
    settings.applyRomsDirectoryChange(settings.pendingRomsDirectory, false)
  }
  disabled={settings.storageChangeBusy || settings.activeRomDownloadCount > 0}
>
  Don&apos;t migrate
</Mui.Button>
<Mui.Button
  variant="contained"
  startIcon={<DriveFileMoveIcon />}
  onClick={async () =>
    settings.applyRomsDirectoryChange(settings.pendingRomsDirectory, true)
  }
  disabled={settings.storageChangeBusy || settings.activeRomDownloadCount > 0}
>
  Migrate ROMs
</Mui.Button>
        </Mui.DialogActions>
      </Mui.Dialog>

      <Mui.Dialog
        open={settings.prereleaseLeaveDialogOpen}
        onClose={settings.cancelPrereleaseLeave}
        maxWidth="sm"
        fullWidth
      >
        <Mui.DialogTitle>
{settings.leavingPrereleaseChannel === "beta"
  ? "Leave the Beta channel?"
  : "Leave the Nightly channel?"}
        </Mui.DialogTitle>
        <Mui.DialogContent>
<Mui.Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
  You’re switching away from{" "}
  <strong>
    {settings.leavingPrereleaseChannel === "beta" ? "Beta" : "Nightly"}
  </strong>
  . Your update checks will follow the{" "}
  <strong>
    {settings.pendingChannel === "stable"
      ? "Stable"
      : settings.pendingChannel === "beta"
        ? "Beta"
        : "Nightly"}
  </strong>{" "}
  channel.
</Mui.Typography>
<Mui.Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
  {settings.pendingChannel === "stable" && (
    <>
      On <strong>Stable</strong>, in-app updates follow regular
      releases.{" "}
    </>
  )}
  If you want the <strong>latest stable build immediately</strong>{" "}
  (for example, to leave beta or nightly sooner than the next stable
  release), download and install it manually from{" "}
  <Mui.Box component="span" sx={{ fontWeight: 600 }}>
    GitHub Releases
  </Mui.Box>{" "}
  — the app does not downgrade by itself.
</Mui.Typography>
        </Mui.DialogContent>
        <Mui.DialogActions>
<Mui.Button onClick={settings.cancelPrereleaseLeave}>Cancel</Mui.Button>
<Mui.Button variant="contained" onClick={settings.confirmPrereleaseLeave}>
  Continue
</Mui.Button>
        </Mui.DialogActions>
      </Mui.Dialog>

      {/* Hidden Games Dialog */}
      <Mui.Dialog
        open={settings.hiddenDialogOpen}
        onClose={() => {
settings.setHiddenDialogOpen(false);
        }}
        maxWidth="sm"
        fullWidth
      >
        <Mui.DialogTitle>
<Mui.Box sx={{ alignItems: "center", display: "flex", gap: 1 }}>
  <VisibilityOffIcon />
  Hidden Games
</Mui.Box>
        </Mui.DialogTitle>
        <Mui.DialogContent>
{settings.hiddenLoading ? (
  <Mui.LinearProgress sx={{ my: 2 }} />
) : settings.hiddenGames.length === 0 ? (
  <Mui.Typography
    variant="body2"
    color="text.secondary"
    sx={{ py: 2, textAlign: "center" }}
  >
    No hidden games. Games you hide will appear here.
  </Mui.Typography>
) : (
  <Mui.List dense>
    {settings.hiddenGames.map((game) => (
      <Mui.ListItem key={game.id}>
        <Mui.ListItemText
          primary={game.name}
          secondary={game.platform_id?.toUpperCase()}
        />
        <Mui.Button
          size="small"
          variant="outlined"
          startIcon={<VisibilityIcon />}
          onClick={async () => settings.handleUnhideGame(game.id)}
        >
          Unhide
        </Mui.Button>
      </Mui.ListItem>
    ))}
  </Mui.List>
)}
        </Mui.DialogContent>
        <Mui.DialogActions>
<Mui.Button
  onClick={() => {
    settings.setHiddenDialogOpen(false);
  }}
>
  Close
</Mui.Button>
        </Mui.DialogActions>
      </Mui.Dialog>
    </>
  );
}
