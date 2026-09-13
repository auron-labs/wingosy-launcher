import DownloadIcon from "@mui/icons-material/Download";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Collapse from "@mui/material/Collapse";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";

/** @typedef {import("./bios-types").BiosFirmware} BiosFirmware */
/** @typedef {import("./bios-types").BiosGroup} BiosGroup */

/** @param {number} bytes Byte count to format. */
const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "Unknown size";
  }
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};

/**
 * @typedef {object} BiosGroupRowProps
 * @property {boolean} expanded - Whether the group is expanded.
 * @property {BiosGroup} group - Firmware group to display.
 * @property {boolean} libraryRelevant - Whether the platform is used by the library.
 * @property {string|null} busy - Current BIOS operation identifier.
 * @property {(group: BiosGroup) => Promise<void>} downloadGroup - Download one group.
 * @property {(id: number, fileName: string) => Promise<void>} downloadOne - Download one file.
 * @property {() => void} onToggle - Toggle group expansion.
 */

/**
 * @typedef {object} BiosFirmwareItemProps
 * @property {string|null} busy - Current BIOS operation identifier.
 * @property {BiosFirmware} item - Firmware item to display.
 * @property {(id: number, fileName: string) => Promise<void>} onDownload - Download one file.
 */

/** @param {BiosFirmware} item Firmware item. @returns {string} Secondary item text. */
const getFirmwareSecondary = (item) => {
  if (item.missing_from_fs) {
    return "Missing from RomM filesystem";
  }
  if (item.is_downloaded) {
    return item.local_path ?? formatBytes(item.file_size_bytes);
  }
  return formatBytes(item.file_size_bytes);
};

/** @param {BiosFirmwareItemProps} props - Firmware item and download action. */
const BiosFirmwareItem = ({ busy, item, onDownload }) => (
  <ListItem
    secondaryAction={
      <Button
        size="small"
        startIcon={
          busy === `file:${item.id}` ? (
            <CircularProgress size={14} />
          ) : (
            <DownloadIcon />
          )
        }
        disabled={Boolean(busy) || item.missing_from_fs}
        onClick={() => {
          void onDownload(item.id, item.file_name);
        }}
      >
        {item.is_downloaded ? "Redownload" : "Download"}
      </Button>
    }
  >
    <ListItemText
      primary={item.file_name}
      secondary={getFirmwareSecondary(item)}
      slotProps={{
        primary: { sx: { fontFamily: "monospace" }, variant: "body2" },
        secondary: { sx: { overflowWrap: "anywhere", pr: 12 } },
      }}
    />
  </ListItem>
);

/** @param {BiosGroup} group Firmware group. @param {number} downloaded Downloaded count. @param {number} unavailable Unavailable count. @returns {string} Group summary. */
const getGroupCount = (group, downloaded, unavailable) => {
  if (group.items.length - unavailable === 0) {
    return `${downloaded} downloaded · ${unavailable} unavailable on RomM`;
  }
  const suffix = unavailable > 0 ? ` · ${unavailable} unavailable on RomM` : "";
  return `${downloaded} of ${group.items.length - unavailable} available downloaded${suffix}`;
};

/** @param {boolean} allUnavailable Every file is unavailable. @param {boolean} complete Every available file is downloaded. @returns {string} Status label. */
const getGroupStatus = (allUnavailable, complete) => {
  if (allUnavailable) {
    return "Unavailable";
  }
  return complete ? "Ready" : "Missing";
};

/** @param {{busy: string|null, complete: boolean, allUnavailable: boolean, downloadGroup: (group: BiosGroup) => Promise<void>, group: BiosGroup, missing: number, platformBusy: boolean}} props Group action properties. */
const BiosGroupActions = ({
  allUnavailable,
  busy,
  complete,
  downloadGroup,
  group,
  missing,
  platformBusy,
}) => (
  <Box
    sx={{
      alignItems: "center",
      display: "flex",
      flexShrink: 0,
      gap: 0.5,
    }}
  >
    <Chip
      size="small"
      label={getGroupStatus(allUnavailable, complete)}
      color={complete ? "success" : "default"}
    />
    {missing > 0 && (
      <Button
        size="small"
        variant="outlined"
        startIcon={
          platformBusy ? <CircularProgress size={14} /> : <DownloadIcon />
        }
        disabled={busy !== null}
        onClick={(event) => {
          event.stopPropagation();
          void downloadGroup(group);
        }}
      >
        {platformBusy ? "Downloading…" : `Download missing (${missing})`}
      </Button>
    )}
  </Box>
);

