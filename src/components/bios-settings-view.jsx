import DownloadIcon from "@mui/icons-material/Download";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import RefreshIcon from "@mui/icons-material/Refresh";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";

import { BiosFirmwareGroups } from "./bios-firmware-groups";
import SettingsCard from "./settings-card";

/** @typedef {import("./bios-types").BiosGroup} BiosGroup */
/** @typedef {import("./bios-types").BiosMessage} BiosMessage */
/** @typedef {import("./bios-types").BiosTotals} BiosTotals */

/** @param {BiosTotals} totals BIOS counts. @returns {"success"|"default"} Summary chip color. */
const getBiosSummaryColor = (totals) => {
  if (totals.missing === 0 && totals.available > 0) {
    return "success";
  }
  return "default";
};

/** @param {BiosTotals} totals BIOS counts. @returns {string} Availability explanation. */
const getAvailabilityExplanation = (totals) => {
  if (totals.unavailable > 0) {
    return `${totals.unavailable} listed file${totals.unavailable === 1 ? " is" : "s are"} unavailable on the RomM filesystem and excluded from the missing count.`;
  }
  return "Missing counts include only files that RomM can provide.";
};

/**
 * @typedef {object} BiosSettingsViewProps
 * @property {string} biosDirectory - Current BIOS directory.
 * @property {string|null} busy - Current BIOS operation identifier.
 * @property {() => Promise<void>} chooseDirectory - Select a BIOS directory.
 * @property {() => Promise<void>} distribute - Distribute BIOS files.
 * @property {() => Promise<void>} downloadAll - Download all available files.
 * @property {(group: BiosGroup) => Promise<void>} downloadGroup - Download one platform group.
 * @property {(id: number, fileName: string) => Promise<void>} downloadOne - Download one file.
 * @property {Record<string, boolean>} expanded - Expanded group state.
 * @property {BiosGroup[]} groups - Grouped firmware records.
 * @property {(firmwareId: number|string, platformSlug: string) => import("../rom-downloads-context-value").DownloadProgress|null} getBiosProgress - Active BIOS transfer lookup.
 * @property {(firmwareId: number|string, platformSlug: string) => import("../rom-downloads-context-value").RecentDownload|null} getBiosRecentDownload - Recent BIOS transfer lookup.
 * @property {Set<number|string>} libraryPlatformIds - Platforms used by the library.
 * @property {() => Promise<void>} load - Reload BIOS state.
 * @property {boolean} loading - Whether BIOS state is loading.
 * @property {BiosMessage|null} message - Latest user-facing operation message.
 * @property {() => Promise<void>} resetDirectory - Restore the default directory.
 * @property {import("react").Dispatch<import("react").SetStateAction<Record<string, boolean>>>} setExpanded - Update expanded groups.
 * @property {BiosTotals} totals - Aggregate firmware counts.
 */

/** @param {Pick<BiosSettingsViewProps, "busy"|"load"|"loading"|"totals">} props BIOS summary state. */
const BiosSummaryHeader = ({ busy, load, loading, totals }) => (
  <Box sx={{ alignItems: "center", display: "flex", gap: 1 }}>
    <Chip
      color={getBiosSummaryColor(totals)}
      label={`${totals.downloaded} downloaded · ${totals.missing} missing`}
      size="small"
    />
    <Button
      disabled={loading || Boolean(busy)}
      onClick={() => {
        void load();
      }}
      size="small"
      startIcon={<RefreshIcon />}
      variant="outlined"
    >
      Refresh list
    </Button>
  </Box>
);

/** @param {{biosDirectory: string, chooseDirectory: () => Promise<void>, resetDirectory: () => Promise<void>}} props Directory controls. */
const BiosDirectoryControls = ({
  biosDirectory,
  chooseDirectory,
  resetDirectory,
}) => (
  <Box
    sx={{
      alignItems: "center",
      bgcolor: "rgba(0,0,0,0.2)",
      borderRadius: 2,
      display: "flex",
      gap: 1.5,
      mb: 2,
      p: 1.5,
    }}
  >
    <FolderOpenIcon color="action" />
    <Typography
      variant="body2"
      sx={{ flex: 1, fontFamily: "monospace", overflowWrap: "anywhere" }}
    >
      {biosDirectory === "" ? "Loading..." : biosDirectory}
    </Typography>
    <Button
      size="small"
      variant="outlined"
      onClick={() => {
        void chooseDirectory();
      }}
    >
      Change
    </Button>
    <Button
      size="small"
      onClick={() => {
        void resetDirectory();
      }}
    >
      Default
    </Button>
  </Box>
);

