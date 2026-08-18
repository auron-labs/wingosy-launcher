import { useState, useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import Snackbar from "@mui/material/Snackbar";
import Button from "@mui/material/Button";
import Sidebar from "./components/Sidebar";
import Library from "./components/Library";
import GameDetails from "./components/GameDetails";
import Settings from "./components/Settings";
import RomDownloadsView from "./components/RomDownloadsView";
import SetupWizard from "./components/SetupWizard";
import ImmersiveModeApp from "./immersive/ImmersiveModeApp";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open as openUrl } from "@tauri-apps/plugin-shell";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { setFullscreenReliable } from "./windowFullscreen";
import WindowChrome from "./components/WindowChrome";
import { isTauri, mousedownTargetElement } from "./utils/isTauri";
import { filterVisibleGames } from "./utils/gameFilters";
import { UiSoundsProvider } from "./UiSoundsContext";

const appWindow = isTauri() ? getCurrentWindow() : null;
const getCurrent = getCurrentWindow;

const DRAWER_WIDTH = 260;

function AppShell({ children }) {
  useEffect(() => {
    if (!isTauri()) return undefined;
    /**
     * Ensures custom titlebar dragging works even when CSS/HMR is flaky (WebView2).
     * Requires `core:window:allow-start-dragging` in capabilities.
     */
    function onMouseDown(e) {
      if (e.button !== 0) return;
      const el = mousedownTargetElement(e.target);
      if (!el) return;
      if (el.closest("[data-tauri-no-drag]")) return;
      if (!el.closest("[data-tauri-drag-region]")) return;
      getCurrent()
        .startDragging()
        .catch((err) => {
          console.warn(
            "[Wingosy] startDragging failed — use `tauri dev` (not dev:web), restart after `tauri.conf` changes:",
            err
          );
        });
    }
    document.addEventListener("mousedown", onMouseDown, true);
    return () => document.removeEventListener("mousedown", onMouseDown, true);
  }, []);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      <WindowChrome />
      <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {children}
      </Box>
    </Box>
  );
}

