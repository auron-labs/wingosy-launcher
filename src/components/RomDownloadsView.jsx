import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Alert from "@mui/material/Alert";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CloudDownloadIcon from "@mui/icons-material/CloudDownload";
import { useRomDownloads, formatDownloadLabel } from "../RomDownloadsContext";
import { tauriDragRegionProps, tauriDragRegionSx } from "../utils/isTauri";

export default function RomDownloadsView({ onBack = null, immersive = false }) {
  const { activeDownloads, recentDownloads } = useRomDownloads();

  return (
    <Box sx={{ p: 3, maxWidth: 900, mx: "auto", width: "100%" }}>
      <Stack direction="row" spacing={2} sx={{ mb: 3, alignItems: "center" }}>
        {immersive && onBack ? (
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={onBack}
            sx={{ flexShrink: 0 }}
          >
            Back
          </Button>
        ) : null}
        <Box {...tauriDragRegionProps()} sx={{ flex: 1, minWidth: 0, ...tauriDragRegionSx }}>
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

      <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: "0.08em" }}>
        Active
      </Typography>
      {activeDownloads.length === 0 ? (
        <Alert severity="info" sx={{ mt: 1, mb: 3 }}>
          No downloads in progress. Start a download from a game&apos;s details page or a cloud
          library tile.
        </Alert>
      ) : (
        <Stack spacing={2} sx={{ mt: 1, mb: 4 }}>
          {activeDownloads.map((row) => (
            <Paper key={row.gameId} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
                {row.gameName}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                {formatDownloadLabel(row)}
              </Typography>
              {row.percent != null ? (
                <LinearProgress variant="determinate" value={row.percent} sx={{ borderRadius: 1, height: 8 }} />
              ) : (
                <LinearProgress sx={{ borderRadius: 1, height: 8 }} />
              )}
            </Paper>
          ))}
        </Stack>
      )}

      <Divider sx={{ my: 2 }} />

      <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: "0.08em" }}>
        Recent
      </Typography>
      {recentDownloads.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Completed and failed downloads will appear here.
        </Typography>
      ) : (
        <List dense sx={{ mt: 1 }}>
          {recentDownloads.map((item, idx) => (
            <ListItem key={`${item.kind}-${item.gameId}-${item.at}-${idx}`} sx={{ px: 0 }}>
              <ListItemText
                primary={item.gameName}
                secondary={
                  item.kind === "complete"
                    ? item.path
                      ? `Saved · ${item.path}`
                      : "Finished"
                    : item.message || "Download failed"
                }
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
    </Box>
  );
}
