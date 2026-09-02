import { useCallback, useEffect, useState, useRef } from "react";
import { useRomDownloads, formatDownloadLabel } from "../RomDownloadsContext";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Divider from "@mui/material/Divider";
import Alert from "@mui/material/Alert";
import LinearProgress from "@mui/material/LinearProgress";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import CloudDownloadIcon from "@mui/icons-material/CloudDownload";
import DeleteIcon from "@mui/icons-material/Delete";
import FavoriteIcon from "@mui/icons-material/Favorite";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import RefreshIcon from "@mui/icons-material/Refresh";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import SaveIcon from "@mui/icons-material/Save";
import FolderSpecialIcon from "@mui/icons-material/FolderSpecial";
import { alpha } from "@mui/material/styles";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { useAppTheme } from "../ThemeContext";
import KeyboardHint from "../components/KeyboardHint";
import GameScreenshotsSection from "../components/game/GameScreenshotsSection";
import GameAchievementsSection from "../components/game/GameAchievementsSection";
import CollectionPickerDialog from "../components/game/CollectionPickerDialog";
import ConfirmDestructiveDialog from "../components/ConfirmDestructiveDialog";
import {
  describeControllerElement,
  getControllerAction,
  logControllerOutcome,
} from "./controllerDebug";
import { getLaunchErrorPresentation } from "./launchError";

const DETAILS_ACTION_SELECTOR = "button:not(:disabled)";
const INPUT_OVERLAY_SELECTOR = '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]';

function getVisibleDetailsActions(root) {
  return Array.from(root?.querySelectorAll(DETAILS_ACTION_SELECTOR) || []).filter((element) => {
    for (let current = element; current; current = current.parentElement) {
      if (current.hidden || current.getAttribute("aria-hidden") === "true") return false;
      const style = window.getComputedStyle(current);
      if (style.display === "none" || style.visibility === "hidden") return false;
      if (current === root) break;
    }
    return true;
  });
}

function isLocalPath(path) {
  if (!path) return false;
  return /^[a-zA-Z]:/.test(path) || path.startsWith("\\") || path.startsWith("/");
}

function getMediaSrc(url) {
  if (!url) return null;
  if (isLocalPath(url)) return convertFileSrc(url);
  return url;
}

