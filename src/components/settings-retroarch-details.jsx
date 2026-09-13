import DownloadIcon from "@mui/icons-material/Download";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import MemoryIcon from "@mui/icons-material/Memory";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";

/** @typedef {import("./settings-types").SettingsEmulator} SettingsEmulator */
/** @typedef {import("./settings-types").SettingsPanelProps} SettingsPanelProps */

/** @typedef {Pick<SettingsPanelProps, "config"|"downloadingCore"|"handleDownloadCore"|"handleOpenRetroarchInputSetup"|"handleRepairRetroarchProfile"|"handleResetRetroarchControllerAdditions"|"handleRetroarchBetaProfileChange"|"missingCores"|"retroarchCoreInventory"|"setExpandedEmu"|"expandedEmu">} RetroArchDetailsProps */

/** @param {RetroArchDetailsProps} settings Settings state and actions. @param {SettingsEmulator} emu RetroArch installation. */
const RetroArchActions = (settings, emu) => (
  <>
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, my: 1 }}>
      <Button
        size="small"
        variant="outlined"
        onClick={settings.handleOpenRetroarchInputSetup}
      >
        Open RetroArch input setup
      </Button>
      {emu.install_type === "managed" ? (
        <Button
          size="small"
          variant="outlined"
          onClick={settings.handleRepairRetroarchProfile}
        >
          Repair Wingosy controller setup
        </Button>
      ) : (
        <Button
          size="small"
          variant="outlined"
          color="warning"
          onClick={settings.handleResetRetroarchControllerAdditions}
        >
          Reset Wingosy controller additions
        </Button>
      )}
    </Box>
    {emu.install_type === "external" && (
      <FormControlLabel
        control={
          <Switch
            size="small"
            checked={Boolean(
              settings.config?.emulators?.retroarch_use_beta_profile
            )}
            onChange={settings.handleRetroarchBetaProfileChange}
          />
        }
        label="Use Wingosy controller settings for this installation"
      />
    )}
  </>
);

/** @param {RetroArchDetailsProps} settings Settings state and actions. */
const RetroArchCoreInventory = (settings) => (
  <>
    <Typography
      variant="caption"
      color="text.secondary"
      sx={{ display: "block", mt: 1 }}
    >
      Supported RetroArch systems:
    </Typography>
    {settings.retroarchCoreInventory.map((core) => (
      <Box
        key={core.platform_id}
        data-testid="retroarch-core-inventory-row"
        sx={{
          alignItems: "center",
          display: "flex",
          flexWrap: "wrap",
          gap: 1,
        }}
      >
        <Typography variant="body2" sx={{ minWidth: 180 }}>
          {core.platform_name}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
          {core.core_filename}
        </Typography>
        <Chip
          label={core.required === true ? "Required" : "Optional"}
          size="small"
          variant="outlined"
        />
        <Chip
          label={
            core.status !== undefined && core.status !== ""
              ? `${core.status[0].toUpperCase()}${core.status.slice(1)}`
              : "Unknown"
          }
          size="small"
          data-testid={`retroarch-core-status-${core.platform_id}`}
          color={core.status === "installed" ? "success" : "warning"}
        />
      </Box>
    ))}
  </>
);

/** @param {RetroArchDetailsProps} settings Settings state and actions. */
const MissingCoreChips = (settings) => {
  if (settings.missingCores.length === 0) {
    return null;
  }
  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 1 }}>
      {settings.missingCores.map((core) => (
        <Chip
          key={core.core_filename}
          data-testid="retroarch-core-chip"
          icon={<MemoryIcon sx={{ fontSize: 14 }} />}
          label={`${core.core_filename} (${core.platform_name})`}
          onClick={() => {
            settings.handleDownloadCore(core.core_filename);
          }}
          onDelete={() => {
            settings.handleDownloadCore(core.core_filename);
          }}
          deleteIcon={<DownloadIcon sx={{ fontSize: 16 }} />}
          disabled={settings.downloadingCore !== null}
        />
      ))}
    </Box>
  );
};

/** @param {RetroArchDetailsProps} settings Settings state and actions. @param {SettingsEmulator} emu RetroArch installation. */
const RetroArchPanel = (settings, emu) => (
  <Box
    sx={{
      bgcolor: "rgba(255, 152, 0, 0.05)",
      border: "1px solid rgba(255, 152, 0, 0.2)",
      borderRadius: 1,
      mt: 1,
      p: 2,
    }}
  >
    <Typography variant="caption" color="text.secondary">
      {emu.install_type === "managed"
        ? `Wingosy-managed RetroArch setup ${emu.version ?? "recorded"}`
        : "RetroArch installed outside Wingosy"}
    </Typography>
    {RetroArchActions(settings, emu)}
    <RetroArchCoreInventory {...settings} />
    <MissingCoreChips {...settings} />
  </Box>
);

/** @param {RetroArchDetailsProps} settings Settings state and actions. @param {SettingsEmulator} emu RetroArch installation. */
const RetroArchDetails = (settings, emu) => {
  const isExpanded = settings.expandedEmu === emu.id;
  return (
    <>
      <Button
        size="small"
        variant="outlined"
        startIcon={isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        aria-expanded={isExpanded}
        onClick={(event) => {
          event.stopPropagation();
          settings.setExpandedEmu(isExpanded ? null : emu.id);
        }}
      >
        {isExpanded ? "Hide cores" : "Show cores"}
      </Button>
      <Collapse in={isExpanded}>{RetroArchPanel(settings, emu)}</Collapse>
    </>
  );
};

export default RetroArchDetails;
