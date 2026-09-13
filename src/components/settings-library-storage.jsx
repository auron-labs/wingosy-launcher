import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import * as Mui from "@mui/material";

import {
  formatOptionalStorageBytes,
  formatStorageBytes,
} from "./settings-presentation";
import * as Shared from "./settings-view-shared";

/** @typedef {import("./settings-types").SettingsPanelProps} SettingsPanelProps */

/** @param {{overview: SettingsPanelProps["storageOverview"]}} props Storage overview. */
const StorageOverviewCards = ({ overview }) => {
  if (overview === null) {
    return null;
  }
  return (
    <Mui.Box
      sx={{
        display: "grid",
        gap: 1.5,
        gridTemplateColumns: { sm: "repeat(4, minmax(0, 1fr))", xs: "1fr" },
        mb: 3,
      }}
    >
      <Mui.Paper variant="outlined" sx={{ bgcolor: "action.hover", p: 2 }}>
        <Mui.Typography variant="caption" color="text.secondary">
          Tracked ROMs
        </Mui.Typography>
        <Mui.Typography variant="h6">
          {overview.tracked_rom_count}
        </Mui.Typography>
      </Mui.Paper>
      <Mui.Paper variant="outlined" sx={{ bgcolor: "action.hover", p: 2 }}>
        <Mui.Typography variant="caption" color="text.secondary">
          Tracked size
        </Mui.Typography>
        <Mui.Typography variant="h6">
          {formatStorageBytes(overview.tracked_rom_bytes)}
        </Mui.Typography>
      </Mui.Paper>
      <Mui.Paper variant="outlined" sx={{ bgcolor: "action.hover", p: 2 }}>
        <Mui.Typography variant="caption" color="text.secondary">
          Active downloads
        </Mui.Typography>
        <Mui.Typography variant="h6">
          {overview.active_rom_downloads}
        </Mui.Typography>
      </Mui.Paper>
      <Mui.Paper variant="outlined" sx={{ bgcolor: "action.hover", p: 2 }}>
        <Mui.Typography variant="caption" color="text.secondary">
          Free disk space
        </Mui.Typography>
        <Mui.Typography variant="h6" data-testid="storage-free-space-value">
          {formatOptionalStorageBytes(overview.free_disk_bytes)}
        </Mui.Typography>
      </Mui.Paper>
    </Mui.Box>
  );
};

/** @param {{overview: SettingsPanelProps["storageOverview"]}} props Storage overview. @returns {import("react").ReactNode} Availability note. */
const StorageAvailabilityNote = ({ overview }) => {
  if (overview === null || overview.free_disk_bytes !== undefined) {
    return null;
  }
  return (
    <Mui.Typography
      variant="caption"
      color="text.secondary"
      sx={{ display: "block", mb: 2, mt: -2 }}
    >
      Free disk space is not reported by the current backend.
    </Mui.Typography>
  );
};

/** @param {SettingsPanelProps} settings Storage directory state and actions. */
const RomStorageDirectory = (settings) => {
  const hasDirectory = settings.romsDirectory !== "";
  const hasActiveDownloads = settings.activeRomDownloadCount > 0;
  const usingDefault =
    settings.storageOverview?.using_default_roms_directory === true;
  return (
    <>
      <Mui.Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        ROM Storage Directory
      </Mui.Typography>
      <Mui.Box
        sx={{
          alignItems: "center",
          bgcolor: "rgba(0,0,0,0.2)",
          borderRadius: 2,
          display: "flex",
          gap: 2,
          mb: 2,
          p: 1.5,
        }}
      >
        <FolderOpenIcon color="action" />
        <Mui.Typography
          variant="body2"
          sx={{
            color: "text.primary",
            flex: 1,
            fontFamily: "monospace",
            overflowWrap: "anywhere",
          }}
        >
          {hasDirectory ? settings.romsDirectory : "Loading..."}
        </Mui.Typography>
        {usingDefault && <Mui.Chip size="small" label="Default" />}
        <Mui.Button
          size="small"
          variant="outlined"
          onClick={() => {
            settings.handleChangeRomsDirectory();
          }}
          disabled={settings.storageChangeBusy || hasActiveDownloads}
          title={
            hasActiveDownloads
              ? "Wait for ROM downloads to finish before changing storage"
              : undefined
          }
        >
          Change
        </Mui.Button>
        <Mui.Button
          size="small"
          onClick={() => {
            settings.handleResetRomsDirectory();
          }}
          disabled={
            usingDefault || settings.storageChangeBusy || hasActiveDownloads
          }
          title="Reset to Wingosy's default ROM folder"
        >
          Reset to default
        </Mui.Button>
      </Mui.Box>
      <Mui.Alert severity="info" sx={{ mb: 2 }}>
        Changing folders never moves files silently. Choose whether to move
        tracked ROMs or use the new folder for future downloads; active
        downloads must finish first.
      </Mui.Alert>
    </>
  );
};