function launchStageLabel(stage) {
  switch (stage) {
    case "resolving": return "Preparing game...";
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

function launchProgressLabel(progress) {
  const downloadLabel = formatDownloadLabel(progress);
  if (progress?.percent != null && progress.total == null) {
    return `${progress.percent}%${downloadLabel ? ` · ${downloadLabel}` : ""}`;
  }
  return downloadLabel;
}

export default function ImmersiveGameDetails({
  game,
  platformLabel,
  onBack,
  onLaunch,
  onToggleFavorite,
  onGameUpdate,
  onOpenSettings = () => {},
  onOpenIntegrations = null,
  rommToken,
  rommUrl,
  retroachievementsEnabled = false,
}) {
  const { colors } = useAppTheme();
  const { getProgress, getLaunchProgress } = useRomDownloads();
  const romDl = getProgress(game.id);
  const launchProgress = getLaunchProgress(game.id);
  const [downloading, setDownloading] = useState(false);
  const downloadInFlightRef = useRef(false);
  const [downloadStatus, setDownloadStatus] = useState(null);
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState(null);
  const launchInFlightRef = useRef(false);
  const staleLaunchProgressRef = useRef(null);
  const primaryActionRef = useRef(null);
  const detailsRef = useRef(null);
  const wasLaunchingRef = useRef(false);
  const [justDownloaded, setJustDownloaded] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [actionStatus, setActionStatus] = useState(null);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [collectionDialogOpen, setCollectionDialogOpen] = useState(false);
  const [collections, setCollections] = useState([]);
  const savesSectionRef = useRef(null);

  function markDetailsActionFocus(event) {
    if (event.target?.matches?.(DETAILS_ACTION_SELECTOR)) {
      event.target.setAttribute("data-controller-focused", "true");
    }
  }

  function clearDetailsActionFocus(event) {
    if (event.target?.matches?.(DETAILS_ACTION_SELECTOR)) {
      event.target.removeAttribute("data-controller-focused");
    }
  }

  const hasLocalFile = (game.local_file_path && game.local_file_path.length > 0) || justDownloaded;
  const isLocalGame = !game.romm_id && game.source !== "RomM";
  const canPlay = hasLocalFile || isLocalGame;
  const canDownload = game.romm_id && rommToken && rommUrl;
  const launchActive = launching;
  const attemptProgress = launchProgress &&
    launchProgress !== staleLaunchProgressRef.current
    ? launchProgress
    : null;
  const visibleLaunchProgress = (launching || launchError)
    ? attemptProgress
    : null;
  const launchFailure = Boolean(launchError || visibleLaunchProgress?.stage === "failure");
  const launchDialogOpen = Boolean(launching || visibleLaunchProgress || launchFailure);
  const rawLaunchError = launchError || visibleLaunchProgress?.error;
  const launchErrorPresentation = getLaunchErrorPresentation(rawLaunchError, platformLabel);
  const retryableLaunchFailure = launchFailure && launchErrorPresentation.retryable;

  const handleLaunchGame = useCallback(async () => {
    if (launchInFlightRef.current || downloadInFlightRef.current || launchActive) return;
    launchInFlightRef.current = true;
    staleLaunchProgressRef.current = launchProgress;
    setLaunching(true);
    setLaunchError(null);
    try {
      const result = await onLaunch(game.id);
      if (result && !result.success) {
        setLaunchError(result.error || "Unable to launch game");
      }
    } catch (err) {
      setLaunchError(err?.message || String(err));
    } finally {
      launchInFlightRef.current = false;
      setLaunching(false);
    }
  }, [game.id, launchActive, launchProgress, onLaunch]);

  const handleDownloadRom = useCallback(async () => {
    if (downloadInFlightRef.current || launchActive || !rommToken || !rommUrl) return;
    downloadInFlightRef.current = true;
    try {
      setDownloading(true);
      setDownloadStatus(null);
      await invoke("download_rom", {
        gameId: game.id,
        serverUrl: rommUrl,
        token: rommToken,
      });
      setJustDownloaded(true);
      setDownloadStatus({ type: "success", message: "Downloaded! Ready to play." });
      if (onGameUpdate) onGameUpdate(game.id);
    } catch (err) {
      setDownloadStatus({ type: "error", message: err.message || String(err) });
    } finally {
      downloadInFlightRef.current = false;
      setDownloading(false);
    }
  }, [game.id, launchActive, onGameUpdate, rommToken, rommUrl]);

  useEffect(() => {
    if (wasLaunchingRef.current && !launching && !launchFailure) {
      primaryActionRef.current?.focus();
    }
    wasLaunchingRef.current = launching;
  }, [launchFailure, launching]);

  useEffect(() => {
    function onWindowKeyDown(e) {
      const action = getControllerAction(e);
      const targetIsWindow = e.target === window || e.target?.window === e.target;
      if (!targetIsWindow) {
        logControllerOutcome(action, "details", "ignored", { reason: "event-target-not-window" });
        return;
      }
      if (e.repeat) {
        logControllerOutcome(action, "details", "suppressed", { reason: "keyboard-repeat" });
        return;
      }
      if (e.key.startsWith("Arrow")) {
        const overlay = document.querySelector(INPUT_OVERLAY_SELECTOR);
        if (overlay) {
          logControllerOutcome(action, "details", "suppressed", {
            reason: `${overlay.getAttribute("role") || "overlay"} open`,
          });
          return;
        }
        const actions = getVisibleDetailsActions(detailsRef.current);
        if (!actions.length) {
          logControllerOutcome(action, "details", "ignored", { reason: "no-visible-actions" });
          return;
        }

        const direction = e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 1;
        const focusedIndex = actions.indexOf(document.activeElement);
        const anchorIndex = actions.indexOf(primaryActionRef.current);
        const startIndex = focusedIndex >= 0
          ? focusedIndex
          : anchorIndex >= 0
            ? anchorIndex + (canPlay || direction < 0 ? 0 : -1)
            : direction > 0
              ? -1
              : actions.length;
        const nextIndex = Math.max(0, Math.min(actions.length - 1, startIndex + direction));
        const beforeFocus = describeControllerElement(document.activeElement);
        const target = actions[nextIndex];
        e.preventDefault();
        target?.focus();
        const afterFocus = describeControllerElement(document.activeElement);
        if (!target) {
          logControllerOutcome(action, "details", "ignored", {
            reason: "focus-target-missing",
            beforeFocus,
            afterFocus,
            targetIndex: nextIndex,
          });
        } else {
          const focused = document.activeElement === target;
          logControllerOutcome(action, "details", focused ? "handled" : "ignored", {
            reason: !focused
              ? "focus-target-not-focused"
              : nextIndex === startIndex
                ? "focus-boundary"
                : "focus-moved",
            beforeFocus,
            afterFocus,
            targetFocus: describeControllerElement(target),
          });
        }
        return;
      }
      if (e.key === "Enter") {
        const hasInputOverlay = document.querySelector(INPUT_OVERLAY_SELECTOR);
        if (hasInputOverlay) {
          if (launchFailure && !launching) {
            e.preventDefault();
            if (retryableLaunchFailure) {
              handleLaunchGame();
              logControllerOutcome(action, "details", "handled", { reason: "retry-launch" });
            } else {
              onOpenSettings();
              logControllerOutcome(action, "details", "handled", { reason: "open-settings" });
            }
          } else {
            logControllerOutcome(action, "details", "suppressed", {
              reason: `${hasInputOverlay.getAttribute("role") || "overlay"} open`,
            });
          }
          return;
        }
        const focusedAction = getVisibleDetailsActions(detailsRef.current).find(
          (action) => action === document.activeElement,
        );
        if (focusedAction && !launching) {
          e.preventDefault();
          focusedAction.click();
          logControllerOutcome(action, "details", "handled", {
            reason: "activate-focused-action",
            targetFocus: describeControllerElement(focusedAction),
          });
          return;
        }
        if (launchFailure && !launching) {
          e.preventDefault();
          if (retryableLaunchFailure) {
            handleLaunchGame();
            logControllerOutcome(action, "details", "handled", { reason: "retry-launch" });
          } else {
            onOpenSettings();
            logControllerOutcome(action, "details", "handled", { reason: "open-settings" });
          }
          return;
        }
        if (launching) {
          logControllerOutcome(action, "details", "suppressed", { reason: "launch-in-progress" });
          return;
        }
        e.preventDefault();
        if (canPlay) {
          handleLaunchGame();
          logControllerOutcome(action, "details", "handled", { reason: "launch-default" });
        } else {
          handleDownloadRom();
          logControllerOutcome(action, "details", "handled", { reason: "download-default" });
        }
      } else if (e.key === "Escape") {
        if (!launchFailure) {
          logControllerOutcome(action, "details", "ignored", { reason: "no-launch-failure" });
          return;
        }
        e.preventDefault();
        onBack();
        logControllerOutcome(action, "details", "handled", { reason: "return-from-launch-failure" });
      }
    }

    window.addEventListener("keydown", onWindowKeyDown);
    return () => window.removeEventListener("keydown", onWindowKeyDown);
  }, [canPlay, handleDownloadRom, handleLaunchGame, launchFailure, launching, onBack, onOpenSettings, retryableLaunchFailure]);

  const screenshots = Array.isArray(game.screenshot_paths) ? game.screenshot_paths : [];

  async function handleDeleteDownload() {
    try {
      setDeleteDialogOpen(false);
      setActionStatus({ type: "info", message: "Deleting ROM..." });
      await invoke("delete_local_rom", { gameId: game.id });
      setActionStatus({ type: "success", message: "ROM deleted successfully" });
      setJustDownloaded(false);
      if (onGameUpdate) onGameUpdate(game.id);
    } catch (err) {
      setActionStatus({ type: "error", message: err.message || String(err) });
    }
  }

  async function handleRefreshMetadata() {
    if (!rommToken || !rommUrl || !game.romm_id) return;
    try {
      setMenuAnchor(null);
      setRefreshing(true);
      await invoke("refresh_game_metadata", {
        gameId: game.id,
        serverUrl: rommUrl,
        token: rommToken,
      });
      if (onGameUpdate) onGameUpdate(game.id);
    } catch (err) {
      setActionStatus({ type: "error", message: err.message || String(err) });
    } finally {
      setRefreshing(false);
    }
  }

  async function handleHideGame() {
    try {
      setMenuAnchor(null);
      await invoke("toggle_game_hidden", { gameId: game.id });
      if (onGameUpdate) onGameUpdate(game.id);
      setTimeout(() => onBack(), 800);
    } catch (err) {
      setActionStatus({ type: "error", message: err.message || String(err) });
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

  function scrollToSaves() {
    setMenuAnchor(null);
    savesSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
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

  return (
    <Box
      ref={detailsRef}
      data-testid="immersive-game-details"
      sx={{
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        overflowX: "hidden",
        overscrollBehavior: "contain",
        p: 5,
        bgcolor: "background.default",
        backgroundImage: `radial-gradient(1000px 380px at 10% -5%, ${alpha(colors.primary, 0.12)} 0%, transparent 52%),
          radial-gradient(800px 320px at 92% 5%, ${alpha(colors.primaryLight, 0.07)} 0%, transparent 48%)`,
      }}
      onFocus={markDetailsActionFocus}
      onBlur={clearDetailsActionFocus}
    >
      <Button
        data-argosy-sound="back"
        startIcon={<ArrowBackIcon />}
        onClick={onBack}
        color="inherit"
        sx={{ mb: 3, borderRadius: 2, px: 2.5, textTransform: "none", fontWeight: 700 }}
      >
        Back
      </Button>

      <GameScreenshotsSection
        urls={screenshots}
        getMediaSrc={getMediaSrc}
        isRommGame={Boolean(game.romm_id)}
      />

      <Paper
        elevation={0}
        sx={(t) => ({
          borderRadius: 3,
          overflow: "hidden",
          bgcolor: t.palette.mode === "dark" ? alpha(t.palette.background.paper, 0.98) : t.palette.background.paper,
          boxShadow: `0 20px 56px ${alpha("#000", t.palette.mode === "dark" ? 0.55 : 0.12)}`,
          border: `1px solid ${t.palette.divider}`,
        })}
      >
        <Box
          sx={{
            p: 4,
            background: `radial-gradient(1200px 500px at 15% 0%, ${alpha(colors.primary, 0.22)} 0%, transparent 55%),
              radial-gradient(900px 450px at 85% 10%, ${alpha(colors.primaryLight, 0.14)} 0%, transparent 58%)`,
          }}
        >
          <Stack direction="row" spacing={2} sx={{ mb: 2, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
            <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap", alignItems: "center" }}>
              {platformLabel ? (
                <Chip
                  label={platformLabel}
                  sx={{
                    fontWeight: 900,
                    bgcolor: "rgba(255,255,255,0.08)",
                    color: "#fff",
                  }}
                />
              ) : null}
              {game.is_favorite ? (
                <Chip
                  label="Favorite"
                  sx={{
                    fontWeight: 900,
                    bgcolor: "rgba(239,68,68,0.18)",
                    color: "#fff",
                  }}
                />
              ) : null}
            </Stack>
            <IconButton color="inherit" onClick={(e) => setMenuAnchor(e.currentTarget)} aria-label="More options">
              <MoreVertIcon />
            </IconButton>
            <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
              {game.romm_id && rommToken && rommUrl && (
                <MenuItem onClick={scrollToSaves}>
                  <ListItemIcon>
                    <SaveIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary="Manage cached saves" secondary="RomM cloud saves" slotProps={{ secondary: { variant: "caption" } }} />
                </MenuItem>
              )}
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
              <Divider />
              {hasLocalFile && (
                <MenuItem onClick={handleOpenLocation}>
                  <ListItemIcon>
                    <FolderOpenIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary="Open ROM Location" />
                </MenuItem>
              )}
              <MenuItem onClick={handleHideGame}>
                <ListItemIcon>
                  <VisibilityOffIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="Hide Game" />
              </MenuItem>
              {hasLocalFile && (
                <MenuItem onClick={() => { setMenuAnchor(null); setDeleteDialogOpen(true); }} sx={{ color: "error.main" }}>
                  <ListItemIcon>
                    <DeleteIcon fontSize="small" color="error" />
                  </ListItemIcon>
                  <ListItemText primary="Delete Download" />
                </MenuItem>
              )}
            </Menu>
          </Stack>

          <Typography variant="h3" sx={{ fontWeight: 800, letterSpacing: "-0.5px", mb: 1, color: "text.primary" }}>
            {game.name}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 1100, lineHeight: 1.8 }}>
            {game.summary || "No description available."}
          </Typography>

          <Divider sx={{ my: 3, opacity: 0.12 }} />

          <GameAchievementsSection
            gameName={game.name}
            retroAchievementsEnabled={retroachievementsEnabled}
            onOpenIntegrations={onOpenIntegrations}
          />

          <Divider sx={{ my: 3, opacity: 0.12 }} />

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
            <Alert severity={downloadStatus.type} sx={{ mb: 2 }} onClose={() => setDownloadStatus(null)}>
              {downloadStatus.message}
            </Alert>
          )}
          {actionStatus && (
            <Alert severity={actionStatus.type} sx={{ mb: 2 }} onClose={() => setActionStatus(null)}>
              {actionStatus.message}
            </Alert>
          )}

          <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap" }}>
            {canPlay && (
              <Button
                ref={primaryActionRef}
                variant="contained"
                size="large"
                startIcon={<PlayArrowIcon />}
                onClick={handleLaunchGame}
                disabled={launchActive || downloading}
                sx={{ borderRadius: 2, px: 4, py: 1.6, fontSize: "1.05rem", textTransform: "none", fontWeight: 700 }}
              >
                {launchActive ? "Preparing..." : "Play"}
              </Button>
            )}

            {game.romm_id && !hasLocalFile && (
              <Tooltip title={!rommToken || !rommUrl ? "Connect to RomM server in Settings to download" : ""} arrow>
                <span>
                  <Button
                    ref={primaryActionRef}
                    variant="contained"
                    size="large"
                    startIcon={downloading ? null : <CloudDownloadIcon />}
                    onClick={handleDownloadRom}
                    disabled={downloading || !rommToken || !rommUrl}
                    sx={{ borderRadius: 2, px: 4, py: 1.6, fontSize: "1.05rem", textTransform: "none", fontWeight: 700 }}
                  >
                    {downloading ? "Downloading..." : "Download"}
                  </Button>
                </span>
              </Tooltip>
            )}

            {canDownload && hasLocalFile && (
              <Button
                variant="outlined"
                size="large"
                startIcon={downloading ? null : <CloudDownloadIcon />}
                onClick={handleDownloadRom}
                disabled={downloading}
                sx={{ borderRadius: 2, px: 3, py: 1.6, textTransform: "none", fontWeight: 700 }}
              >
                {downloading ? "Downloading..." : "Re-download"}
              </Button>
            )}

            <Button
              variant="outlined"
              size="large"
              startIcon={game.is_favorite ? <FavoriteIcon /> : <FavoriteBorderIcon />}
              onClick={() => onToggleFavorite(game.id)}
              sx={{ borderRadius: 2, px: 4, py: 1.6, fontSize: "1.05rem", textTransform: "none", fontWeight: 700 }}
            >
              {game.is_favorite ? "Unfavorite" : "Favorite"}
            </Button>

            {hasLocalFile && (
              <Button
                variant="outlined"
                size="large"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={() => setDeleteDialogOpen(true)}
                sx={{ borderRadius: 2, px: 3, py: 1.6, textTransform: "none", fontWeight: 700 }}
              >
                Delete
              </Button>
            )}
          </Stack>

          {game.romm_id && rommToken && rommUrl ? (
            <Box ref={savesSectionRef} sx={{ mt: 4 }}>
              <Divider sx={{ mb: 2, opacity: 0.12 }} />
              <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 700 }}>
                Saves (RomM)
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Select <strong>Manage cached saves</strong> in this game's More options menu to jump here when cloud saves are configured on the server.
              </Typography>
            </Box>
          ) : null}
        </Box>
      </Paper>

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

      <CollectionPickerDialog
        open={collectionDialogOpen}
        onClose={() => setCollectionDialogOpen(false)}
        collections={collections}
        onPick={handlePickCollection}
        gameName={game.name}
      />

      <Dialog
        open={launchDialogOpen}
        fullWidth
        maxWidth="sm"
        onClose={launchFailure ? onBack : undefined}
        aria-labelledby="immersive-launch-title"
        slotProps={{
          backdrop: {
            sx: (t) => ({
              bgcolor: alpha("#000", t.palette.mode === "dark" ? 0.78 : 0.62),
              backdropFilter: "brightness(0.55)",
            }),
          },
        }}
      >
        <DialogTitle id="immersive-launch-title">
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", justifyContent: "space-between" }}>
            <span>{launchFailure ? "Launch failed" : "Preparing game"}</span>
            {launchFailure ? <KeyboardHint aria-hidden="true">Esc to go back</KeyboardHint> : null}
          </Stack>
        </DialogTitle>
        <DialogContent>
          {launchFailure ? (
            <Alert severity="error" sx={{ alignItems: "flex-start" }}>
              <Typography variant="body1">{launchErrorPresentation.message}</Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                {launchErrorPresentation.guidance}
              </Typography>
            </Alert>
          ) : (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>
                {launchStageLabel(visibleLaunchProgress?.stage || "resolving")}
              </Typography>
              <LinearProgress
                variant={visibleLaunchProgress?.percent != null ? "determinate" : "indeterminate"}
                value={visibleLaunchProgress?.percent ?? undefined}
                sx={{ borderRadius: 2, height: 8 }}
              />
              {visibleLaunchProgress && launchProgressLabel(visibleLaunchProgress) ? (
                <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
                  {launchProgressLabel(visibleLaunchProgress)}
                </Typography>
              ) : null}
            </Box>
          )}
        </DialogContent>
        {launchFailure ? (
          <DialogActions>
            <Button onClick={onBack}>Back</Button>
            <Button
              onClick={onOpenSettings}
              variant={retryableLaunchFailure ? "outlined" : "contained"}
              autoFocus={!retryableLaunchFailure}
            >
              Open Settings
            </Button>
            {retryableLaunchFailure ? (
              <Button onClick={handleLaunchGame} variant="contained" autoFocus disabled={launchActive}>
                Retry
              </Button>
            ) : null}
          </DialogActions>
        ) : null}
      </Dialog>
    </Box>
  );
}
