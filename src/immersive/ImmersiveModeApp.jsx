import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Settings from "../components/Settings";
import AmbientAudioPlayer from "./AmbientAudioPlayer";
import ImmersiveLibrary from "./ImmersiveLibrary";
import ImmersiveGameDetails from "./ImmersiveGameDetails";
import ImmersiveHintBar from "./ImmersiveHintBar";
import RomDownloadsView from "../components/RomDownloadsView";
import { invoke } from "@tauri-apps/api/core";
import { useFullscreen } from "./useFullscreen";
import { useGamepadKeyboardMapper } from "./useGamepadKeyboardMapper";

const GAMES_PER_PAGE = 60;
const LOAD_AHEAD = 12;

export default function ImmersiveModeApp({
  onExit,
  rommToken,
  rommUrl,
  onRommConnect,
  /** Mirrors `cfg.display.fullscreen` from App — request OS fullscreen when entering Immersive mode. */
  requestedFullscreen = false,
}) {
  const [view, setView] = useState("library"); // library | details | settings | downloads
  const [games, setGames] = useState([]);
  const [gameTotal, setGameTotal] = useState(0);
  const [platforms, setPlatforms] = useState([]);
  const [selectedGame, setSelectedGame] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [displayCfg, setDisplayCfg] = useState(() => ({
    big_picture: true,
    fullscreen: requestedFullscreen,
  }));
  const [audioCfg, setAudioCfg] = useState(null);
  const [retroachievementsEnabled, setRetroachievementsEnabled] = useState(false);
  const hasLoadedOnce = useRef(false);
  const launchInFlightRef = useRef(false);
  const libraryRequestId = useRef(0);
  const nextPageRef = useRef(2);
  const nextPageInFlightRef = useRef(false);
  const selectedGameIdRef = useRef(null);
  const focusedGameIdRef = useRef(null);
  const gamesRef = useRef([]);
  const [showHints, setShowHints] = useState(true);

  // Match desktop `GameDetails` Chip: platform?.name || game.platform_id (not short_name-first / uppercase).
  const platformDisplayNameById = useMemo(() => {
    const map = new Map();
    for (const [p] of platforms) map.set(p.id, p.name || p.id);
    return map;
  }, [platforms]);

  const persistDisplay = useCallback(async (next) => {
    const cfg = await invoke("get_config");
    cfg.display = cfg.display || {};
    if (typeof next.big_picture === "boolean") cfg.display.big_picture = next.big_picture;
    if (typeof next.fullscreen === "boolean") cfg.display.fullscreen = next.fullscreen;
    await invoke("save_config", { config: cfg });
    setDisplayCfg({ big_picture: Boolean(cfg.display.big_picture), fullscreen: Boolean(cfg.display.fullscreen) });
    return cfg;
  }, []);

  const { setFullscreen, toggleFullscreen } = useFullscreen({
    enabled: displayCfg.fullscreen,
    onChange: async (v) => {
      try {
        await persistDisplay({ fullscreen: Boolean(v) });
      } catch {
        // ignore
      }
    },
  });

  const { unsupportedGamepad } = useGamepadKeyboardMapper({ enabled: true });

  const loadData = useCallback(async () => {
    const requestId = ++libraryRequestId.current;
    try {
      setLoading(true);
      setError(null);
      const [gamesPage, platformsData, cfg] = await Promise.all([
        invoke("get_games_page", {
          platformId: null,
          searchQuery: null,
          page: 1,
          pageSize: GAMES_PER_PAGE,
        }),
        invoke("get_platforms_with_games"),
        invoke("get_config"),
      ]);
      if (requestId !== libraryRequestId.current) return [];
      const gamesData = gamesPage?.games || [];
      const total = gamesPage?.total ?? gamesData.length;
      const pageGameIds = new Set(gamesData.map((game) => game.id));
      // Refresh page one without dropping bounded pages already in memory.
      const refreshedGames = [
        ...gamesData,
        ...gamesRef.current.filter((game) => !pageGameIds.has(game.id)),
      ].slice(0, Math.max(total, gamesData.length));
      gamesRef.current = refreshedGames;
      setGames(refreshedGames);
      setGameTotal(total);
      nextPageRef.current = Math.floor(refreshedGames.length / GAMES_PER_PAGE) + 1;
      const preservedGameId = selectedGameIdRef.current ?? focusedGameIdRef.current;
      const selectedIndexInGames = refreshedGames.findIndex(
        (game) => game.id === preservedGameId,
      );
      if (selectedIndexInGames >= 0) setSelectedIndex(selectedIndexInGames);
      setSelectedGame((current) => {
        if (!current) return current;
        return (
          refreshedGames.find(
            (game) => game.id === (selectedGameIdRef.current ?? current.id),
          ) || current
        );
      });
      setPlatforms(platformsData);
      setDisplayCfg({
        big_picture: Boolean(cfg.display?.big_picture),
        fullscreen: Boolean(cfg.display?.fullscreen),
      });
      setAudioCfg(cfg.audio || {});
      setRetroachievementsEnabled(Boolean(cfg.display?.retroachievements_enabled));
      return refreshedGames;
    } catch (err) {
      if (requestId === libraryRequestId.current) {
        setError(err?.message || String(err));
      }
    } finally {
      if (requestId === libraryRequestId.current) {
        setLoading(false);
      }
    }
  }, []);

  const loadNextPage = useCallback(() => {
    if (nextPageInFlightRef.current || games.length >= gameTotal) return;

    const requestId = libraryRequestId.current;
    const page = nextPageRef.current;
    nextPageInFlightRef.current = true;
    void (async () => {
      try {
        const result = await invoke("get_games_page", {
          platformId: null,
          searchQuery: null,
          page,
          pageSize: GAMES_PER_PAGE,
        });
        if (requestId !== libraryRequestId.current) return;

        setGames((current) => {
          const ids = new Set(current.map((game) => game.id));
          const nextGames = [
            ...current,
            ...result.games.filter((game) => !ids.has(game.id)),
          ];
          gamesRef.current = nextGames;
          return nextGames;
        });
        setGameTotal(result.total);
        nextPageRef.current = page + 1;
      } catch (err) {
        if (requestId === libraryRequestId.current) {
          setError(err?.message || String(err));
        }
      } finally {
        nextPageInFlightRef.current = false;
      }
    })();
  }, [gameTotal, games.length]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (view !== "library" || loading || games.length >= gameTotal) return;
    if (selectedIndex < games.length - LOAD_AHEAD) return;
    loadNextPage();
  }, [gameTotal, games.length, loadNextPage, loading, selectedIndex, view]);

  useEffect(() => {
    if (!hasLoadedOnce.current) {
      hasLoadedOnce.current = true;
      return;
    }
    if (!displayCfg.big_picture && onExit) {
      (async () => {
        try {
          await setFullscreen(false);
        } catch {
          // ignore
        }
        onExit();
      })();
    }
  }, [displayCfg.big_picture, onExit, setFullscreen]);

  const handleExit = useCallback(async () => {
    try {
      await setFullscreen(false);
    } catch {
      // ignore
    }
    try {
      await persistDisplay({ big_picture: false, fullscreen: false });
    } catch {
      // ignore
    }
    if (onExit) onExit();
  }, [onExit, persistDisplay, setFullscreen]);

  const handleLaunchGame = useCallback(async (gameId) => {
    if (launchInFlightRef.current) return null;
    launchInFlightRef.current = true;
    try {
      const result = await invoke("prepare_and_launch_game", { gameId });
      if (!result.success && result.error) setError(result.error);
      else if (result.save_sync_warnings?.length) setError(result.save_sync_warnings.join("\n"));
      await loadData();
      return result;
    } catch (err) {
      const message = err?.message || String(err);
      setError(message);
      return { success: false, error: message };
    } finally {
      launchInFlightRef.current = false;
    }
  }, [loadData]);

  useEffect(() => {
    function shouldDeferImmersiveHotkey(e) {
      const selector = '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]';
      if (document.querySelector(selector)) return true;
      const t = e.target;
      if (t && typeof t.closest === "function") {
        return Boolean(t.closest(selector));
      }
      return false;
    }

    function onKeyDown(e) {
      if (shouldDeferImmersiveHotkey(e)) return;
      if (e.key === "F11") {
        e.preventDefault();
        toggleFullscreen();
        return;
      }
      if (e.key === "h" || e.key === "H") {
        e.preventDefault();
        setShowHints((v) => !v);
        return;
      }
      if (e.key === "Escape") {
        if (e.repeat) return;
        e.preventDefault();
        if (view === "details") {
          setView("library");
          selectedGameIdRef.current = null;
          setSelectedGame(null);
        } else if (view === "settings") {
          setView("library");
          loadData();
        } else if (view === "downloads") {
          setView("library");
        } else {
          handleExit();
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggleFullscreen, view, loadData, handleExit]);

  async function handleToggleFavorite(gameId) {
    try {
      const newState = await invoke("toggle_favorite", { gameId });
      setGames((prev) => {
        const nextGames = prev.map((g) =>
          g.id === gameId ? { ...g, is_favorite: newState } : g,
        );
        gamesRef.current = nextGames;
        return nextGames;
      });
      if (selectedGame?.id === gameId) setSelectedGame((prev) => ({ ...prev, is_favorite: newState }));
    } catch (err) {
      setError(err?.message || String(err));
    }
  }

  function handleSelectGame(game) {
    selectedGameIdRef.current = game.id;
    focusedGameIdRef.current = game.id;
    setSelectedGame(game);
    setView("details");
  }

  const handleSelectedIndexChange = useCallback((nextIndex) => {
    focusedGameIdRef.current = gamesRef.current[nextIndex]?.id ?? null;
    setSelectedIndex(nextIndex);
  }, []);

  let main = null;
  if (view === "downloads") {
    main = (
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          overflowY: "auto",
          overflowX: "hidden",
          overscrollBehavior: "contain",
          bgcolor: "background.default",
        }}
      >
        <RomDownloadsView immersive onBack={() => setView("library")} />
      </Box>
    );
  } else if (view === "settings") {
    main = (
      <Box
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
        <Settings
          onBack={() => {
            setView("library");
            loadData();
          }}
          rommToken={rommToken}
          rommUrl={rommUrl}
          onRommConnect={onRommConnect}
          onLibraryChange={loadData}
          onImmersiveModeChange={(enabled) => {
            if (!enabled) {
              handleExit();
            }
          }}
          onFullscreenChange={(enabled) => {
            setFullscreen(enabled);
          }}
        />
      </Box>
    );
  } else if (view === "details" && selectedGame) {
    const platformLabel =
      platformDisplayNameById.get(selectedGame.platform_id) || selectedGame.platform_id || "";
    main = (
      <ImmersiveGameDetails
        game={selectedGame}
        platformLabel={platformLabel}
        onBack={() => {
          setView("library");
          selectedGameIdRef.current = null;
          setSelectedGame(null);
        }}
        onLaunch={handleLaunchGame}
        onToggleFavorite={handleToggleFavorite}
        onGameUpdate={async (gameId) => {
          const refreshedGames = await loadData();
          const updated = refreshedGames?.find((g) => g.id === gameId);
          if (updated) setSelectedGame(updated);
        }}
        rommToken={rommToken}
        rommUrl={rommUrl}
        retroachievementsEnabled={retroachievementsEnabled}
      />
    );
  } else {
    main = (
      <ImmersiveLibrary
        loading={loading}
        error={error}
        games={games}
        selectedIndex={selectedIndex}
        onSelectedIndexChange={handleSelectedIndexChange}
        onSelectGame={handleSelectGame}
        onExitImmersive={handleExit}
        onOpenSettings={() => setView("settings")}
        onOpenDownloads={() => setView("downloads")}
      />
    );
  }

  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.default",
      }}
    >
      <AmbientAudioPlayer audio={audioCfg} />
      <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>{main}</Box>
      <ImmersiveHintBar view={view} visible={showHints} unsupportedGamepad={unsupportedGamepad} />
    </Box>
  );
}