/** @param {SettingsPanelProps} settings Storage location state and actions. */
const StorageLocationList = (settings) => {
  const locations = settings.storageOverview?.locations ?? [];
  if (locations.length === 0) {
    return null;
  }
  return (
    <Mui.List disablePadding sx={{ mb: 2 }}>
      {locations.map((location) => (
        <Mui.ListItem
          key={location.key}
          divider
          disableGutters
          secondaryAction={
            <Mui.Typography variant="caption">
              {formatStorageBytes(location.bytes)}
            </Mui.Typography>
          }
        >
          <Mui.ListItemButton
            onClick={() => {
              settings.handleOpenStorageLocation(location);
            }}
            disabled={!location.exists}
            aria-label={
              location.exists
                ? `Open ${location.label} folder`
                : `${location.label} folder is not created`
            }
            sx={{ borderRadius: 1.5 }}
          >
            <Mui.ListItemIcon sx={{ minWidth: 40 }}>
              <FolderOpenIcon fontSize="small" />
            </Mui.ListItemIcon>
            <Mui.ListItemText
              primary={location.label}
              secondary={location.path}
              slotProps={{
                secondary: {
                  sx: {
                    fontFamily: "monospace",
                    overflowWrap: "anywhere",
                    pr: 8,
                  },
                },
              }}
            />
            <OpenInNewIcon fontSize="small" color="action" sx={{ ml: 1 }} />
          </Mui.ListItemButton>
        </Mui.ListItem>
      ))}
    </Mui.List>
  );
};

/** @param {SettingsPanelProps} settings Storage settings state and actions. */
const StorageSettings = (settings) => (
  <Mui.Paper sx={Shared.SETTINGS_CARD_SX}>
    <Mui.Box sx={{ alignItems: "center", display: "flex", gap: 1, mb: 1 }}>
      <FolderOpenIcon color="primary" />
      <Mui.Typography variant="h6">Storage</Mui.Typography>
    </Mui.Box>
    <Mui.Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
      Review Wingosy file locations and choose where ROM downloads are stored.
    </Mui.Typography>
    {settings.storageLoading && (
      <Mui.LinearProgress sx={{ borderRadius: 1, mb: 2 }} />
    )}
    <StorageOverviewCards overview={settings.storageOverview} />
    <StorageAvailabilityNote overview={settings.storageOverview} />
    <RomStorageDirectory {...settings} />
    <StorageLocationList {...settings} />
    <Mui.Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
      Scan for ROMs to add them to your library.
    </Mui.Typography>
    <Mui.Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
      <Mui.Button
        variant="contained"
        onClick={() => {
          settings.handleScanDirectory();
        }}
        disabled={settings.romsDirectory === ""}
        title={
          settings.romsDirectory === ""
            ? "Set a ROM directory first"
            : `Scan ${settings.romsDirectory}`
        }
      >
        Scan ROM Directory
      </Mui.Button>
      <Mui.Button
        variant="outlined"
        onClick={() => {
          settings.handleScanCustomDirectory();
        }}
      >
        Scan Other Folder...
      </Mui.Button>
    </Mui.Box>
    {settings.scanMessage !== null && (
      <Mui.Alert severity={settings.scanMessage.type} sx={{ mt: 2 }}>
        {settings.scanMessage.message}
      </Mui.Alert>
    )}
  </Mui.Paper>
);

export default StorageSettings;
