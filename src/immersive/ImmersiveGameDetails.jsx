import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CloudDownloadIcon from "@mui/icons-material/CloudDownload";
import DeleteIcon from "@mui/icons-material/Delete";
import FavoriteIcon from "@mui/icons-material/Favorite";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import FolderSpecialIcon from "@mui/icons-material/FolderSpecial";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import RefreshIcon from "@mui/icons-material/Refresh";
import SaveIcon from "@mui/icons-material/Save";
import SyncIcon from "@mui/icons-material/Sync";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import { alpha } from "@mui/material/styles";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState, useRef } from "react";

import ConfirmDestructiveDialog from "../components/ConfirmDestructiveDialog";
import CollectionPickerDialog from "../components/game/CollectionPickerDialog";
import GameAchievementsSection from "../components/game/GameAchievementsSection";
import GameScreenshotsSection from "../components/game/GameScreenshotsSection";
import KeyboardHint from "../components/KeyboardHint";
import { useRomDownloads, formatDownloadLabel } from "../RomDownloadsContext";
import { useAppTheme } from "../ThemeContext";
import {
  describeControllerElement,
  getControllerAction,
  logControllerOutcome,
} from "./controllerDebug";
import { getLaunchErrorPresentation } from "./launchError";

const DETAILS_ACTION_SELECTOR = "button:not(:disabled)";
const INPUT_OVERLAY_SELECTOR =
  '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]';

function getVisibleDetailsActions(root) {
  return [...(root?.querySelectorAll(DETAILS_ACTION_SELECTOR) || [])].filter(
    (element) => {
      for (let current = element; current; current = current.parentElement) {
        if (current.hidden || current.getAttribute("aria-hidden") === "true") {
          return false;
        }
        const style = window.getComputedStyle(current);
        if (style.display === "none" || style.visibility === "hidden") {
          return false;
        }
        if (current === root) {
          break;
        }
      }
      return true;
    }
  );
}

function isLocalPath(path) {
  if (!path) {
    return false;
  }
  return (
    /^[a-zA-Z]:/.test(path) || path.startsWith("\\") || path.startsWith("/")
  );
}

function getMediaSrc(url) {
  if (!url) {
    return null;
  }
  if (isLocalPath(url)) {
    return convertFileSrc(url);
  }
  return url;
}