/** @param {{busy: string|null, distribute: () => Promise<void>, downloadAll: () => Promise<void>, loading: boolean, totals: BiosTotals}} props BIOS actions. */
const BiosSummaryActions = ({
  busy,
  distribute,
  downloadAll,
  loading,
  totals,
}) => (
  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
    <Button
      variant="contained"
      startIcon={
        busy === "all" ? (
          <CircularProgress size={16} color="inherit" />
        ) : (
          <DownloadIcon />
        )
      }
      onClick={() => {
        void downloadAll();
      }}
      disabled={loading || Boolean(busy) || totals.available === 0}
    >
      {totals.missing > 0
        ? `Download ${totals.missing} missing`
        : "Verify / redownload"}
    </Button>
    <Button
      variant="outlined"
      onClick={() => {
        void distribute();
      }}
      disabled={loading || Boolean(busy) || totals.downloaded === 0}
    >
      {busy === "distribute" ? "Distributing..." : "Distribute to emulators"}
    </Button>
  </Box>
);

/** @param {BiosSettingsViewProps} props - BIOS settings view state and actions. */
const BiosSummaryCard = ({
  biosDirectory,
  busy,
  chooseDirectory,
  distribute,
  downloadAll,
  load,
  loading,
  message,
  resetDirectory,
  totals,
}) => (
  <SettingsCard
    actions={
      <BiosSummaryHeader
        busy={busy}
        load={load}
        loading={loading}
        totals={totals}
      />
    }
    title="Firmware"
  >
    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
      Download firmware from your RomM server, verify its checksum, then install
      it into known emulator BIOS folders. For Switch, Wingosy installs
      prod.keys and firmware.zip into configured Eden instances.
    </Typography>
    <Typography
      variant="body2"
      color="text.secondary"
      sx={{ mb: 2 }}
      data-testid="bios-count-explanation"
    >
      {totals.available} file{totals.available === 1 ? "" : "s"} are available
      from RomM for download. {getAvailabilityExplanation(totals)}
    </Typography>

    <BiosDirectoryControls
      biosDirectory={biosDirectory}
      chooseDirectory={chooseDirectory}
      resetDirectory={resetDirectory}
    />
    <BiosSummaryActions
      busy={busy}
      distribute={distribute}
      downloadAll={downloadAll}
      loading={loading}
      totals={totals}
    />
    {message && (
      <Alert severity={message.type} sx={{ mt: 2 }}>
        {message.text}
      </Alert>
    )}
  </SettingsCard>
);

/** @param {Pick<BiosSettingsViewProps, "busy"|"downloadGroup"|"downloadOne"|"expanded"|"getBiosProgress"|"getBiosRecentDownload"|"groups"|"libraryPlatformIds"|"loading"|"setExpanded">} props BIOS group content. */
const BiosGroupsContent = ({
  busy,
  downloadGroup,
  downloadOne,
  expanded,
  getBiosProgress,
  getBiosRecentDownload,
  groups,
  libraryPlatformIds,
  loading,
  setExpanded,
}) => {
  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (groups.length === 0) {
    return (
      <Alert severity="info">
        No firmware was returned by RomM. Sync the library and confirm the token
        has the firmware.read scope.
      </Alert>
    );
  }
  return (
    <BiosFirmwareGroups
      busy={busy}
      downloadGroup={downloadGroup}
      downloadOne={downloadOne}
      expanded={expanded}
      getBiosProgress={getBiosProgress}
      getBiosRecentDownload={getBiosRecentDownload}
      groups={groups}
      libraryPlatformIds={libraryPlatformIds}
      setExpanded={setExpanded}
    />
  );
};

/** @param {Pick<BiosSettingsViewProps, "busy"|"downloadGroup"|"downloadOne"|"expanded"|"getBiosProgress"|"getBiosRecentDownload"|"groups"|"libraryPlatformIds"|"loading"|"setExpanded">} props BIOS group card. */
const BiosGroupsCard = ({
  busy,
  downloadGroup,
  downloadOne,
  expanded,
  getBiosProgress,
  getBiosRecentDownload,
  groups,
  libraryPlatformIds,
  loading,
  setExpanded,
}) => (
  <SettingsCard title="Available from RomM">
    <BiosGroupsContent
      busy={busy}
      downloadGroup={downloadGroup}
      downloadOne={downloadOne}
      expanded={expanded}
      getBiosProgress={getBiosProgress}
      getBiosRecentDownload={getBiosRecentDownload}
      groups={groups}
      libraryPlatformIds={libraryPlatformIds}
      loading={loading}
      setExpanded={setExpanded}
    />
  </SettingsCard>
);

/** @param {BiosSettingsViewProps} props - BIOS settings view state and actions. */
export const BiosSettingsView = (props) => (
  <>
    <BiosSummaryCard {...props} />
    <BiosGroupsCard {...props} />
  </>
);
