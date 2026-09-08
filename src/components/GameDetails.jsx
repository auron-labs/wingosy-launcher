import { useState, useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Divider from "@mui/material/Divider";
import Alert from "@mui/material/Alert";
import { alpha } from "@mui/material/styles";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import ListItemIcon from "@mui/material/ListItemIcon";
import LinearProgress from "@mui/material/LinearProgress";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import CloudDownloadIcon from "@mui/icons-material/CloudDownload";
import FavoriteIcon from "@mui/icons-material/Favorite";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import SportsEsportsIcon from "@mui/icons-material/SportsEsports";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import SaveIcon from "@mui/icons-material/Save";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import DeleteIcon from "@mui/icons-material/Delete";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import RefreshIcon from "@mui/icons-material/Refresh";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import StarIcon from "@mui/icons-material/Star";
import GroupsIcon from "@mui/icons-material/Groups";
import FolderSpecialIcon from "@mui/icons-material/FolderSpecial";
import SyncIcon from "@mui/icons-material/Sync";
import GameScreenshotsSection from "./game/GameScreenshotsSection";
import GameAchievementsSection from "./game/GameAchievementsSection";
import CollectionPickerDialog from "./game/CollectionPickerDialog";
import ConfirmDestructiveDialog from "./ConfirmDestructiveDialog";
import StatusChip from "./game/StatusChip";
import SyncStatusChip from "./SyncStatusChip";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { tauriDragRegionProps, tauriDragRegionSx, tauriNoDragProps, tauriNoDragSx } from "../utils/isTauri";
import { useRomDownloads, formatDownloadLabel } from "../RomDownloadsContext";
import { getLaunchErrorPresentation } from "../immersive/launchError";
import { isGameDownloaded, normalizeSyncState } from "../utils/gameFilters";

function isLocalPath(path) {
  if (!path) return false;
  return /^[a-zA-Z]:/.test(path) || path.startsWith("\\") || path.startsWith("/");
}

function getCoverSrc(coverPath) {
  if (!coverPath) return null;
  if (isLocalPath(coverPath)) {
    return convertFileSrc(coverPath);
  }
  return coverPath;
}

function getMediaSrc(url) {
  if (!url) return null;
  if (isLocalPath(url)) {
    return convertFileSrc(url);
  }
  return url;
}

function formatLastPlayed(iso) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return null;
  }
}

function launchStageLabel(stage) {
  switch (stage) {
    case "resolving": return "Resolving RomM session...";
    case "downloading": return "Downloading ROM...";
    case "validating": return "Validating ROM...";
    case "finalizing": return "Finalizing local copy...";
    case "bios_preparation": return "Preparing BIOS...";
    case "save_sync": return "Synchronizing saves...";
    case "launching": return "Launching emulator...";
    case "running": return "Emulator running";
    case "completion": return "Launch complete";
    case "failure": return "Launch failed";
    default: return "Preparing game...";
  }
}

