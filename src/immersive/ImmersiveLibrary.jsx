import { useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import { alpha } from "@mui/material/styles";
import ImmersiveGameTile from "./ImmersiveGameTile";
import LauncherIcon from "../components/LauncherIcon";
import { useAppTheme } from "../ThemeContext";
import { useRomDownloads } from "../RomDownloadsContext";
import CloudDownloadIcon from "@mui/icons-material/CloudDownload";
import Badge from "@mui/material/Badge";

const DEFAULT_COLUMNS = 6;

const SECTIONS = ["all", "favorites", "recent"];

function byLastPlayedDesc(a, b) {
  const ax = a.last_played_at || "";
  const bx = b.last_played_at || "";
  return bx.localeCompare(ax);
}

export default function ImmersiveLibrary({
  loading,
  error,
  games,
  selectedIndex,
  onSelectedIndexChange,
  onSelectGame,
  onExitImmersive,
  onOpenSettings,
  onOpenDownloads,
}) {
  const [section, setSection] = useState("all"); // all | favorites | recent
  const gridRef = useRef(null);
  const rootRef = useRef(null);
  const scrollRef = useRef(null);
  const { colors } = useAppTheme();
  const { getProgress, activeCount } = useRomDownloads();

  const favorites = useMemo(
    () => games.filter((g) => g.is_favorite),
    [games]
  );

  const recent = useMemo(() => {
    const played = games.filter((g) => g.last_played_at);
    played.sort(byLastPlayedDesc);
    return played.slice(0, 24);
  }, [games]);

  const visibleGames = useMemo(() => {
    if (section === "favorites") return favorites;
    if (section === "recent") return recent;
    return games;
  }, [section, games, favorites, recent]);

  useEffect(() => {
    if (selectedIndex >= visibleGames.length) {
      onSelectedIndexChange(Math.max(0, visibleGames.length - 1));
    }
  }, [selectedIndex, visibleGames.length, onSelectedIndexChange]);

  useEffect(() => {
    // Ensure keyboard navigation works immediately in Immersive mode.
    // Some WebView/Tauri focus paths don't naturally focus this container.
    rootRef.current?.focus?.();
  }, [section]);

  useEffect(() => {
    if (loading) return;
    if (!visibleGames.length) return;
    // Keep the focused tile visible when navigating with keyboard/controller.
    const id = window.requestAnimationFrame(() => {
      const el = gridRef.current?.querySelector?.(`[data-immersive-index="${selectedIndex}"]`);
      if (!el) return;
      try {
        el.scrollIntoView?.({ block: "nearest", inline: "nearest" });
      } catch {
        // ignore
      }
    });
    return () => window.cancelAnimationFrame(id);
  }, [loading, selectedIndex, visibleGames.length]);

  function cycleSection(delta) {
    const idx = SECTIONS.indexOf(section);
    const next = SECTIONS[(idx + delta + SECTIONS.length) % SECTIONS.length] || "all";
    setSection(next);
    onSelectedIndexChange(0);
    rootRef.current?.focus?.();
    const el = gridRef.current?.querySelector?.(`[data-immersive-index="0"]`);
    el?.focus?.();
  }

  function handleKeyDown(e) {
    if (e.key === "F11") {
      // Let parent handler deal with it.
      return;
    }

    if (e.key === "Escape") {
      // Handled on `window` in `ImmersiveModeApp` (exit immersive / back).
      return;
    }

    if (e.key === "s" || e.key === "S") {
      e.preventDefault();
      onOpenSettings();
      return;
    }

    if (e.key === "PageUp") {
      e.preventDefault();
      cycleSection(-1);
      return;
    }

    if (e.key === "PageDown") {
      e.preventDefault();
      cycleSection(1);
      return;
    }

    if (loading) return;
    if (!visibleGames.length) return;

    const cols = DEFAULT_COLUMNS;
    let next = selectedIndex;

    switch (e.key) {
      case "ArrowLeft":
        next = Math.max(0, selectedIndex - 1);
        break;
      case "ArrowRight":
        next = Math.min(visibleGames.length - 1, selectedIndex + 1);
        break;
      case "ArrowUp":
        next = Math.max(0, selectedIndex - cols);
        break;
      case "ArrowDown":
        next = Math.min(visibleGames.length - 1, selectedIndex + cols);
        break;
      case "Enter":
        e.preventDefault();
        onSelectGame(visibleGames[selectedIndex]);
        return;
      default:
        return;
    }

    if (next !== selectedIndex) {
      e.preventDefault();
      onSelectedIndexChange(next);
      const el = gridRef.current?.querySelector?.(
        `[data-immersive-index="${next}"]`
      );
      el?.focus?.();
      try {
        el?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
      } catch {
        // ignore
      }
    }
  }

  return (
    <Box
      data-testid="immersive-library"
      tabIndex={0}
      ref={rootRef}
      onKeyDown={handleKeyDown}
      onPointerDown={() => {
        rootRef.current?.focus?.();
      }}
      sx={{
        flex: 1,
        minHeight: 0,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        outline: "none",
        bgcolor: "background.default",
        backgroundImage: `radial-gradient(1200px 420px at 12% -8%, ${alpha(colors.primary, 0.14)} 0%, transparent 55%),
          radial-gradient(900px 380px at 88% 0%, ${alpha(colors.primaryLight, 0.08)} 0%, transparent 50%)`,
      }}
    >
      <Box
        sx={(t) => ({
          px: 5,
          pt: 3.5,
          pb: 2.5,
          background: `linear-gradient(180deg, ${alpha(t.palette.background.paper, 0.88)} 0%, ${alpha(t.palette.background.paper, 0.42)} 52%, transparent 100%)`,
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
        })}
      >
        <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
          <LauncherIcon size={48} />
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 800,
                letterSpacing: "-0.6px",
                lineHeight: 1.15,
                background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryLight} 100%)`,
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Wingosy
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: "0.04em" }}>
              Immersive mode
            </Typography>
          </Box>
          <Box sx={{ flex: 1 }} />
          <Button
            variant={section === "all" ? "contained" : "outlined"}
            onClick={() => setSection("all")}
            sx={{ borderRadius: 2, px: 2.25, textTransform: "none", fontWeight: 700 }}
          >
            All
          </Button>
          <Button
            variant={section === "favorites" ? "contained" : "outlined"}
            onClick={() => setSection("favorites")}
            sx={{ borderRadius: 2, px: 2.25, textTransform: "none", fontWeight: 700 }}
          >
            Favorites
          </Button>
          <Button
            variant={section === "recent" ? "contained" : "outlined"}
            onClick={() => setSection("recent")}
            sx={{ borderRadius: 2, px: 2.25, textTransform: "none", fontWeight: 700 }}
          >
            Recent
          </Button>
          <Divider flexItem orientation="vertical" sx={{ mx: 0.5 }} />
          {onOpenDownloads ? (
            <Badge
              color="primary"
              badgeContent={activeCount > 0 ? activeCount : 0}
              invisible={activeCount === 0}
              max={99}
            >
              <Button
                variant="outlined"
                startIcon={<CloudDownloadIcon />}
                onClick={onOpenDownloads}
                sx={{ borderRadius: 2, px: 2.25, textTransform: "none", fontWeight: 700 }}
              >
                Downloads
              </Button>
            </Badge>
          ) : null}
          <Button variant="outlined" onClick={onOpenSettings} sx={{ borderRadius: 2, px: 2.25, textTransform: "none", fontWeight: 700 }}>
            Settings
          </Button>
          <Button
            data-testid="immersive-exit-to-desktop"
            color="error"
            variant="outlined"
            onClick={onExitImmersive}
            sx={{ borderRadius: 2, px: 2.25, textTransform: "none", fontWeight: 700 }}
          >
            Exit to desktop mode
          </Button>
        </Stack>
      </Box>

      <Box
        ref={scrollRef}
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
          overscrollBehavior: "contain",
          px: 5,
          py: 3,
        }}
      >
        {error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        ) : null}

        {loading ? (
          <Box
            sx={{
              height: "60vh",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
            }}
          >
            <CircularProgress color="primary" />
            <Typography variant="body2" color="text.secondary">
              Loading your library…
            </Typography>
          </Box>
        ) : visibleGames.length === 0 ? (
          <Box sx={{ height: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Typography variant="h5" color="text.secondary">
              No games found.
            </Typography>
          </Box>
        ) : (
          <Box
            ref={gridRef}
            sx={{
              display: "grid",
              gridTemplateColumns: `repeat(${DEFAULT_COLUMNS}, minmax(0, 1fr))`,
              gap: 3,
            }}
          >
            {visibleGames.map((g, idx) => (
              <Box key={g.id} data-immersive-index={idx}>
                <ImmersiveGameTile
                  game={g}
                  focused={idx === selectedIndex}
                  onFocus={() => onSelectedIndexChange(idx)}
                  onSelect={() => onSelectGame(g)}
                  downloadProgress={getProgress(g.id)}
                />
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}