function launchStageLabel(stage) {
  switch (stage) {
    case "resolving": {
      return "Preparing game...";
    }
    case "downloading": {
      return "Downloading ROM...";
    }
    case "validating": {
      return "Validating ROM...";
    }
    case "finalizing": {
      return "Finalizing local copy...";
    }
    case "bios_preparation": {
      return "Preparing BIOS...";
    }
    case "save_sync": {
      return "Synchronizing saves...";
    }
    case "launching": {
      return "Launching emulator...";
    }
    case "running": {
      return "Emulator running";
    }
    case "completion": {
      return "Launch complete";
    }
    case "failure": {
      return "Launch failed";
    }
    default: {
      return "Preparing game...";
    }
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
  const { getProgress, getLaunchProgress, getSwitchContentProgress } =
    useRomDownloads();
  const romDl = getProgress(game.id);
  const launchProgress = getLaunchProgress(game.id);
  const switchContentProgress = getSwitchContentProgress(game.id);
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
  const [switchContentSyncing, setSwitchContentSyncing] = useState(false);
  const switchContentInFlightRef = useRef(false);
  const switchContentSyncingRef = useRef(false);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [collectionDialogOpen, setCollectionDialogOpen] = useState(false);
  const [collections, setCollections] = useState([]);
  const savesSectionRef = useRef(null);

  function markDetailsActionFocus(event) {
    if (event.target?.matches?.(DETAILS_ACTION_SELECTOR)) {
      event.target.dataset.controllerFocused = "true";
    }
  }

  function clearDetailsActionFocus(event) {
    if (event.target?.matches?.(DETAILS_ACTION_SELECTOR)) {
      delete event.target.dataset.controllerFocused;
    }
  }

  const hasLocalFile =
    (game.local_file_path && game.local_file_path.length > 0) || justDownloaded;
  const isLocalGame = !game.romm_id && game.source !== "RomM";
  const canPlay = hasLocalFile || isLocalGame;
  const canDownload = game.romm_id && rommToken && rommUrl;
  const canSyncSwitchContent =
    game.platform_id === "switch" &&
    game.source === "RomM" &&
    game.romm_id &&
    rommToken &&
    rommUrl;
  const launchActive = launching;
  const attemptProgress =
    launchProgress && launchProgress !== staleLaunchProgressRef.current
      ? launchProgress
      : null;
  const visibleLaunchProgress =
    launching || launchError ? attemptProgress : null;
  const launchFailure = Boolean(
    launchError || visibleLaunchProgress?.stage === "failure"
  );
  const launchDialogOpen = Boolean(
    launching || visibleLaunchProgress || launchFailure
  );
  const rawLaunchError = launchError || visibleLaunchProgress?.error;
  const launchErrorPresentation = getLaunchErrorPresentation(
    rawLaunchError,
    platformLabel
  );
  const retryableLaunchFailure =
    launchFailure && launchErrorPresentation.retryable;

  const handleLaunchGame = useCallback(async () => {
    if (
      launchInFlightRef.current ||
      downloadInFlightRef.current ||
      switchContentInFlightRef.current ||
      launchActive
    ) {
      return;
    }
    launchInFlightRef.current = true;
    staleLaunchProgressRef.current = launchProgress;
    setLaunching(true);
    setLaunchError(null);
    try {
      const result = await onLaunch(game.id);
      if (result && !result.success) {
        setLaunchError(result.error || "Unable to launch game");
      }
    } catch (error) {
      setLaunchError(error?.message || String(error));
    } finally {
      launchInFlightRef.current = false;
      setLaunching(false);
    }
  }, [game.id, launchActive, launchProgress, onLaunch]);

  const handleDownloadRom = useCallback(async () => {
    if (
      downloadInFlightRef.current ||
      switchContentInFlightRef.current ||
      launchActive ||
      !rommToken ||
      !rommUrl
    ) {
      return;
    }
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
      setDownloadStatus({
        message: "Downloaded! Ready to play.",
        type: "success",
      });
      if (onGameUpdate) {
        onGameUpdate(game.id);
      }
    } catch (error) {
      setDownloadStatus({
        type: "error",
        message: error.message || String(error),
      });
    } finally {
      downloadInFlightRef.current = false;
      setDownloading(false);
    }
  }, [game.id, launchActive, onGameUpdate, rommToken, rommUrl]);

  async function handleSyncSwitchContent() {
    if (
      switchContentInFlightRef.current ||
      launchActive ||
      downloading ||
      !canSyncSwitchContent
    ) {
      return;
    }
    switchContentInFlightRef.current = true;
    switchContentSyncingRef.current = true;
    setSwitchContentSyncing(true);
    setActionStatus({
      message: "Syncing Switch updates and DLC…",
      type: "info",
    });
    try {
      const result = await invoke("sync_switch_content", { gameId: game.id });
      setActionStatus({
        message:
          result.message ||
          `Switch content synced: ${result.downloaded} downloaded, ${result.reused} reused.`,
        type: "success",
      });
    } catch (error) {
      const message = error?.message || String(error);
      setActionStatus({
        message: `${message} Choose “Sync Updates & DLC” to retry after correcting the issue.`,
        type: "error",
      });
    } finally {
      switchContentInFlightRef.current = false;
      switchContentSyncingRef.current = false;
      setSwitchContentSyncing(false);
    }
  }

  useEffect(() => {
    if (wasLaunchingRef.current && !launching && !launchFailure) {
      primaryActionRef.current?.focus();
    }
    wasLaunchingRef.current = launching;
  }, [launchFailure, launching]);

  useEffect(() => {
    function onWindowKeyDown(e) {
      const action = getControllerAction(e);
      const targetIsWindow =
        e.target === window || e.target?.window === e.target;
      if (!targetIsWindow) {
        logControllerOutcome(action, "details", "ignored", {
          reason: "event-target-not-window",
        });
        return;
      }
      if (e.repeat) {
        logControllerOutcome(action, "details", "suppressed", {
          reason: "keyboard-repeat",
        });
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
          logControllerOutcome(action, "details", "ignored", {
            reason: "no-visible-actions",
          });
          return;
        }

        const direction = e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 1;
        const focusedIndex = actions.indexOf(document.activeElement);
        const anchorIndex = actions.indexOf(primaryActionRef.current);
        const startIndex =
          focusedIndex !== -1
            ? focusedIndex
            : anchorIndex !== -1
              ? anchorIndex + (canPlay || direction < 0 ? 0 : -1)
              : direction > 0
                ? -1
                : actions.length;
        const nextIndex = Math.max(
          0,
          Math.min(actions.length - 1, startIndex + direction)
        );
        const beforeFocus = describeControllerElement(document.activeElement);
        const target = actions[nextIndex];
        e.preventDefault();
        target?.focus();
        const afterFocus = describeControllerElement(document.activeElement);
        if (target) {
          const focused = document.activeElement === target;
          logControllerOutcome(
            action,
            "details",
            focused ? "handled" : "ignored",
            {
              reason: !focused
                ? "focus-target-not-focused"
                : nextIndex === startIndex
                  ? "focus-boundary"
                  : "focus-moved",
              beforeFocus,
              afterFocus,
              targetFocus: describeControllerElement(target),
            }
          );
        } else {
          logControllerOutcome(action, "details", "ignored", {
            reason: "focus-target-missing",
            beforeFocus,
            afterFocus,
            targetIndex: nextIndex,
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
              logControllerOutcome(action, "details", "handled", {
                reason: "retry-launch",
              });
            } else {
              onOpenSettings();
              logControllerOutcome(action, "details", "handled", {
                reason: "open-settings",
              });
            }
          } else {
            logControllerOutcome(action, "details", "suppressed", {
              reason: `${hasInputOverlay.getAttribute("role") || "overlay"} open`,
            });
          }
          return;
        }
        const focusedAction = getVisibleDetailsActions(detailsRef.current).find(
          (action) => action === document.activeElement
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
            logControllerOutcome(action, "details", "handled", {
              reason: "retry-launch",
            });
          } else {
            onOpenSettings();
            logControllerOutcome(action, "details", "handled", {
              reason: "open-settings",
            });
          }
          return;
        }
        if (launching || switchContentSyncingRef.current) {
          logControllerOutcome(action, "details", "suppressed", {
            reason: "launch-in-progress",
          });
          return;
        }
        e.preventDefault();
        if (canPlay) {
          handleLaunchGame();
          logControllerOutcome(action, "details", "handled", {
            reason: "launch-default",
          });
        } else {
          handleDownloadRom();
          logControllerOutcome(action, "details", "handled", {
            reason: "download-default",
          });
        }
      } else if (e.key === "Escape") {
        if (!launchFailure) {
          logControllerOutcome(action, "details", "ignored", {
            reason: "no-launch-failure",
          });
          return;
        }
        e.preventDefault();
        onBack();
        logControllerOutcome(action, "details", "handled", {
          reason: "return-from-launch-failure",
        });
      }
    }

    window.addEventListener("keydown", onWindowKeyDown);
    return () => {
      window.removeEventListener("keydown", onWindowKeyDown);
    };
  }, [
    canPlay,
    handleDownloadRom,
    handleLaunchGame,
    launchFailure,
    launching,
    onBack,
    onOpenSettings,
    retryableLaunchFailure,
  ]);

  const screenshots = Array.isArray(game.screenshot_paths)
    ? game.screenshot_paths
    : [];

  async function handleDeleteDownload() {
    try {
      setDeleteDialogOpen(false);
      setActionStatus({ message: "Deleting ROM...", type: "info" });
      await invoke("delete_local_rom", { gameId: game.id });
      setActionStatus({ message: "ROM deleted successfully", type: "success" });
      setJustDownloaded(false);
      if (onGameUpdate) {
        onGameUpdate(game.id);
      }
    } catch (error) {
      setActionStatus({
        type: "error",
        message: error.message || String(error),
      });
    }
  }

  async function handleRefreshMetadata() {
    if (!rommToken || !rommUrl || !game.romm_id) {
      return;
    }
    try {
      setMenuAnchor(null);
      setRefreshing(true);
      await invoke("refresh_game_metadata", {
        gameId: game.id,
        serverUrl: rommUrl,
        token: rommToken,
      });
      if (onGameUpdate) {
        onGameUpdate(game.id);
      }
    } catch (error) {
      setActionStatus({
        type: "error",
        message: error.message || String(error),
      });
    } finally {
      setRefreshing(false);
    }
  }

  async function handleHideGame() {
    try {
      setMenuAnchor(null);
      await invoke("toggle_game_hidden", { gameId: game.id });
      if (onGameUpdate) {
        onGameUpdate(game.id);
      }
      setTimeout(() => onBack(), 800);
    } catch (error) {
      setActionStatus({
        type: "error",
        message: error.message || String(error),
      });
    }
  }

  async function handleOpenLocation() {
    try {
      setMenuAnchor(null);
      await invoke("open_rom_location", { gameId: game.id });
    } catch (error) {
      setActionStatus({
        type: "error",
        message: error.message || String(error),
      });
    }
  }

  function scrollToSaves() {
    setMenuAnchor(null);
    savesSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  async function openAddToCollection() {
    setMenuAnchor(null);
    try {
      const cols = await invoke("get_collections");
      setCollections(cols);
      setCollectionDialogOpen(true);
    } catch (error) {
      setActionStatus({
        type: "error",
        message: error.message || String(error),
      });
    }
  }

  async function handlePickCollection(collectionId) {
    try {
      await invoke("add_game_to_collection", { collectionId, gameId: game.id });
      setActionStatus({ message: "Added to collection.", type: "success" });
    } catch (error) {
      setActionStatus({
        type: "error",
        message: error.message || String(error),
      });
    }
  }

  return (
    <Box
      ref={detailsRef}
      data-testid="immersive-game-details"
      sx={{
        backgroundImage: `radial-gradient(1000px 380px at 10% -5%, ${alpha(colors.primary, 0.12)} 0%, transparent 52%),
          radial-gradient(800px 320px at 92% 5%, ${alpha(colors.primaryLight, 0.07)} 0%, transparent 48%)`,
        bgcolor: "background.default",
        flex: 1,
        minHeight: 0,
        overflowX: "hidden",
        overflowY: "auto",
        overscrollBehavior: "contain",
        p: 5,
      }}
      onFocus={markDetailsActionFocus}
      onBlur={clearDetailsActionFocus}
    >
      <Button
        data-argosy-sound="back"
        startIcon={<ArrowBackIcon />}
        onClick={onBack}
        color="inherit"
        sx={{
          borderRadius: 2,
          fontWeight: 700,
          mb: 3,
          px: 2.5,
          textTransform: "none",
        }}
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
          bgcolor:
            t.palette.mode === "dark"
              ? alpha(t.palette.background.paper, 0.98)
              : t.palette.background.paper,
          border: `1px solid ${t.palette.divider}`,
          borderRadius: 3,
          boxShadow: `0 20px 56px ${alpha("#000", t.palette.mode === "dark" ? 0.55 : 0.12)}`,
          overflow: "hidden",
        })}
      >
        <Box
          sx={{
            background: `radial-gradient(1200px 500px at 15% 0%, ${alpha(colors.primary, 0.22)} 0%, transparent 55%),
              radial-gradient(900px 450px at 85% 10%, ${alpha(colors.primaryLight, 0.14)} 0%, transparent 58%)`,
            p: 4,
          }}
        >
          <Stack
            direction="row"
            spacing={2}
            sx={{
              alignItems: "center",
              flexWrap: "wrap",
              justifyContent: "space-between",
              mb: 2,
            }}
          >
            <Stack
              direction="row"
              spacing={2}
              sx={{ alignItems: "center", flexWrap: "wrap" }}
            >
              {platformLabel ? (
                <Chip
                  label={platformLabel}
                  sx={{
                    bgcolor: "rgba(255,255,255,0.08)",
                    color: "#fff",
                    fontWeight: 900,
                  }}
                />
              ) : null}
              {game.is_favorite ? (
                <Chip
                  label="Favorite"
                  sx={{
                    bgcolor: "rgba(239,68,68,0.18)",
                    color: "#fff",
                    fontWeight: 900,
                  }}
                />
              ) : null}
            </Stack>
            <IconButton
              color="inherit"
              onClick={(e) => {
                setMenuAnchor(e.currentTarget);
              }}
              aria-label="More options"
            >
              <MoreVertIcon />
            </IconButton>
            <Menu
              anchorEl={menuAnchor}
              open={Boolean(menuAnchor)}
              onClose={() => {
                setMenuAnchor(null);
              }}
            >
              {game.romm_id && rommToken && rommUrl && (
                <MenuItem onClick={scrollToSaves}>
                  <ListItemIcon>
                    <SaveIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Manage cached saves"
                    secondary="RomM cloud saves"
                    slotProps={{ secondary: { variant: "caption" } }}
                  />
                </MenuItem>
              )}
              <MenuItem onClick={openAddToCollection}>
                <ListItemIcon>
                  <FolderSpecialIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary="Add to collection"
                  secondary="Manual collections"
                  slotProps={{ secondary: { variant: "caption" } }}
                />
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
                  <ListItemText primary="Delete Download" />
                </MenuItem>
              )}
            </Menu>
          </Stack>

          <Typography
            variant="h3"
            sx={{
              color: "text.primary",
              fontWeight: 800,
              letterSpacing: "-0.5px",
              mb: 1,
            }}
          >
            {game.name}
          </Typography>
          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ lineHeight: 1.8, maxWidth: 1100 }}
          >
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
              {romDl?.percent == null ? (
                <LinearProgress sx={{ borderRadius: 2 }} />
              ) : (
                <LinearProgress
                  variant="determinate"
                  value={romDl.percent}
                  sx={{ borderRadius: 2 }}
                />
              )}
              {romDl ? (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "block", mt: 0.5 }}
                >
                  {formatDownloadLabel(romDl)}
                </Typography>
              ) : null}
            </Box>
          )}
          {downloadStatus && (
            <Alert
              severity={downloadStatus.type}
              sx={{ mb: 2 }}
              onClose={() => {
                setDownloadStatus(null);
              }}
            >
              {downloadStatus.message}
            </Alert>
          )}
          {actionStatus && (
            <Alert
              severity={actionStatus.type}
              sx={{ mb: 2 }}
              onClose={() => {
                setActionStatus(null);
              }}
            >
              {actionStatus.message}
            </Alert>
          )}
          {switchContentSyncing && (
            <Box sx={{ mb: 2 }} data-testid="switch-content-sync-progress">
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: 0.5 }}
              >
                {switchContentProgress?.stage === "registering"
                  ? "Registering content with Eden…"
                  : switchContentProgress?.stage === "reusing"
                    ? "Reusing unchanged content…"
                    : "Downloading Switch content…"}
                {switchContentProgress?.file_index &&
                switchContentProgress.total_files
                  ? ` (${switchContentProgress.file_index}/${switchContentProgress.total_files})`
                  : ""}
              </Typography>
              <LinearProgress
                variant={
                  switchContentProgress?.percent == null
                    ? "indeterminate"
                    : "determinate"
                }
                value={switchContentProgress?.percent ?? undefined}
                sx={{ borderRadius: 2 }}
              />
              {switchContentProgress?.downloaded == null ? null : (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "block", mt: 0.5 }}
                >
                  {formatDownloadLabel(switchContentProgress)}
                </Typography>
              )}
            </Box>
          )}

          <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap" }}>
            {canPlay && (
              <Button
                ref={primaryActionRef}
                variant="contained"
                size="large"
                startIcon={<PlayArrowIcon />}
                onClick={handleLaunchGame}
                disabled={launchActive || downloading || switchContentSyncing}
                sx={{
                  borderRadius: 2,
                  fontSize: "1.05rem",
                  fontWeight: 700,
                  px: 4,
                  py: 1.6,
                  textTransform: "none",
                }}
              >
                {launchActive ? "Preparing..." : "Play"}
              </Button>
            )}

            {game.romm_id && !hasLocalFile && (
              <Tooltip
                title={
                  !rommToken || !rommUrl
                    ? "Connect to RomM server in Settings to download"
                    : ""
                }
                arrow
              >
                <span>
                  <Button
                    ref={primaryActionRef}
                    variant="contained"
                    size="large"
                    startIcon={downloading ? null : <CloudDownloadIcon />}
                    onClick={handleDownloadRom}
                    disabled={
                      downloading ||
                      switchContentSyncing ||
                      !rommToken ||
                      !rommUrl
                    }
                    sx={{
                      borderRadius: 2,
                      fontSize: "1.05rem",
                      fontWeight: 700,
                      px: 4,
                      py: 1.6,
                      textTransform: "none",
                    }}
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
                disabled={downloading || switchContentSyncing}
                sx={{
                  borderRadius: 2,
                  fontWeight: 700,
                  px: 3,
                  py: 1.6,
                  textTransform: "none",
                }}
              >
                {downloading ? "Downloading..." : "Re-download"}
              </Button>
            )}

            {canSyncSwitchContent && (
              <Button
                variant="outlined"
                size="large"
                startIcon={switchContentSyncing ? null : <SyncIcon />}
                onClick={handleSyncSwitchContent}
                disabled={switchContentSyncing || launchActive || downloading}
                sx={{
                  borderRadius: 2,
                  fontWeight: 700,
                  px: 3,
                  py: 1.6,
                  textTransform: "none",
                }}
              >
                {switchContentSyncing
                  ? "Syncing Updates & DLC…"
                  : "Sync Updates & DLC"}
              </Button>
            )}

            <Button
              variant="outlined"
              size="large"
              startIcon={
                game.is_favorite ? <FavoriteIcon /> : <FavoriteBorderIcon />
              }
              onClick={() => onToggleFavorite(game.id)}
              sx={{
                borderRadius: 2,
                fontSize: "1.05rem",
                fontWeight: 700,
                px: 4,
                py: 1.6,
                textTransform: "none",
              }}
            >
              {game.is_favorite ? "Unfavorite" : "Favorite"}
            </Button>

            {hasLocalFile && (
              <Button
                variant="outlined"
                size="large"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={() => {
                  setDeleteDialogOpen(true);
                }}
                sx={{
                  borderRadius: 2,
                  fontWeight: 700,
                  px: 3,
                  py: 1.6,
                  textTransform: "none",
                }}
              >
                Delete
              </Button>
            )}
          </Stack>

          {game.romm_id && rommToken && rommUrl ? (
            <Box ref={savesSectionRef} sx={{ mt: 4 }}>
              <Divider sx={{ mb: 2, opacity: 0.12 }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                Saves (RomM)
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Select <strong>Manage cached saves</strong> in this game's More
                options menu to jump here when cloud saves are configured on the
                server.
              </Typography>
            </Box>
          ) : null}
        </Box>
      </Paper>

      <ConfirmDestructiveDialog
        open={deleteDialogOpen}
        title="Delete Downloaded ROM?"
        message={`This will delete the local ROM file for "${game.name}".${
          game.romm_id
            ? " The game will remain in your library (from RomM) and can be re-downloaded."
            : " This will remove the game from your library completely."
        }`}
        confirmLabel="Delete"
        onCancel={() => {
          setDeleteDialogOpen(false);
        }}
        onConfirm={handleDeleteDownload}
      />

      <CollectionPickerDialog
        open={collectionDialogOpen}
        onClose={() => {
          setCollectionDialogOpen(false);
        }}
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
              backdropFilter: "brightness(0.55)",
              bgcolor: alpha("#000", t.palette.mode === "dark" ? 0.78 : 0.62),
            }),
          },
        }}
      >
        <DialogTitle id="immersive-launch-title">
          <Stack
            direction="row"
            spacing={1.5}
            sx={{ alignItems: "center", justifyContent: "space-between" }}
          >
            <span>{launchFailure ? "Launch failed" : "Preparing game"}</span>
            {launchFailure ? (
              <KeyboardHint aria-hidden="true">Esc to go back</KeyboardHint>
            ) : null}
          </Stack>
        </DialogTitle>
        <DialogContent>
          {launchFailure ? (
            <Alert severity="error" sx={{ alignItems: "flex-start" }}>
              <Typography variant="body1">
                {launchErrorPresentation.message}
              </Typography>
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
                variant={
                  visibleLaunchProgress?.percent == null
                    ? "indeterminate"
                    : "determinate"
                }
                value={visibleLaunchProgress?.percent ?? undefined}
                sx={{ borderRadius: 2, height: 8 }}
              />
              {visibleLaunchProgress &&
              launchProgressLabel(visibleLaunchProgress) ? (
                <Typography
                  variant="body1"
                  color="text.secondary"
                  sx={{ mt: 1 }}
                >
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
              <Button
                onClick={handleLaunchGame}
                variant="contained"
                autoFocus
                disabled={launchActive}
              >
                Retry
              </Button>
            ) : null}
          </DialogActions>
        ) : null}
      </Dialog>
    </Box>
  );
}