export default function GameDetails({
  game,
  platforms,
  onBack,
  onLaunch,
  onToggleFavorite,
  onGameUpdate,
  rommToken,
  rommUrl,
  onOpenSettings = null,
  onOpenIntegrations = null,
}) {
  const { getProgress, getLaunchProgress, getSwitchContentProgress } = useRomDownloads();
  const romDl = getProgress(game.id);
  const launchProgress = getLaunchProgress(game.id);
  const switchContentProgress = getSwitchContentProgress(game.id);
  const [downloading, setDownloading] = useState(false);
  const downloadInFlightRef = useRef(false);
  const [launching, setLaunching] = useState(false);
  const launchInFlightRef = useRef(false);
  const [launchError, setLaunchError] = useState(null);
  const [downloadStatus, setDownloadStatus] = useState(null);
  const [saves, setSaves] = useState([]);
  const [savesLoaded, setSavesLoaded] = useState(false);
  const [savesLoading, setSavesLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [switchSlot, setSwitchSlot] = useState("autosave");
  const [switchPathInfo, setSwitchPathInfo] = useState(null);
  const [switchSyncBusy, setSwitchSyncBusy] = useState(false);
  const [imgError, setImgError] = useState(false);
  const isSwitch = game.platform_id === "switch";
  
  // Track if ROM was just downloaded (for immediate UI update)
  const [justDownloaded, setJustDownloaded] = useState(false);
  
  // Game actions menu state
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [actionStatus, setActionStatus] = useState(null);
  const [switchContentSyncing, setSwitchContentSyncing] = useState(false);
  const switchContentInFlightRef = useRef(false);
  const [refreshing, setRefreshing] = useState(false);
  const [retroachievementsEnabled, setRetroachievementsEnabled] = useState(false);
  const [collectionDialogOpen, setCollectionDialogOpen] = useState(false);
  const [collections, setCollections] = useState([]);

  useEffect(() => {
    if (!isSwitch || !game.romm_id) {
      setSwitchPathInfo(null);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const info = await invoke("get_switch_save_path_info", { gameId: game.id });
        if (!cancelled) setSwitchPathInfo(info);
      } catch {
        if (!cancelled) setSwitchPathInfo(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [game.id, game.romm_id, isSwitch]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cfg = await invoke("get_config");
        if (!cancelled) {
          setRetroachievementsEnabled(Boolean(cfg.display?.retroachievements_enabled));
        }
      } catch {
        if (!cancelled) setRetroachievementsEnabled(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const platform = platforms.find(([p]) => p.id === game.platform_id)?.[0];
  const playHours = Math.floor(game.play_time_minutes / 60);
  const playMins = game.play_time_minutes % 60;
  const playTimeStr =
    playHours > 0 ? `${playHours}h ${playMins}m` : `${playMins}m`;

  // Check if ROM is available locally
  const hasLocalFile = Boolean(
    justDownloaded ||
      (typeof game.local_file_path === "string" && game.local_file_path.trim()),
  );
  const syncState = normalizeSyncState(game.sync_state);
  const isSynced = syncState === "synced";
  const isRemoteOnly = syncState === "remote_only";
  const isDownloaded = isGameDownloaded(game, { justDownloaded });
  const canPlay = isDownloaded || Boolean(game.romm_id);
  const canDownload = game.romm_id && rommToken && rommUrl;
  const canSyncSwitchContent = isSwitch && game.source === "RomM" && game.romm_id && rommToken && rommUrl;
  const launchActive = launching || Boolean(launchProgress?.active);
  const downloadActive = downloading || Boolean(romDl);
  const visibleLaunchProgress = launching && launchProgress?.stage === "failure" ? null : launchProgress;
  const rawLaunchError = launchError || visibleLaunchProgress?.error;
  const launchErrorPresentation = getLaunchErrorPresentation(rawLaunchError, platform?.name);
  const launchFailed = visibleLaunchProgress?.stage === "failure" || Boolean(launchError);
  
  const coverSrc = getCoverSrc(game.cover_path);
  const showCover = coverSrc && !imgError;
  const syncStatus = isRemoteOnly ? "remote-only" : isSynced ? "synced" : "downloaded-not-synced";

  async function handleLaunchGame() {
    if (launchInFlightRef.current || downloadActive || switchContentInFlightRef.current) return;
    launchInFlightRef.current = true;
    setLaunching(true);
    setLaunchError(null);
    try {
      const result = await onLaunch(game.id);
      if (result && !result.success) {
        setLaunchError(result.error || "Unable to launch game");
      }
    } catch (err) {
      setLaunchError(err.message || String(err));
    } finally {
      launchInFlightRef.current = false;
      setLaunching(false);
    }
  }

  async function handleDownloadRom() {
    if (downloadInFlightRef.current || launchActive || switchContentInFlightRef.current || !rommToken || !rommUrl) return;
    downloadInFlightRef.current = true;
    try {
      setDownloading(true);
      setDownloadStatus(null);
      await invoke("download_rom", {
        gameId: game.id,
        serverUrl: rommUrl,
        token: rommToken,
      });
      
      // Mark as downloaded for immediate UI update
      setJustDownloaded(true);
      setDownloadStatus({ type: "success", message: `Downloaded! Ready to play.` });
      
      // Notify parent to refresh game list if callback provided
      if (onGameUpdate) {
        onGameUpdate(game.id);
      }
    } catch (err) {
      setDownloadStatus({ type: "error", message: err.message || String(err) });
    } finally {
      downloadInFlightRef.current = false;
      setDownloading(false);
    }
  }

  async function handleSyncSwitchContent() {
    if (
      switchContentInFlightRef.current
      || launchActive
      || downloadActive
      || !canSyncSwitchContent
    ) return;
    switchContentInFlightRef.current = true;
    setSwitchContentSyncing(true);
    setActionStatus({ type: "info", message: "Syncing Switch updates and DLC…" });
    try {
      const result = await invoke("sync_switch_content", { gameId: game.id });
      setActionStatus({
        type: "success",
        message: result.message || `Switch content synced: ${result.downloaded} downloaded, ${result.reused} reused.`,
      });
    } catch (err) {
      const message = err?.message || String(err);
      setActionStatus({
        type: "error",
        message: `${message} Choose “Sync Updates & DLC” to retry after correcting the issue.`,
      });
    } finally {
      switchContentInFlightRef.current = false;
      setSwitchContentSyncing(false);
    }
  }

  async function handleListSaves() {
    if (!game.romm_id || !rommToken || !rommUrl) return;
    try {
      setSavesLoading(true);
      setSaveStatus(null);
      const result = await invoke("get_game_saves", {
        rommId: game.romm_id,
        serverUrl: rommUrl,
        token: rommToken,
      });
      setSaves(result);
      setSavesLoaded(true);
    } catch (err) {
      setSaveStatus({ type: "error", message: err.message || String(err) });
    } finally {
      setSavesLoading(false);
    }
  }

  async function handleDownloadSave(saveId) {
    if (!game.romm_id || !rommToken || !rommUrl) return;
    try {
      setSaveStatus(null);
      if (isSwitch) {
        setSwitchSyncBusy(true);
        const result = await invoke("download_switch_save", {
          gameId: game.id,
          slot: switchSlot.trim() || null,
          saveId,
        });
        setSaveStatus({ type: "success", message: result.message || "Switch save restored to Eden" });
        return;
      }
      const path = await invoke("download_game_save", {
        rommId: game.romm_id,
        saveId,
        serverUrl: rommUrl,
        token: rommToken,
      });
      setSaveStatus({ type: "success", message: `Save downloaded to ${path}` });
    } catch (err) {
      setSaveStatus({ type: "error", message: err.message || String(err) });
    } finally {
      setSwitchSyncBusy(false);
    }
  }

  async function handleUploadSwitchSave() {
    if (!game.romm_id) return;
    try {
      setSwitchSyncBusy(true);
      setSaveStatus({ type: "info", message: "Uploading Eden save to RomM…" });
      const result = await invoke("upload_switch_save", {
        gameId: game.id,
        slot: switchSlot.trim() || null,
      });
      setSaveStatus({ type: "success", message: result.message || "Uploaded to RomM" });
      handleListSaves();
    } catch (err) {
      setSaveStatus({ type: "error", message: err.message || String(err) });
    } finally {
      setSwitchSyncBusy(false);
    }
  }

  async function handleDownloadSwitchSave() {
    if (!game.romm_id) return;
    try {
      setSwitchSyncBusy(true);
      setSaveStatus({ type: "info", message: "Downloading save from RomM to Eden…" });
      const result = await invoke("download_switch_save", {
        gameId: game.id,
        slot: switchSlot.trim() || null,
        saveId: null,
      });
      setSaveStatus({ type: "success", message: result.message || "Restored to Eden" });
    } catch (err) {
      setSaveStatus({ type: "error", message: err.message || String(err) });
    } finally {
      setSwitchSyncBusy(false);
    }
  }

  async function handleUploadSave() {
    if (!game.romm_id || !rommToken || !rommUrl) return;
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "Save Files", extensions: ["sav", "srm", "state", "ss0", "dat", "*"] }],
      });
      if (!selected) return;
      setSaveStatus({ type: "info", message: "Uploading save..." });
      await invoke("upload_game_save", {
        rommId: game.romm_id,
        filePath: selected,
        serverUrl: rommUrl,
        token: rommToken,
      });
      setSaveStatus({ type: "success", message: "Save uploaded!" });
      handleListSaves();
    } catch (err) {
      setSaveStatus({ type: "error", message: err.message || String(err) });
    }
  }

  // Game Actions handlers
  async function handleDeleteDownload() {
    if (launchActive) return;
    try {
      setDeleteDialogOpen(false);
      setMenuAnchor(null);
      setActionStatus({ type: "info", message: "Deleting ROM..." });
      await invoke("delete_local_rom", { gameId: game.id });
      setActionStatus({ type: "success", message: "ROM deleted successfully" });
      setJustDownloaded(false);
      if (onGameUpdate) {
        onGameUpdate(game.id);
      }
    } catch (err) {
      setActionStatus({ type: "error", message: err.message || String(err) });
    }
  }

  async function handleHideGame() {
    try {
      setMenuAnchor(null);
      await invoke("toggle_game_hidden", { gameId: game.id });
      setActionStatus({ type: "success", message: "Game hidden. View hidden games in Settings." });
      if (onGameUpdate) {
        onGameUpdate(game.id);
      }
      // Navigate back since game is now hidden
      setTimeout(() => onBack(), 1500);
    } catch (err) {
      setActionStatus({ type: "error", message: err.message || String(err) });
    }
  }

  async function handleRefreshMetadata() {
    if (!rommToken || !rommUrl || !game.romm_id) return;
    try {
      setMenuAnchor(null);
      setRefreshing(true);
      setActionStatus({ type: "info", message: "Refreshing metadata from RomM..." });
      await invoke("refresh_game_metadata", {
        gameId: game.id,
        serverUrl: rommUrl,
        token: rommToken,
      });
      setActionStatus({ type: "success", message: "Metadata refreshed!" });
      if (onGameUpdate) {
        onGameUpdate(game.id);
      }
    } catch (err) {
      setActionStatus({ type: "error", message: err.message || String(err) });
    } finally {
      setRefreshing(false);
    }
  }

  async function handleOpenLocation() {
    try {
      setMenuAnchor(null);
      await invoke("open_rom_location", { gameId: game.id });
    } catch (err) {
      setActionStatus({ type: "error", message: err.message || String(err) });
    }
  }

  async function openAddToCollection() {
    setMenuAnchor(null);
    try {
      const cols = await invoke("get_collections");
      setCollections(cols);
      setCollectionDialogOpen(true);
    } catch (err) {
      setActionStatus({ type: "error", message: err.message || String(err) });
    }
  }

  async function handlePickCollection(collectionId) {
    try {
      await invoke("add_game_to_collection", { collectionId, gameId: game.id });
      setActionStatus({ type: "success", message: "Added to collection." });
    } catch (err) {
      setActionStatus({ type: "error", message: err.message || String(err) });
    }
  }

  const screenshots = Array.isArray(game.screenshot_paths)
    ? game.screenshot_paths
    : [];
  const lastPlayedLabel = formatLastPlayed(game.last_played_at);

  return (
    <Box sx={{ width: "100%", maxWidth: { xs: "100%", md: 1400, xl: 1800 }, mx: "auto" }}>
      <Box
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          gap: 2,
          flexWrap: "wrap",
          py: 1.5,
          px: 2,
          mb: 2,
          mx: { xs: -1, sm: 0 },
          borderRadius: 2,
          bgcolor: (t) => alpha(t.palette.background.default, 0.92),
          backdropFilter: "blur(10px)",
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <Button
          {...tauriNoDragProps()}
          data-argosy-sound="back"
          startIcon={<ArrowBackIcon />}
          onClick={onBack}
          color="inherit"
          sx={{ ...tauriNoDragSx, flexShrink: 0 }}
        >
          Back to Library
        </Button>
        <Box
          {...tauriDragRegionProps()}
          sx={{
            flex: 1,
            minWidth: 80,
            minHeight: 36,
            ...tauriDragRegionSx,
          }}
        />
      </Box>

      <Box sx={{ px: { xs: 2, sm: 3 }, pb: 3 }}>
      {/* Hero Cover */}
      {showCover && (
        <Box
          data-testid="game-details-hero"
          sx={{
            width: "100%",
            height: { xs: 260, sm: 340, md: 390 },
            borderRadius: 3,
            overflow: "hidden",
            mb: 3,
            position: "relative",
            bgcolor: "rgba(0,0,0,0.3)",
            boxShadow: "0 12px 36px rgba(0,0,0,0.28)",
          }}
        >
          <Box
            component="img"
            src={coverSrc}
            alt={game.name}
            onError={() => setImgError(true)}
            sx={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center",
              filter: "brightness(0.62) saturate(0.92)",
            }}
          />
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "flex-end",
              p: { xs: 2.5, sm: 4 },
              background:
                "linear-gradient(180deg, rgba(8,8,12,0.04) 25%, rgba(8,8,12,0.18) 48%, rgba(8,8,12,0.92) 100%)",
            }}
          >
            <Typography
              variant="h3"
              component="h1"
              sx={{
                fontWeight: 800,
                color: "#fff",
                letterSpacing: "-0.02em",
                textShadow: "0 2px 12px rgba(0,0,0,0.8)",
              }}
            >
              {game.name}
            </Typography>
          </Box>
        </Box>
      )}

      <Paper
        sx={{
          p: 4,
          borderRadius: 3,
          background: "linear-gradient(135deg, #1e1e26 0%, #252530 100%)",
        }}
      >
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <Box sx={{ flex: 1 }}>
            {!showCover && (
              <Typography variant="h4" gutterBottom>
                {game.name}
              </Typography>
            )}

            <Box
              data-testid="game-status-chips"
              sx={{ display: "flex", gap: 1, mb: 3, flexWrap: "wrap", alignItems: "center" }}
            >
              <StatusChip label={platform?.name || game.platform_id} />
              {game.source === "RomM" && (
                <StatusChip label="RomM" />
              )}
              {syncState && syncState !== "local_only" && (
                <SyncStatusChip status={syncStatus} />
              )}
              {game.genres?.map((genre) => (
                <Chip key={genre} label={genre} size="small" variant="outlined" />
              ))}
            </Box>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center" }}>
            <Tooltip title={game.is_favorite ? "Remove favorite" : "Add favorite"}>
              <IconButton
                onClick={() => onToggleFavorite(game.id)}
                size="large"
                aria-label={game.is_favorite ? `Remove ${game.name} from favorites` : `Add ${game.name} to favorites`}
                aria-pressed={Boolean(game.is_favorite)}
                sx={{ ml: 1, width: 48, height: 48 }}
              >
                {game.is_favorite ? (
                  <FavoriteIcon color="error" fontSize="large" />
                ) : (
                  <FavoriteBorderIcon fontSize="large" />
                )}
              </IconButton>
            </Tooltip>
            
            {/* Game Actions Menu */}
            <Tooltip title="More options">
              <IconButton
                onClick={(e) => setMenuAnchor(e.currentTarget)}
                size="large"
                aria-label="More options"
                sx={{ width: 48, height: 48 }}
              >
                <MoreVertIcon fontSize="large" />
              </IconButton>
            </Tooltip>
            
            <Menu
              anchorEl={menuAnchor}
              open={Boolean(menuAnchor)}
              onClose={() => setMenuAnchor(null)}
            >
              <MenuItem onClick={openAddToCollection}>
                <ListItemIcon>
                  <FolderSpecialIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="Add to collection" secondary="Manual collections" slotProps={{ secondary: { variant: "caption" } }} />
              </MenuItem>
              {game.romm_id && rommToken && rommUrl && (
                <MenuItem onClick={handleRefreshMetadata} disabled={refreshing}>
                  <ListItemIcon>
                    <RefreshIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary={refreshing ? "Refreshing..." : "Refresh game data"}
                    secondary="From RomM"
                    slotProps={{ secondary: { variant: "caption" } }}
                  />
                </MenuItem>
              )}

              {hasLocalFile && <Divider />}

              {/* Keep deletion separated from navigation actions and always confirm it. */}
              {hasLocalFile && (
                <MenuItem
                  onClick={() => {
                    setMenuAnchor(null);
                    setDeleteDialogOpen(true);
                  }}
                  sx={{ color: "error.main" }}
                >
                  <ListItemIcon>
                    <DeleteIcon fontSize="small" color="error" />
                  </ListItemIcon>
                  <ListItemText>Delete Download</ListItemText>
                </MenuItem>
              )}

              {hasLocalFile && <Divider />}

              {/* Open ROM Location - only if has local file */}
              {hasLocalFile && (
                <MenuItem onClick={handleOpenLocation}>
                  <ListItemIcon>
                    <FolderOpenIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Open ROM Location</ListItemText>
                </MenuItem>
              )}

              {/* Hide Game */}
              <MenuItem onClick={handleHideGame}>
                <ListItemIcon>
                  <VisibilityOffIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Hide Game</ListItemText>
              </MenuItem>

            </Menu>
          </Box>
        </Box>
        
        {/* Delete Confirmation Dialog */}
        <ConfirmDestructiveDialog
          open={deleteDialogOpen}
          title="Delete Downloaded ROM?"
          message={
            `This will delete the local ROM file for "${game.name}".` +
            (game.romm_id
              ? " The game will remain in your library (from RomM) and can be re-downloaded."
              : " This will remove the game from your library completely.")
          }
          confirmLabel="Delete"
          onCancel={() => setDeleteDialogOpen(false)}
          onConfirm={handleDeleteDownload}
        />
        
        {/* Action Status Alert */}
        {actionStatus && (
          <Alert 
            severity={actionStatus.type} 
            sx={{ mb: 2 }}
            onClose={() => setActionStatus(null)}
          >
            {actionStatus.message}
          </Alert>
        )}

        {/* Play and/or Download buttons */}
        <Box sx={{ display: "flex", gap: 2, mb: 4, flexWrap: "wrap", alignItems: "center" }}>
          {/* Remote RomM games prepare their ROM as part of Play. */}
          {canPlay && (
            <Button
              variant="contained"
              size="large"
              startIcon={<PlayArrowIcon />}
              onClick={handleLaunchGame}
              disabled={launchActive || downloadActive || switchContentSyncing}
              sx={{
                px: 5,
                py: 1.5,
                fontSize: "1.1rem",
                borderRadius: 3,
              }}
            >
              {launchActive ? "Preparing..." : "Play"}
            </Button>
          )}

          {/* Keep manual Download available for remote-only games. */}
          {game.romm_id && !hasLocalFile && (
            <Tooltip 
              title={!rommToken || !rommUrl ? "Connect to RomM server in Settings to download" : ""}
              arrow
            >
              <span>
                <Button
                  variant="outlined"
                  size="large"
                  startIcon={downloading ? null : <CloudDownloadIcon />}
                  onClick={handleDownloadRom}
                  disabled={downloading || launchActive || switchContentSyncing || !rommToken || !rommUrl}
                  sx={{
                    px: 5,
                    py: 1.5,
                    fontSize: "1.1rem",
                    borderRadius: 3,
                  }}
                >
                  {downloading ? "Downloading..." : "Download ROM"}
                </Button>
              </span>
            </Tooltip>
          )}

          {/* Show Re-download option for already downloaded RomM games */}
          {canDownload && hasLocalFile && (
            <Button
              variant="outlined"
              size="small"
              startIcon={downloading ? null : <CloudDownloadIcon />}
              onClick={handleDownloadRom}
              disabled={downloading || launchActive || switchContentSyncing}
              color="secondary"
              sx={{
                borderRadius: 3,
              }}
            >
              {downloading ? "Downloading..." : "Re-download"}
            </Button>
          )}

          {canSyncSwitchContent && (
            <Button
              variant="outlined"
              size="small"
              startIcon={switchContentSyncing ? null : <SyncIcon />}
              onClick={handleSyncSwitchContent}
              disabled={switchContentSyncing || launchActive || downloadActive}
              color="secondary"
              sx={{ borderRadius: 3 }}
            >
              {switchContentSyncing ? "Syncing Updates & DLC…" : "Sync Updates & DLC"}
            </Button>
          )}
        </Box>

        {(visibleLaunchProgress || launchError) && (
          <Box sx={{ mb: 2 }}>
            <Alert
              severity={launchFailed ? "error" : visibleLaunchProgress?.stage === "completion" ? "success" : "info"}
              action={launchFailed ? (
                <Box sx={{ display: "flex", gap: 0.5 }}>
                  {!launchErrorPresentation.retryable && onOpenSettings ? (
                    <Button color="inherit" size="small" onClick={onOpenSettings}>
                      Open Settings
                    </Button>
                  ) : null}
                  {launchErrorPresentation.retryable ? (
                    <Button color="inherit" size="small" onClick={handleLaunchGame} disabled={launchActive || downloadActive}>
                      Retry
                    </Button>
                  ) : null}
                </Box>
              ) : undefined}
            >
              {launchFailed ? launchErrorPresentation.message : visibleLaunchProgress ? launchStageLabel(visibleLaunchProgress.stage) : "Launch failed"}
              {launchFailed ? (
                <Typography variant="body2" sx={{ display: "block", mt: 0.5 }}>
                  {launchErrorPresentation.guidance}
                </Typography>
              ) : null}
            </Alert>
            {(visibleLaunchProgress?.stage === "downloading" || visibleLaunchProgress?.stage === "bios_preparation") && (
              <Box sx={{ mt: 1 }}>
                {visibleLaunchProgress.percent != null ? (
                  <LinearProgress variant="determinate" value={visibleLaunchProgress.percent} sx={{ borderRadius: 2 }} />
                ) : (
                  <LinearProgress sx={{ borderRadius: 2 }} />
                )}
                {visibleLaunchProgress.downloaded != null ? (
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                    {formatDownloadLabel(visibleLaunchProgress)}
                  </Typography>
                ) : null}
              </Box>
            )}
          </Box>
        )}
        
        {downloading && (
          <Box sx={{ mb: 2 }}>
            {romDl?.percent != null ? (
              <LinearProgress variant="determinate" value={romDl.percent} sx={{ borderRadius: 2 }} />
            ) : (
              <LinearProgress sx={{ borderRadius: 2 }} />
            )}
            {romDl ? (
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                {formatDownloadLabel(romDl)}
              </Typography>
            ) : null}
          </Box>
        )}
        {downloadStatus && (
          <Alert severity={downloadStatus.type} sx={{ mb: 2 }}>
            {downloadStatus.message}
          </Alert>
        )}
        {switchContentSyncing && (
          <Box sx={{ mb: 2 }} data-testid="switch-content-sync-progress">
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
              {switchContentProgress?.stage === "registering"
                ? "Registering content with Eden…"
                : switchContentProgress?.stage === "reusing"
                  ? "Reusing unchanged content…"
                  : "Downloading Switch content…"}
              {switchContentProgress?.file_index && switchContentProgress.total_files
                ? ` (${switchContentProgress.file_index}/${switchContentProgress.total_files})`
                : ""}
            </Typography>
            <LinearProgress
              variant={switchContentProgress?.percent != null ? "determinate" : "indeterminate"}
              value={switchContentProgress?.percent ?? undefined}
              sx={{ borderRadius: 2 }}
            />
            {switchContentProgress?.downloaded != null ? (
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                {formatDownloadLabel(switchContentProgress)}
              </Typography>
            ) : null}
          </Box>
        )}

        <GameScreenshotsSection
          urls={screenshots}
          getMediaSrc={getMediaSrc}
          isRommGame={Boolean(game.romm_id)}
        />

        <Divider sx={{ my: 3 }} />

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
            gap: 2,
            mb: 3,
          }}
        >
          <GameStat Icon={AccessTimeIcon} label="Play time" value={playTimeStr} />
          <GameStat Icon={SportsEsportsIcon} label="Times played" value={game.play_count} />

          {lastPlayedLabel && (
            <GameStat Icon={CalendarTodayIcon} label="Last played" value={lastPlayedLabel} />
          )}

          {game.release_year && (
            <GameStat Icon={CalendarTodayIcon} label="Release year" value={game.release_year} />
          )}

          {game.user_rating != null && game.user_rating !== undefined && (
            <GameStat
              Icon={StarIcon}
              label="IGDB aggregated rating"
              value={`${Number(game.user_rating).toFixed(1)} / 100`}
            />
          )}

          {game.player_count && (
            <GameStat Icon={GroupsIcon} label="Game modes" value={game.player_count} />
          )}
        </Box>

        <GameAchievementsSection
          gameName={game.name}
          retroAchievementsEnabled={retroachievementsEnabled}
          onOpenIntegrations={onOpenIntegrations}
        />

        {/* Developer / Publisher */}
        {(game.developer || game.publisher) && (
          <Box sx={{ display: "flex", gap: 4, mb: 3 }}>
            {game.developer && (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Developer
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {game.developer}
                </Typography>
              </Box>
            )}
            {game.publisher && (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Publisher
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {game.publisher}
                </Typography>
              </Box>
            )}
          </Box>
        )}

        {game.summary && (
          <>
            <Typography variant="h6" gutterBottom>
              About
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ lineHeight: 1.8 }}
            >
              {game.summary}
            </Typography>
          </>
        )}

        {!game.summary && (
          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
            No description available.
          </Typography>
        )}

        {/* Save Sync Section */}
        {game.romm_id && rommToken && rommUrl && (
          <>
            <Divider sx={{ my: 3 }} />
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
              <SaveIcon color="primary" />
              <Typography variant="h6">Saves</Typography>
            </Box>

            {isSwitch && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Eden / Argosy-compatible sync: zips the title save folder to RomM. Use named slots for
                separate backups (e.g. before a boss, different playthroughs). In-game Zelda slots share
                one folder — use different RomM slot names for separate exports.
              </Typography>
            )}

            {isSwitch && switchPathInfo && (
              <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: "block" }}>
                Title ID: {switchPathInfo.title_id} · Eden path: {switchPathInfo.local_save_path}
              </Typography>
            )}

            {isSwitch && (
              <TextField
                label="RomM slot (channel)"
                size="small"
                value={switchSlot}
                onChange={(e) => setSwitchSlot(e.target.value)}
                helperText='Default "autosave" matches Argosy latest-save sync; older "argosy-latest" saves still restore.'
                sx={{ mb: 2, maxWidth: 360 }}
                fullWidth
              />
            )}

            <Box sx={{ display: "flex", gap: 2, mb: 2, flexWrap: "wrap" }}>
              <Button
                variant="outlined"
                size="small"
                onClick={handleListSaves}
                disabled={savesLoading}
              >
                {savesLoading ? "Loading..." : savesLoaded ? "Refresh Saves" : "List Saves"}
              </Button>
              {isSwitch ? (
                 <>
                   <Button
                     variant="outlined"
                     size="small"
                     startIcon={<UploadFileIcon />}
                     onClick={handleUploadSwitchSave}
                     disabled={switchSyncBusy}
                   >
                     Sync to RomM
                   </Button>
                   <Button
                    variant="outlined"
                    size="small"
                    startIcon={<FileDownloadIcon />}
                    onClick={handleDownloadSwitchSave}
                    disabled={switchSyncBusy}
                  >
                    Restore from RomM
                  </Button>
                </>
              ) : (
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<UploadFileIcon />}
                  onClick={handleUploadSave}
                >
                  Upload Save
                </Button>
              )}
            </Box>

            {savesLoaded && saves.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                No saves found on server.
              </Typography>
            )}

            {saves.length > 0 && (
              <List dense sx={{ bgcolor: "rgba(0,0,0,0.15)", borderRadius: 2, mb: 2 }}>
                {saves.map((save) => (
                  <ListItem
                    key={save.id}
                    secondaryAction={
                      <IconButton
                        edge="end"
                        size="small"
                        onClick={() => handleDownloadSave(save.id)}
                        title="Download save"
                      >
                        <FileDownloadIcon fontSize="small" />
                      </IconButton>
                    }
                  >
                     <ListItemText
                       primary={save.file_name}
                       secondary={
                         [save.slot, save.updated_at || save.created_at]
                           .filter(Boolean)
                           .join(" · ") || null
                       }
                     />
                  </ListItem>
                ))}
              </List>
            )}

            {saveStatus && (
              <Alert severity={saveStatus.type} sx={{ mt: 1 }} onClose={() => setSaveStatus(null)}>
                {saveStatus.message}
              </Alert>
            )}
          </>
        )}
      </Paper>

      <CollectionPickerDialog
        open={collectionDialogOpen}
        onClose={() => setCollectionDialogOpen(false)}
        collections={collections}
        onPick={handlePickCollection}
        gameName={game.name}
      />

      </Box>
    </Box>
  );
}

function GameStat({ Icon, label, value }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "auto minmax(0, 1fr)",
        gridTemplateRows: "auto auto",
        columnGap: 1.25,
        rowGap: 0.25,
        alignItems: "baseline",
        minWidth: 0,
      }}
    >
      <Icon color="action" sx={{ gridRow: "1 / span 2", alignSelf: "center" }} />
      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.25 }}>
        {label}
      </Typography>
      <Typography
        variant="h6"
        component="div"
        sx={{ fontWeight: 700, lineHeight: 1.25, overflowWrap: "anywhere" }}
      >
        {value}
      </Typography>
    </Box>
  );
}
