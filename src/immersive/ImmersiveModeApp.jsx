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

  useGamepadKeyboardMapper({ enabled: true });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [gamesData, platformsData, cfg] = await Promise.all([
        invoke("get_all_games"),
        invoke("get_platforms_with_games"),
        invoke("get_config"),
      ]);
      setGames(gamesData);
      setPlatforms(platformsData);
      setDisplayCfg({
        big_picture: Boolean(cfg.display?.big_picture),
        fullscreen: Boolean(cfg.display?.fullscreen),
      });
      setAudioCfg(cfg.audio || {});
      setRetroachievementsEnabled(Boolean(cfg.display?.retroachievements_enabled));
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
    try {
      const result = await invoke("prepare_and_launch_game", { gameId });
      if (!result.success && result.error) setError(result.error);
      else if (result.save_sync_warnings?.length) setError(result.save_sync_warnings.join("\n"));
      await loadData();
    } catch (err) {
      setError(err?.message || String(err));
    }
  }, [loadData]);

  useEffect(() => {
    function shouldDeferImmersiveHotkey(e) {
      const t = e.target;
      if (t && typeof t.closest === "function") {
        return Boolean(
          t.closest('[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]')
        );
      }
      return false;
    }

    function onKeyDown(e) {
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
      if (e.key === "Enter" && view === "details" && selectedGame) {
        if (e.repeat) return;
        if (shouldDeferImmersiveHotkey(e)) return;
        e.preventDefault();
        handleLaunchGame(selectedGame.id);
        return;
      }
      if (e.key === "Escape") {
        if (e.repeat) return;
        if (shouldDeferImmersiveHotkey(e)) return;
        e.preventDefault();
        if (view === "details") {
          setView("library");
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
  }, [toggleFullscreen, view, selectedGame, loadData, handleLaunchGame, handleExit]);

  async function handleToggleFavorite(gameId) {
    try {
      const newState = await invoke("toggle_favorite", { gameId });
      setGames((prev) => prev.map((g) => (g.id === gameId ? { ...g, is_favorite: newState } : g)));
      if (selectedGame?.id === gameId) setSelectedGame((prev) => ({ ...prev, is_favorite: newState }));
    } catch (err) {
      setError(err?.message || String(err));
    }
  }

  function handleSelectGame(game) {
    setSelectedGame(game);
    setView("details");
  }

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
          setSelectedGame(null);
        }}
        onLaunch={handleLaunchGame}
        onToggleFavorite={handleToggleFavorite}
        onGameUpdate={async (gameId) => {
          await loadData();
          const updated = games.find((g) => g.id === gameId);
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
        onSelectedIndexChange={setSelectedIndex}
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
      <ImmersiveHintBar view={view} visible={showHints} />
    </Box>
  );
}
