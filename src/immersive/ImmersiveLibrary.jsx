import { useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import { alpha } from "@mui/material/styles";
import ImmersiveGameTile from "./ImmersiveGameTile";
import {
  describeControllerElement,
  getControllerAction,
  logControllerOutcome,
} from "./controllerDebug";
import LauncherIcon from "../components/LauncherIcon";
import { useAppTheme } from "../ThemeContext";
import { useRomDownloads } from "../RomDownloadsContext";
import CloudDownloadIcon from "@mui/icons-material/CloudDownload";
import Badge from "@mui/material/Badge";

const SECTIONS = ["all", "favorites", "recent"];

function byLastPlayedDesc(a, b) {
  const ax = a.last_played_at || "";
  const bx = b.last_played_at || "";
  return bx.localeCompare(ax);
}

function getColumnsForWidth(width) {
  if (width >= 1200) return 6;
  if (width >= 900) return 4;
  if (width >= 600) return 3;
  return 2;
}

function focusFirstGame(grid) {
  const firstGame =
    grid?.querySelector?.('[data-immersive-index="0"] button') ||
    grid?.querySelector?.('[data-immersive-index="0"]');
  firstGame?.focus?.();
}

function useColumnCount() {
  const [columns, setColumns] = useState(() =>
    typeof window === "undefined" ? 6 : getColumnsForWidth(window.innerWidth)
  );

  useEffect(() => {
    function handleResize() {
      setColumns(getColumnsForWidth(window.innerWidth));
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return columns;
}

export default function ImmersiveLibrary({
  loading,
  error,
  games,
  platforms = [],
  selectedPlatform = null,
  onSelectedPlatformChange = (_platformId) => {},
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
  const platformButtonRefs = useRef([]);
  const { colors } = useAppTheme();
  const { getProgress, activeCount } = useRomDownloads();
  const columns = useColumnCount();

  const platformOptions = useMemo(
    () => [
      { id: null, label: "All platforms" },
      ...platforms.map(([platform]) => ({
        id: platform.id,
        label: platform.name || platform.id,
      })),
    ],
    [platforms],
  );

  const platformGames = useMemo(
    () =>
      selectedPlatform
        ? games.filter((game) => game.platform_id === selectedPlatform)
        : games,
    [games, selectedPlatform],
  );

  const favorites = useMemo(
    () => platformGames.filter((g) => g.is_favorite),
    [platformGames],
  );

  const recent = useMemo(() => {
    const played = platformGames.filter((g) => g.last_played_at);
    played.sort(byLastPlayedDesc);
    return played.slice(0, 24);
  }, [platformGames]);

  const visibleGames = useMemo(() => {
    if (section === "favorites") return favorites;
    if (section === "recent") return recent;
    return platformGames;
  }, [section, platformGames, favorites, recent]);

  useEffect(() => {
    if (selectedIndex >= visibleGames.length) {
      onSelectedIndexChange(Math.max(0, visibleGames.length - 1));
    }
  }, [selectedIndex, visibleGames.length, onSelectedIndexChange]);

  useEffect(() => {
    rootRef.current?.focus?.();
  }, [section]);

  useEffect(() => {
    if (loading) return undefined;

    const id = window.requestAnimationFrame(() => {
      if (!visibleGames.length) {
        rootRef.current?.focus?.();
        return;
      }
      focusFirstGame(gridRef.current);
    });
    return () => window.cancelAnimationFrame(id);
  }, [loading, section, selectedPlatform, visibleGames.length]);

  useEffect(() => {
    if (loading) return;
    if (!visibleGames.length) return;
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
    focusFirstGame(gridRef.current);
  }

  function setSectionAndReset(next) {
    setSection(next);
    onSelectedIndexChange(0);
    rootRef.current?.focus?.();
  }

  function focusPlatform(index) {
    const nextIndex = Math.max(0, Math.min(platformOptions.length - 1, index));
    platformButtonRefs.current[nextIndex]?.focus?.();
  }

  function handlePlatformKeyDown(e, platformButton) {
    const platformIndex = platformButtonRefs.current.indexOf(platformButton);
    if (platformIndex < 0) return false;

    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      platformButton.click();
      return true;
    }

    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      focusPlatform(platformIndex + (e.key === "ArrowRight" ? 1 : -1));
      return true;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (visibleGames.length) {
        onSelectedIndexChange(0, visibleGames[0]);
        focusFirstGame(gridRef.current);
      } else {
        rootRef.current?.focus?.();
      }
      return true;
    }

    return false;
  }

  function handleKeyDown(e) {
    const action = getControllerAction(e);
    const platformTarget =
      e.target?.closest?.("[data-immersive-platform-filter]") ||
      document.activeElement?.closest?.("[data-immersive-platform-filter]");
    if (platformTarget && handlePlatformKeyDown(e, platformTarget)) return;

    if (e.key === "F11") {
      logControllerOutcome(action, "library", "ignored", { reason: "handled-by-shell" });
      return;
    }

    if (e.key === "Escape") {
      logControllerOutcome(action, "library", "ignored", { reason: "handled-by-shell" });
      return;
    }

    if (e.key === "s" || e.key === "S") {
      e.preventDefault();
      onOpenSettings();
      logControllerOutcome(action, "library", "handled", { reason: "open-settings" });
      return;
    }

    if (e.key === "PageUp") {
      const beforeFocus = describeControllerElement(document.activeElement);
      e.preventDefault();
      cycleSection(-1);
      logControllerOutcome(action, "library", "handled", {
        reason: "cycle-section",
        beforeFocus,
        afterFocus: describeControllerElement(document.activeElement),
      });
      return;
    }

    if (e.key === "PageDown") {
      const beforeFocus = describeControllerElement(document.activeElement);
      e.preventDefault();
      cycleSection(1);
      logControllerOutcome(action, "library", "handled", {
        reason: "cycle-section",
        beforeFocus,
        afterFocus: describeControllerElement(document.activeElement),
      });
      return;
    }

    if (loading) {
      logControllerOutcome(action, "library", "ignored", { reason: "library-loading" });
      return;
    }
    if (!visibleGames.length) {
      logControllerOutcome(action, "library", "ignored", { reason: "no-visible-actions" });
      return;
    }

    if (e.key === "ArrowUp" && selectedIndex === 0 && platformOptions.length) {
      e.preventDefault();
      focusPlatform(0);
      return;
    }

    const cols = columns;
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
        logControllerOutcome(action, "library", "handled", {
          reason: "open-selected-game",
          selectedIndex,
        });
        return;
      default:
        return;
    }

    const beforeFocus = describeControllerElement(document.activeElement);
    if (next === selectedIndex) {
      logControllerOutcome(action, "library", "ignored", {
        reason: "focus-boundary",
        beforeFocus,
        afterFocus: beforeFocus,
      });
      return;
    }

    e.preventDefault();
    onSelectedIndexChange(next, visibleGames[next]);
    const el = gridRef.current?.querySelector?.(
      `[data-immersive-index="${next}"]`,
    );
    el?.focus?.();
    try {
      el?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    } catch {
      // ignore
    }
    const afterFocus = describeControllerElement(document.activeElement);
    if (!el) {
      logControllerOutcome(action, "library", "ignored", {
        reason: "focus-target-missing",
        beforeFocus,
        afterFocus,
        targetIndex: next,
      });
    } else {
      const focused = document.activeElement === el;
      logControllerOutcome(action, "library", focused ? "handled" : "ignored", {
        reason: focused ? "focus-moved" : "focus-target-not-focused",
        beforeFocus,
        afterFocus,
        targetFocus: describeControllerElement(el),
      });
    }
  }

  const headerSectionButtons = (
    <Stack
      direction="row"
      spacing={0.75}
      sx={{
        alignItems: "center",
        flexWrap: "wrap",
        justifyContent: "center",
        rowGap: 0.75,
      }}
    >
      {SECTIONS.map((key) => {
        const label = key === "all" ? "All" : key === "favorites" ? "Favorites" : "Recent";
        const active = section === key;
        return (
          <Button
            key={key}
            onClick={() => setSectionAndReset(key)}
            sx={{
              minWidth: 0,
              px: 2,
              py: 0.5,
              borderRadius: 1.5,
              textTransform: "none",
              fontWeight: active ? 800 : 600,
              color: active ? "#fff" : "text.secondary",
              bgcolor: active ? "primary.main" : "transparent",
              border: (t) =>
                active
                  ? "none"
                  : `1px solid ${alpha(t.palette.divider, 0.5)}`,
              boxShadow: active ? `0 0 12px ${alpha(colors.primary, 0.45)}` : "none",
              lineHeight: 1.2,
              transition: (t) =>
                t.transitions.create(["background-color", "box-shadow", "color"], {
                  duration: t.transitions.duration.short,
                }),
              "&:hover": {
                bgcolor: active ? "primary.dark" : alpha(colors.primary, 0.12),
                color: active ? "#fff" : "text.primary",
              },
            }}
          >
            {label}
          </Button>
        );
      })}
    </Stack>
  );

  const platformFilterButtons = (
    <Box sx={{ mt: 1.5 }}>
      <Typography
        variant="overline"
        color="text.secondary"
        sx={{ display: "block", mb: 0.5, fontWeight: 700, letterSpacing: "0.08em" }}
      >
        Platforms
      </Typography>
      <Stack
        direction="row"
        spacing={0.75}
        sx={{
          overflowX: "auto",
          pb: 0.5,
          scrollbarWidth: "thin",
        }}
      >
        {platformOptions.map((platform, index) => {
          const active = selectedPlatform === platform.id;
          return (
            <Button
              key={platform.id || "all-platforms"}
              ref={(element) => {
                platformButtonRefs.current[index] = element;
              }}
              data-immersive-platform-filter={platform.id || "all"}
              aria-pressed={active}
              onClick={() => onSelectedPlatformChange?.(platform.id)}
              sx={{
                flexShrink: 0,
                minWidth: 0,
                px: 1.5,
                py: 0.5,
                borderRadius: 1.5,
                textTransform: "none",
                fontWeight: active ? 800 : 600,
                color: active ? "#fff" : "text.secondary",
                bgcolor: active ? "primary.main" : "transparent",
                border: (t) =>
                  active
                    ? "none"
                    : `1px solid ${alpha(t.palette.divider, 0.5)}`,
                boxShadow: active ? `0 0 12px ${alpha(colors.primary, 0.4)}` : "none",
                lineHeight: 1.2,
                "&:hover": {
                  bgcolor: active ? "primary.dark" : alpha(colors.primary, 0.12),
                  color: active ? "#fff" : "text.primary",
                },
              }}
            >
              {platform.label}
            </Button>
          );
        })}
      </Stack>
    </Box>
  );

  const utilityButtons = (
    <Stack
      direction="row"
      spacing={0.75}
      sx={{
        alignItems: "center",
        flexWrap: "wrap",
        justifyContent: "flex-end",
        rowGap: 0.75,
      }}
    >
      {onOpenDownloads ? (
        <Badge
          color="primary"
          badgeContent={activeCount > 0 ? activeCount : 0}
          invisible={activeCount === 0}
          max={99}
        >
          <Button
            startIcon={<CloudDownloadIcon />}
            onClick={onOpenDownloads}
            sx={{
              minWidth: 0,
              px: 1.5,
              py: 0.5,
              borderRadius: 1.5,
              textTransform: "none",
              fontWeight: 600,
              color: "text.secondary",
              border: (t) => `1px solid ${alpha(t.palette.divider, 0.5)}`,
              lineHeight: 1.2,
              "&:hover": { bgcolor: alpha(colors.primary, 0.1), color: "text.primary" },
            }}
          >
            Downloads
          </Button>
        </Badge>
      ) : null}
      <Button
        onClick={onOpenSettings}
        sx={{
          minWidth: 0,
          px: 1.5,
          py: 0.5,
          borderRadius: 1.5,
          textTransform: "none",
          fontWeight: 600,
          color: "text.secondary",
          border: (t) => `1px solid ${alpha(t.palette.divider, 0.5)}`,
          lineHeight: 1.2,
          "&:hover": { bgcolor: alpha(colors.primary, 0.1), color: "text.primary" },
        }}
      >
        Settings
      </Button>
      <Button
        data-testid="immersive-exit-to-desktop"
        color="error"
        onClick={onExitImmersive}
        sx={{
          minWidth: 0,
          px: 1.5,
          py: 0.5,
          borderRadius: 1.5,
          textTransform: "none",
          fontWeight: 600,
          border: (t) => `1px solid ${alpha(t.palette.error.main, 0.5)}`,
          lineHeight: 1.2,
        }}
      >
        Exit to desktop
      </Button>
    </Stack>
  );

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
        sx={{
          px: { xs: 2, sm: 3, md: 4 },
          py: 2,
          borderBottom: (t) => `1px solid ${alpha(t.palette.divider, 0.6)}`,
          bgcolor: (t) => alpha(t.palette.background.paper, 0.45),
        }}
      >
        <Stack
          direction="row"
          spacing={2}
          sx={{
            alignItems: "center",
            flexWrap: "wrap",
            rowGap: 1.5,
            justifyContent: "space-between",
          }}
        >
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", flexWrap: "wrap" }}>
            <LauncherIcon size={36} />
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 800,
                  letterSpacing: "-0.4px",
                  lineHeight: 1.2,
                  background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryLight} 100%)`,
                  backgroundClip: "text",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                Wingosy
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontWeight: 600, letterSpacing: "0.03em", lineHeight: 1.2, display: "block" }}
              >
                Immersive mode
              </Typography>
            </Box>
          </Stack>

          {headerSectionButtons}
          {utilityButtons}
        </Stack>
        {platformFilterButtons}
      </Box>

      <Box
        ref={scrollRef}
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
          overscrollBehavior: "contain",
          px: { xs: 2, sm: 3, md: 4 },
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
            <Stack spacing={1} sx={{ alignItems: "center", textAlign: "center" }}>
              <Typography variant="h5" color="text.secondary">
                No games found.
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Try another platform or section.
              </Typography>
            </Stack>
          </Box>
        ) : (
          <Box
            ref={gridRef}
            data-testid="immersive-grid"
            sx={{
              display: "grid",
              gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
              gap: { xs: 1.5, sm: 2, md: 2.5 },
            }}
          >
            {visibleGames.map((g, idx) => (
              <Box key={g.id} data-immersive-index={idx} sx={{ p: 0.5 }}>
                <ImmersiveGameTile
                  game={g}
                  focused={idx === selectedIndex}
                  onFocus={() => onSelectedIndexChange(idx, g)}
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
