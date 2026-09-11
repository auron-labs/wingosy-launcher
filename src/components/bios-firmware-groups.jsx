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

/** @param {number} bytes */
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

/** @param {BiosGroupRowProps} props - Group state and download actions. */
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
  const groupCount =
    availableItems.length === 0
      ? `${downloaded} downloaded · ${unavailable} unavailable on RomM`
      : `${downloaded} of ${availableItems.length} available downloaded${unavailable > 0 ? ` · ${unavailable} unavailable on RomM` : ""}`;

  return (
    <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
      <ListItem sx={{ cursor: "pointer", pr: 2, gap: 1 }} onClick={onToggle}>
        <ListItemText
          sx={{ flex: "1 1 auto", minWidth: 0 }}
          primary={
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                flexWrap: "wrap",
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
          secondary={groupCount}
        />
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            flexShrink: 0,
          }}
        >
          <Chip
            size="small"
            label={
              unavailable === group.items.length
                ? "Unavailable"
                : complete
                  ? "Ready"
                  : "Missing"
            }
            color={complete ? "success" : "default"}
          />
          {missing > 0 && (
            <Button
              size="small"
              variant="outlined"
              startIcon={
                platformBusy ? <CircularProgress size={14} /> : <DownloadIcon />
              }
              disabled={Boolean(busy)}
              onClick={(event) => {
                event.stopPropagation();
                void downloadGroup(group);
              }}
            >
              {platformBusy ? "Downloading…" : `Download missing (${missing})`}
            </Button>
          )}
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
        </Box>
      </ListItem>
      <Collapse in={expanded} unmountOnExit>
        <List disablePadding sx={{ pl: 3, pb: 1 }}>
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
    </Box>
  );
};

/**
 * @typedef {object} BiosFirmwareItemProps
 * @property {string|null} busy - Current BIOS operation identifier.
 * @property {BiosFirmware} item - Firmware item to display.
 * @property {(id: number, fileName: string) => Promise<void>} onDownload - Download one file.
 */

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
      secondary={
        item.missing_from_fs
          ? "Missing from RomM filesystem"
          : item.is_downloaded
            ? item.local_path
            : formatBytes(item.file_size_bytes)
      }
      slotProps={{
        primary: { sx: { fontFamily: "monospace" }, variant: "body2" },
        secondary: { sx: { overflowWrap: "anywhere", pr: 12 } },
      }}
    />
  </ListItem>
);

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
        expanded={Boolean(expanded[group.slug])}
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