function App() {
  const [showSetup, setShowSetup] = useState(null);
  const [view, setView] = useState("library");
  const [games, setGames] = useState([]);
  const [platforms, setPlatforms] = useState([]);
  const [selectedPlatform, setSelectedPlatform] = useState(null);
  const [selectedGame, setSelectedGame] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rommToken, setRommToken] = useState(null);
  const [rommUrl, setRommUrl] = useState("");
  const [immersiveModeEnabled, setImmersiveModeEnabled] = useState(false);
  const [immersiveModeFullscreen, setImmersiveModeFullscreen] = useState(false);
  const [updateSnack, setUpdateSnack] = useState({
    open: false,
    url: "",
    version: "",
    channel: "stable",
    canInstall: false,
    installing: false,
    progressLabel: "",
  });
  /** Which Settings sidebar section to show when opening Settings (desktop shell). */
  const [settingsInitialSection, setSettingsInitialSection] = useState("general");
  const startupUpdateCheckDone = useRef(false);
  const rommSessionRestoreStarted = useRef(false);
  const gamesRequestId = useRef(0);
  const launchInFlightRef = useRef(new Set());

  useEffect(() => {
    checkFirstRun();
  }, []);

  async function checkFirstRun() {
    try {
      const firstRun = await invoke("is_first_run");
      setShowSetup(firstRun);
    } catch {
      setShowSetup(false);
    }
  }

  function handleSetupComplete() {
    setShowSetup(false);
  }

  useEffect(() => {
    if (showSetup === false) {
      loadData();
    }
  }, [showSetup]);

  useEffect(() => {
    if (showSetup === false) {
      refreshGames(selectedPlatform, searchQuery);
    }
  }, [selectedPlatform, searchQuery, showSetup]);

  async function loadData() {
    const requestId = ++gamesRequestId.current;
    try {
      setLoading(true);
      const [gamesData, platformsData] = await Promise.all([
        invoke("get_all_games"),
        invoke("get_platforms_with_games"),
      ]);
      if (requestId === gamesRequestId.current) {
        setGames(gamesData);
      }
      setPlatforms(platformsData);

      try {
        const cfg = await invoke("get_config");
        if (cfg.romm?.server_url) {
          setRommUrl(cfg.romm.server_url);
        }
        if (cfg.romm?.auth_token) {
          setRommToken(cfg.romm.auth_token);
        }
        if (cfg.romm?.server_url && !rommSessionRestoreStarted.current) {
          rommSessionRestoreStarted.current = true;
          invoke("restore_romm_session")
            .then((session) => {
              if (!session?.access_token) return;
              setRommUrl(session.server_url);
              setRommToken(session.access_token);
            })
            .catch((err) => {
              console.warn("[Wingosy] Could not restore RomM session:", err);
            });
        }
        setImmersiveModeEnabled(Boolean(cfg.display?.big_picture));
        setImmersiveModeFullscreen(Boolean(cfg.display?.fullscreen));
        if (!startupUpdateCheckDone.current && cfg.updater?.check_on_startup !== false) {
          startupUpdateCheckDone.current = true;
          const ch =
            cfg.updater?.channel === "nightly" || cfg.updater?.channel === "beta"
              ? cfg.updater.channel
              : "stable";
          invoke("check_for_app_update", { channel: ch })
            .then(async (r) => {
              if (!r?.is_update_available) return;
              if (
                cfg.updater?.auto_update_enabled &&
                r.signed_update_manifest_url
              ) {
                try {
                  await invoke("install_signed_app_update", { channel: ch });
                } catch (err) {
                  setError(err?.message || String(err));
                }
                return;
              }
              if (r.release_url) {
                setUpdateSnack({
                  open: true,
                  url: r.release_url,
                  version: r.latest_version || "",
                  channel: ch,
                  canInstall: Boolean(r.signed_update_manifest_url),
                  installing: false,
                  progressLabel: "",
                });
              }
            })
            .catch(() => {});
        }
      } catch {
        // config may not exist yet
      }
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  async function refreshGames(platformId = selectedPlatform, query = searchQuery) {
    const requestId = ++gamesRequestId.current;
    try {
      const gamesData = await invoke("get_games_filtered", {
        platformId,
        searchQuery: query || null,
        favoritesOnly: false,
        sortBy: null,
      });
      if (requestId === gamesRequestId.current) {
        setGames(gamesData);
        setSelectedGame((current) => {
          if (!current) return current;
          return gamesData.find((game) => game.id === current.id) || current;
        });
      }
    } catch (err) {
      console.error("Failed to refresh games:", err);
    }
  }

  async function runSignedUpdateInstall() {
    if (!updateSnack.channel || updateSnack.installing) return;
    setUpdateSnack((s) => ({ ...s, installing: true, progressLabel: "Downloading…" }));
    let unlistenProgress = () => {};
    try {
      unlistenProgress = await listen("signed-updater-progress", (ev) => {
        const d = ev.payload?.downloaded;
        const t = ev.payload?.total;
        setUpdateSnack((prev) => ({
          ...prev,
          progressLabel:
            d != null && t != null && t > 0
              ? `${Math.min(100, Math.round((d / t) * 100))}%`
              : "Downloading…",
        }));
      });
    } catch {
      unlistenProgress = () => {};
    }
    try {
      await invoke("install_signed_app_update", { channel: updateSnack.channel });
    } catch (err) {
      setError(err?.message || String(err));
      setUpdateSnack((s) => ({ ...s, installing: false, progressLabel: "" }));
    } finally {
      unlistenProgress();
    }
  }

  function handleRommConnect(url, token) {
    setRommUrl(url);
    setRommToken(token);
  }

  function handleRommDisconnect() {
    setRommToken(null);
  }

  useEffect(() => {
    // Global hotkey: F11 toggles fullscreen.
    function onKeyDown(e) {
      if (e.key !== "F11") return;
      e.preventDefault();
      (async () => {
        try {
          if (!appWindow) return;
          const next = !(await appWindow.isFullscreen());
          await setFullscreenReliable(next);
        } catch {
          // ignore
        }
      })();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  async function handleToggleFavorite(gameId) {
    try {
      const newState = await invoke("toggle_favorite", { gameId });
      setGames((prev) =>
        prev.map((g) =>
          g.id === gameId ? { ...g, is_favorite: newState } : g
        )
      );
      if (selectedGame?.id === gameId) {
        setSelectedGame((prev) => ({ ...prev, is_favorite: newState }));
      }
    } catch (err) {
      setError(err.message || String(err));
    }
  }

  async function handleLaunchGame(gameId) {
    if (launchInFlightRef.current.has(gameId)) return null;
    launchInFlightRef.current.add(gameId);
    try {
      const result = await invoke("prepare_and_launch_game", { gameId });
      
      if (!result.success && result.error) {
        setError(result.error);
      } else if (result.save_sync_warnings?.length) {
        setError(result.save_sync_warnings.join("\n"));
      }
      
      if (!result.dry_run) {
        await refreshGames();
      }
      return result;
    } catch (err) {
      setError(err.message || String(err));
      return null;
    } finally {
      launchInFlightRef.current.delete(gameId);
    }
  }

  function handleSelectGame(game) {
    setSelectedGame(game);
    setView("details");
  }

  function handleSelectPlatform(platformId) {
    setSelectedPlatform(platformId);
    setView("library");
    setSelectedGame(null);
  }

  function handleNavigate(newView, options) {
    setView(newView);
    if (newView === "library" || newView === "downloads") {
      setSelectedGame(null);
    }
    if (newView === "settings") {
      setSettingsInitialSection(options?.settingsSection ?? "general");
    }
  }

  function wrapUiSounds(node) {
    return (
      <UiSoundsProvider immersiveActive={immersiveModeEnabled}>{node}</UiSoundsProvider>
    );
  }

  if (showSetup === null) {
    return wrapUiSounds(
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          bgcolor: "background.default",
        }}
      />
    );
  }

  if (showSetup) {
    return wrapUiSounds(
      <AppShell>
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            overflowX: "hidden",
            overscrollBehavior: "contain",
          }}
        >
          <SetupWizard
            onComplete={handleSetupComplete}
            onRommConnect={handleRommConnect}
          />
        </Box>
      </AppShell>
    );
  }

  if (immersiveModeEnabled) {
    return wrapUiSounds(
      <AppShell>
        <ImmersiveModeApp
          rommToken={rommToken}
          rommUrl={rommUrl}
          onRommConnect={handleRommConnect}
          onExit={async () => {
            setImmersiveModeEnabled(false);
            setImmersiveModeFullscreen(false);
            await loadData();
            // loadData reapplies `cfg.display.big_picture`; after exit the config write can
            // lag behind get_config in rare cases — keep desktop shell until next full reload.
            setImmersiveModeEnabled(false);
            setImmersiveModeFullscreen(false);
          }}
          requestedFullscreen={immersiveModeFullscreen}
        />
      </AppShell>
    );
  }

  const visibleGames = filterVisibleGames(games, selectedPlatform, searchQuery);

  return wrapUiSounds(
    <AppShell>
      <Box sx={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>
      <Sidebar
        platforms={platforms}
        selectedPlatform={selectedPlatform}
        onSelectPlatform={handleSelectPlatform}
        onNavigate={handleNavigate}
        currentView={view}
        drawerWidth={DRAWER_WIDTH}
        rommUrl={rommUrl}
      />
      <Box
        component="main"
        sx={{
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          bgcolor: "background.default",
        }}
      >
        {view === "downloads" && (
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              overflowX: "hidden",
              overscrollBehavior: "contain",
            }}
          >
            <RomDownloadsView />
          </Box>
        )}
        {view === "library" && (
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              overflowX: "hidden",
              overscrollBehavior: "contain",
            }}
          >
          <Library
            games={visibleGames}
            loading={loading}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onSelectGame={handleSelectGame}
            onToggleFavorite={handleToggleFavorite}
            onLaunchGame={handleLaunchGame}
            onNavigateLibrarySettings={() =>
              handleNavigate("settings", { settingsSection: "library" })
            }
            onNavigateRommSettings={() =>
              handleNavigate("settings", { settingsSection: "romm" })
            }
            error={error}
            onDismissError={() => setError(null)}
          />
          </Box>
        )}
        {view === "details" && selectedGame && (
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              overflowX: "hidden",
              overscrollBehavior: "contain",
            }}
          >
          <GameDetails
            game={selectedGame}
            platforms={platforms}
            onBack={() => {
              handleNavigate("library");
              loadData();
            }}
            onLaunch={handleLaunchGame}
            onToggleFavorite={handleToggleFavorite}
            onGameUpdate={async (gameId) => {
              // Refresh game data and update selected game
              try {
                const gamesData = await invoke("get_all_games");
                setGames(gamesData);
                const updated = gamesData.find(g => g.id === gameId);
                if (updated) {
                  setSelectedGame(updated);
                }
              } catch (err) {
                console.error("Failed to refresh after download:", err);
              }
            }}
            rommToken={rommToken}
            rommUrl={rommUrl}
          />
          </Box>
        )}
        {view === "settings" && (
          <Box sx={{ flex: 1, minHeight: 0, minWidth: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <Settings
            initialSection={settingsInitialSection}
            onBack={() => {
              handleNavigate("library");
              loadData();
            }}
            rommToken={rommToken}
            rommUrl={rommUrl}
            onRommConnect={handleRommConnect}
            onRommDisconnect={handleRommDisconnect}
            onLibraryChange={loadData}
          />
          </Box>
        )}
      </Box>
      </Box>
      <Snackbar
        open={updateSnack.open}
        onClose={() => {
          if (updateSnack.installing) return;
          setUpdateSnack((s) => ({ ...s, open: false }));
        }}
        message={
          <span>
            {updateSnack.version
              ? `Update available: ${updateSnack.version}`
              : "Update available"}
            {updateSnack.installing && updateSnack.progressLabel
              ? ` — ${updateSnack.progressLabel}`
              : ""}
          </span>
        }
        action={
          <>
            {updateSnack.canInstall ? (
              <Button
                color="inherit"
                size="small"
                disabled={updateSnack.installing}
                onClick={() => runSignedUpdateInstall()}
              >
                {updateSnack.installing ? "Installing…" : "Download & install"}
              </Button>
            ) : null}
            <Button
              color="inherit"
              size="small"
              disabled={updateSnack.installing}
              onClick={() => {
                if (updateSnack.url) openUrl(updateSnack.url);
              }}
            >
              View release
            </Button>
            <Button
              color="inherit"
              size="small"
              disabled={updateSnack.installing}
              onClick={() => setUpdateSnack((s) => ({ ...s, open: false }))}
            >
              Dismiss
            </Button>
          </>
        }
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </AppShell>
  );
}

export default App;