/** @param {{busy: string|null, downloadOne: (id: number, fileName: string) => Promise<void>, expanded: boolean, group: BiosGroup}} props Group file properties. */
const BiosGroupFiles = ({ busy, downloadOne, expanded, group }) => (
  <Collapse in={expanded} unmountOnExit>
    <List disablePadding sx={{ pb: 1, pl: 3 }}>
      {group.items.map((item) => (
        <BiosFirmwareItem
          busy={busy}
          item={item}
          key={item.id}
          onDownload={downloadOne}
        />
      ))}
    </List>
  </Collapse>
);

/** @param {BiosGroupRowProps} props Group state and download actions. */
const BiosGroupRow = ({
  busy,
  downloadGroup,
  downloadOne,
  expanded,
  group,
  libraryRelevant,
  onToggle,
}) => {
  const availableItems = group.items.filter((item) => !item.missing_from_fs);
  const downloaded = group.items.filter((item) => item.is_downloaded).length;
  const unavailable = group.items.length - availableItems.length;
  const missing = availableItems.filter((item) => !item.is_downloaded).length;
  const complete = availableItems.length > 0 && missing === 0;
  const platformBusy = busy === `platform:${group.slug}`;
  const allUnavailable = unavailable === group.items.length;
  return (
    <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
      <ListItem sx={{ cursor: "pointer", gap: 1, pr: 2 }} onClick={onToggle}>
        <ListItemText
          sx={{ flex: "1 1 auto", minWidth: 0 }}
          primary={
            <Box
              sx={{
                alignItems: "center",
                display: "flex",
                flexWrap: "wrap",
                gap: 1,
              }}
            >
              <span>{group.name}</span>
              {libraryRelevant && (
                <Chip
                  size="small"
                  label="Needed by your library"
                  color="primary"
                  variant="outlined"
                />
              )}
            </Box>
          }
          secondary={getGroupCount(group, downloaded, unavailable)}
        />
        <BiosGroupActions
          busy={busy}
          complete={complete}
          allUnavailable={allUnavailable}
          downloadGroup={downloadGroup}
          group={group}
          missing={missing}
          platformBusy={platformBusy}
        />
        <Button
          size="small"
          variant="text"
          startIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          aria-expanded={expanded}
          onClick={(event) => {
            event.stopPropagation();
            onToggle();
          }}
        >
          {expanded ? "Hide files" : "Show files"}
        </Button>
      </ListItem>
      <BiosGroupFiles
        busy={busy}
        downloadOne={downloadOne}
        expanded={expanded}
        group={group}
      />
    </Box>
  );
};

/**
 * @typedef {object} BiosFirmwareGroupsProps
 * @property {BiosGroup[]} groups - Firmware groups to display.
 * @property {string|null} busy - Current BIOS operation identifier.
 * @property {Record<string, boolean>} expanded - Expanded group state.
 * @property {Set<number|string>} libraryPlatformIds - Platforms used by the library.
 * @property {import("react").Dispatch<import("react").SetStateAction<Record<string, boolean>>>} setExpanded - Update expanded groups.
 * @property {(group: BiosGroup) => Promise<void>} downloadGroup - Download one group.
 * @property {(id: number, fileName: string) => Promise<void>} downloadOne - Download one file.
 */

/** @param {BiosFirmwareGroupsProps} props - Firmware groups and interaction state. */
export const BiosFirmwareGroups = ({
  busy,
  downloadGroup,
  downloadOne,
  expanded,
  groups,
  libraryPlatformIds,
  setExpanded,
}) => (
  <List disablePadding>
    {groups.map((group) => (
      <BiosGroupRow
        busy={busy}
        downloadGroup={downloadGroup}
        downloadOne={downloadOne}
        expanded={expanded[group.slug]}
        group={group}
        key={group.slug}
        libraryRelevant={libraryPlatformIds.has(group.slug)}
        onToggle={() => {
          setExpanded((previous) => ({
            ...previous,
            [group.slug]: !expanded[group.slug],
          }));
        }}
      />
    ))}
  </List>
);
