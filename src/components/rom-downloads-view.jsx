import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CloudDownloadIcon from "@mui/icons-material/CloudDownload";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import LinearProgress from "@mui/material/LinearProgress";
import Link from "@mui/material/Link";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { useRomDownloads } from "../rom-downloads-context-value";
import { formatDownloadLabel } from "../rom-downloads-format";
import { tauriDragRegionProps, tauriDragRegionSx } from "../utils/is-tauri";

/** @typedef {{gameId?: number|string, gameName?: string, percent?: number|null, kind?: "complete"|"error", path?: string, message?: string, at?: number, downloaded?: number|null, total?: number|null, stage?: string}} DownloadRow */

/** @param {{event: import("react").MouseEvent, action: (() => void)|null}} options Navigation options. */
const handleNavigation = ({ event, action }) => {
  if (action === null) {
    return;
  }
  event.preventDefault();
  action();
};

/** @param {{onOpenGameDetails: (() => void)|null, onOpenCloudLibrary: (() => void)|null}} props Empty state actions. */
const DownloadsEmptyState = ({ onOpenGameDetails, onOpenCloudLibrary }) => (
  <Paper
    data-testid="downloads-empty-state"
    variant="outlined"
    sx={{
      alignItems: "center",
      bgcolor: "action.hover",
      display: "flex",
      flexDirection: "column",
      gap: 1.25,
      justifyContent: "center",
      mb: 3,
      minHeight: 230,
      mt: 1,
      px: 3,
      py: 4,
      textAlign: "center",
    }}
  >
    <CloudDownloadIcon color="primary" sx={{ fontSize: 64, opacity: 0.85 }} />
    <Typography variant="h6" component="h2">
      No active downloads
    </Typography>
    <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 620 }}>
      Start a download from{" "}
      <Link
        href="#library"
        onClick={(event) => {
          handleNavigation({ action: onOpenGameDetails, event });
        }}
      >
        a game&apos;s details page
      </Link>{" "}
      or a{" "}
      <Link
        href="#library"
        onClick={(event) => {
          handleNavigation({ action: onOpenCloudLibrary, event });
        }}
      >
        cloud library tile
      </Link>
      .
    </Typography>
  </Paper>
);

/** @param {{activeDownloads: DownloadRow[]}} props Active downloads. */
const ActiveDownloads = ({ activeDownloads }) => {
  if (activeDownloads.length === 0) {
    return null;
  }
  return (
    <Stack spacing={2} sx={{ mb: 4, mt: 1 }}>
      {activeDownloads.map((row) => (
        <Paper
          key={row.gameId}
          variant="outlined"
          sx={{ borderRadius: 2, p: 2 }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
            {row.gameName}
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", mb: 1 }}
          >
            {formatDownloadLabel(row)}
          </Typography>
          {row.percent === null || row.percent === undefined ? (
            <LinearProgress sx={{ borderRadius: 1, height: 8 }} />
          ) : (
            <LinearProgress
              variant="determinate"
              value={row.percent}
              sx={{ borderRadius: 1, height: 8 }}
            />
          )}
        </Paper>
      ))}
    </Stack>
  );
};

/** @param {DownloadRow} item Recent download. @returns {string} Recent download text. */
const getRecentDownloadLabel = (item) => {
  if (item.kind === "complete") {
    return item.path === undefined || item.path === ""
      ? "Finished"
      : `Saved · ${item.path}`;
  }
  return item.message === undefined || item.message === ""
    ? "Download failed"
    : item.message;
};

/** @param {{recentDownloads: DownloadRow[], clearRecentDownloads: (() => void)|null|undefined}} props Recent downloads. */
const RecentDownloads = ({ recentDownloads, clearRecentDownloads }) => (
  <>
    <Stack
      direction="row"
      sx={{ alignItems: "center", justifyContent: "space-between" }}
    >
      <Typography
        variant="overline"
        color="text.secondary"
        sx={{ letterSpacing: "0.08em" }}
      >
        Recent
      </Typography>
      {recentDownloads.length > 0 && (
        <Button
          size="small"
          variant="outlined"
          onClick={() => {
            clearRecentDownloads?.();
          }}
          aria-label="Clear history"
        >
          Clear history
        </Button>
      )}
    </Stack>
    {recentDownloads.length === 0 ? (
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        Completed and failed downloads will appear here.
      </Typography>
    ) : (
      <List dense sx={{ mt: 1 }}>
        {recentDownloads.map((item, index) => (
          <ListItem
            key={`${item.kind}-${item.gameId}-${item.at}-${index}`}
            sx={{ px: 0 }}
          >
            <ListItemText
              primary={item.gameName}
              secondary={getRecentDownloadLabel(item)}
              slotProps={{
                secondary: {
                  color: item.kind === "error" ? "error" : "text.secondary",
                },
              }}
            />
          </ListItem>
        ))}
      </List>
    )}
  </>
);

/** @param {{onBack?: (() => void)|null, immersive?: boolean, onOpenGameDetails?: (() => void)|null, onOpenCloudLibrary?: (() => void)|null, downloads?: Pick<ReturnType<typeof useRomDownloads>, "activeDownloads"|"recentDownloads"|"clearRecentDownloads">}} props Downloads view properties. */
const RomDownloadsView = ({
  downloads: providedDownloads,
  onBack = null,
  immersive = false,
  onOpenGameDetails = null,
  onOpenCloudLibrary = null,
}) => {
  const contextDownloads = useRomDownloads();
  const { activeDownloads, recentDownloads, clearRecentDownloads } =
    providedDownloads ?? contextDownloads;
  return (
    <Box sx={{ maxWidth: 1400, mx: "auto", p: 3, width: "100%" }}>
      <Stack direction="row" spacing={2} sx={{ alignItems: "center", mb: 3 }}>
        {immersive && onBack !== null && (
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={onBack}
            sx={{ flexShrink: 0 }}
          >
            Back
          </Button>
        )}
        <Box
          {...tauriDragRegionProps()}
          sx={{ flex: 1, minWidth: 0, ...tauriDragRegionSx }}
        >
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <CloudDownloadIcon color="primary" />
            <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
              Downloads
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Active RomM ROM transfers and recent results.
          </Typography>
        </Box>
      </Stack>
      <Typography
        variant="overline"
        color="text.secondary"
        sx={{ letterSpacing: "0.08em" }}
      >
        Active
      </Typography>
      {activeDownloads.length === 0 ? (
        <DownloadsEmptyState
          onOpenGameDetails={onOpenGameDetails}
          onOpenCloudLibrary={onOpenCloudLibrary}
        />
      ) : (
        <ActiveDownloads activeDownloads={activeDownloads} />
      )}
      <Divider sx={{ my: 2 }} />
      <RecentDownloads
        clearRecentDownloads={clearRecentDownloads}
        recentDownloads={recentDownloads}
      />
    </Box>
  );
};

export default RomDownloadsView;
