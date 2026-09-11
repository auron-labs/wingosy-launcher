import DownloadIcon from "@mui/icons-material/Download";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import MemoryIcon from "@mui/icons-material/Memory";
import RefreshIcon from "@mui/icons-material/Refresh";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

import { BiosFirmwareGroups } from "./bios-firmware-groups";

/** @typedef {import("./bios-types").BiosGroup} BiosGroup */
/** @typedef {import("./bios-types").BiosMessage} BiosMessage */
/** @typedef {import("./bios-types").BiosTotals} BiosTotals */

const CARD_SX = {
  borderRadius: 3,
  boxSizing: "border-box",
  maxWidth: "100%",
  mb: 3,
  p: 3,
  width: "100%",
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
 * @property {Set<number|string>} libraryPlatformIds - Platforms used by the library.
 * @property {() => Promise<void>} load - Reload BIOS state.
 * @property {boolean} loading - Whether BIOS state is loading.
 * @property {BiosMessage|null} message - Latest user-facing operation message.
 * @property {() => Promise<void>} resetDirectory - Restore the default directory.
 * @property {import("react").Dispatch<import("react").SetStateAction<Record<string, boolean>>>} setExpanded - Update expanded groups.
 * @property {BiosTotals} totals - Aggregate firmware counts.
 */

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
  <Paper sx={CARD_SX}>
    <Box
      sx={{
        alignItems: "center",
        display: "flex",
        flexWrap: "wrap",
        gap: 1,
        mb: 2,
      }}
    >
      <MemoryIcon color="primary" />
      <Typography variant="h6" sx={{ flex: 1 }}>
        BIOS &amp; Firmware
      </Typography>
      <Chip
        size="small"
        label={`${totals.downloaded} downloaded · ${totals.missing} missing`}
        color={totals.missing === 0 && totals.available ? "success" : "default"}
      />
      <Button
        size="small"
        variant="outlined"
        startIcon={<RefreshIcon />}
        onClick={() => {
          void load();
        }}
        disabled={loading || Boolean(busy)}
      >
        Refresh list
      </Button>
    </Box>

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
      from RomM for download.{" "}
      {totals.unavailable > 0
        ? `${totals.unavailable} listed file${totals.unavailable === 1 ? " is" : "s are"} unavailable on the RomM filesystem and excluded from the missing count.`
        : "Missing counts include only files that RomM can provide."}
    </Typography>

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
        {biosDirectory || "Loading..."}
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
    {message && (
      <Alert severity={message.type} sx={{ mt: 2 }}>
        {message.text}
      </Alert>
    )}
  </Paper>
);

/** @param {BiosSettingsViewProps} props - BIOS settings view state and actions. */
const BiosGroupsCard = ({
  busy,
  downloadGroup,
  downloadOne,
  expanded,
  groups,
  libraryPlatformIds,
  loading,
  setExpanded,
}) => (
  <Paper sx={CARD_SX}>
    <Typography variant="h6" gutterBottom>
      Available from RomM
    </Typography>
    {loading ? (
      <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
        <CircularProgress />
      </Box>
    ) : groups.length === 0 ? (
      <Alert severity="info">
        No firmware was returned by RomM. Sync the library and confirm the token
        has the firmware.read scope.
      </Alert>
    ) : (
      <BiosFirmwareGroups
        busy={busy}
        downloadGroup={downloadGroup}
        downloadOne={downloadOne}
        expanded={expanded}
        groups={groups}
        libraryPlatformIds={libraryPlatformIds}
        setExpanded={setExpanded}
      />
    )}
  </Paper>
);

/** @param {BiosSettingsViewProps} props - BIOS settings view state and actions. */
export const BiosSettingsView = (props) => (
  <>
    <BiosSummaryCard {...props} />
    <BiosGroupsCard {...props} />
  </>
);
