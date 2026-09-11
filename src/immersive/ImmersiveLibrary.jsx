import ClearIcon from "@mui/icons-material/Clear";
import CloudDownloadIcon from "@mui/icons-material/CloudDownload";
import SearchIcon from "@mui/icons-material/Search";
import Alert from "@mui/material/Alert";
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import { alpha } from "@mui/material/styles";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useEffect, useMemo, useRef, useState } from "react";

import LauncherIcon from "../components/LauncherIcon";
import { useRomDownloads } from "../RomDownloadsContext";
import { useAppTheme } from "../ThemeContext";
import { filterVisibleGames } from "../utils/gameFilters";
import {
  describeControllerElement,
  getControllerAction,
  isTextInputTarget,
  logControllerOutcome,
} from "./controllerDebug";
import ImmersiveGameTile from "./ImmersiveGameTile";

/** @typedef {import("./immersive-types").ImmersiveGame} ImmersiveGame */
/** @typedef {import("./immersive-types").PlatformEntry} PlatformEntry */

/**
 * @typedef {Object} ImmersiveLibraryProps
 * @property {boolean} loading
 * @property {string|null} error
 * @property {ImmersiveGame[]} games
 * @property {PlatformEntry[]} [platforms]
 * @property {string|null} [selectedPlatform]
 * @property {(platformId: string|null) => void} [onSelectedPlatformChange]
 * @property {string} [searchQuery]
 * @property {(query: string) => void} [onSearchChange]
 * @property {number} selectedIndex
 * @property {(index: number, game?: ImmersiveGame) => void} onSelectedIndexChange
 * @property {(game: ImmersiveGame) => void} onSelectGame
 * @property {() => void|Promise<void>} onExitImmersive
 * @property {() => void} onOpenSettings
 * @property {() => void} [onOpenDownloads]
 */

const SECTIONS = ["all", "favorites", "recent"];

/** @param {ImmersiveGame} a @param {ImmersiveGame} b */
const byLastPlayedDesc = (a, b) => {
  const ax = a.last_played_at ?? "";
  const bx = b.last_played_at ?? "";
  return bx.localeCompare(ax);
};

/** @param {number} width */
const getColumnsForWidth = (width) => {
  if (width >= 1200) {
    return 6;
  }
  if (width >= 900) {
    return 4;
  }
  if (width >= 600) {
    return 3;
  }
  return 2;
};

/** @param {Element|null} grid */
const focusFirstGame = (grid) => {
  const firstGame =
    grid?.querySelector?.('[data-immersive-index="0"] button') ||
    grid?.querySelector?.('[data-immersive-index="0"]');
  firstGame?.focus?.();
};

/** @param {Element|null} game */
const focusGameControl = (game) => {
  const control = game?.querySelector?.("button") || game;
  control?.focus?.();
  return control;
};

const useColumnCount = () => {
  const [columns, setColumns] = useState(() =>
    typeof window === "undefined" ? 6 : getColumnsForWidth(window.innerWidth)
  );

  useEffect(() => {
    const handleResize = () => {
      setColumns(getColumnsForWidth(window.innerWidth));
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return columns;
};

/** @param {ImmersiveLibraryProps} props */
const ImmersiveLibrary = ({
  loading,
  error,
  games,
  platforms = [],
  selectedPlatform = null,
  onSelectedPlatformChange = null,
  searchQuery = "",
  onSearchChange = null,
  selectedIndex,
  onSelectedIndexChange,
  onSelectGame,
  onExitImmersive,
  onOpenSettings,
  onOpenDownloads,
}) => {
  const [section, setSection] = useState("all"); // all | favorites | recent
  const gridRef = useRef(/** @type {HTMLElement|null} */ (null));
  const rootRef = useRef(/** @type {HTMLElement|null} */ (null));
  const scrollRef = useRef(/** @type {HTMLElement|null} */ (null));
  const searchInputRef = useRef(/** @type {HTMLInputElement|null} */ (null));
  const platformButtonRefs = useRef(
    /** @type {(HTMLButtonElement|null)[]} */ ([])
  );
  const { colors } = useAppTheme();
  const { getProgress, activeCount } = useRomDownloads();
  const columns = useColumnCount();

  const platformOptions = useMemo(
    () => [
      { id: null, label: "All platforms" },
      ...platforms.map(([platform]) => ({
        id: platform.id,
        label: platform.name === "" ? platform.id : platform.name,
      })),
    ],
    [platforms]
  );

  const filteredGames = useMemo(
    () => filterVisibleGames(games, selectedPlatform, searchQuery),
    [games, searchQuery, selectedPlatform]
  );

  const favorites = useMemo(
    () => filteredGames.filter((g) => g.is_favorite === true),
    [filteredGames]
  );

  const recent = useMemo(() => {
    const played = filteredGames.filter(
      (g) =>
        g.last_played_at !== null &&
        g.last_played_at !== undefined &&
        g.last_played_at !== ""
    );
    const sorted = played.toSorted(byLastPlayedDesc);
    return sorted.slice(0, 24);
  }, [filteredGames]);

  const visibleGames = useMemo(() => {
    if (section === "favorites") {
      return favorites;
    }
    if (section === "recent") {
      return recent;
    }
    return filteredGames;
  }, [section, filteredGames, favorites, recent]);

  useEffect(() => {
    if (selectedIndex >= visibleGames.length) {
      onSelectedIndexChange(Math.max(0, visibleGames.length - 1));
    }
  }, [selectedIndex, visibleGames.length, onSelectedIndexChange]);

  useEffect(() => {
    rootRef.current?.focus?.();
  }, [section]);

  useEffect(() => {
    if (loading) {
      return undefined;
    }

    const id = window.requestAnimationFrame(() => {
      if (searchInputRef.current === document.activeElement) {
        return;
      }
      if (!visibleGames.length) {
        rootRef.current?.focus?.();
        return;
      }
      focusFirstGame(gridRef.current);
    });
    return () => {
      window.cancelAnimationFrame(id);
    };
  }, [loading, searchQuery, section, selectedPlatform, visibleGames.length]);

  useEffect(() => {
    if (loading) {
      return;
    }
    if (!visibleGames.length) {
      return;
    }
    const id = window.requestAnimationFrame(() => {
      const el = gridRef.current?.querySelector?.(
        `[data-immersive-index="${selectedIndex}"]`
      );
      if (!el) {
        return;
      }
      try {
        el.scrollIntoView?.({ block: "nearest", inline: "nearest" });
      } catch {
        // ignore
      }
    });
    return () => {
      window.cancelAnimationFrame(id);
    };
  }, [loading, selectedIndex, visibleGames.length]);

  function cycleSection(delta) {
    const idx = SECTIONS.indexOf(section);
    const next =
      SECTIONS[(idx + delta + SECTIONS.length) % SECTIONS.length] || "all";
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
    if (platformIndex === -1) {
      return false;
    }

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
    if (isTextInputTarget(e.target)) {
      logControllerOutcome(action, "library", "suppressed", {
        reason: "text-input-focused",
      });
      return;
    }
    const platformTarget =
      e.target?.closest?.("[data-immersive-platform-filter]") ||
      document.activeElement?.closest?.("[data-immersive-platform-filter]");
    if (platformTarget && handlePlatformKeyDown(e, platformTarget)) {
      return;
    }

    if (e.key === "F11") {
      logControllerOutcome(action, "library", "ignored", {
        reason: "handled-by-shell",
      });
      return;
    }

    if (e.key === "Escape") {
      logControllerOutcome(action, "library", "ignored", {
        reason: "handled-by-shell",
      });
      return;
    }

    if (e.key === "s" || e.key === "S") {
      e.preventDefault();
      onOpenSettings();
      logControllerOutcome(action, "library", "handled", {
        reason: "open-settings",
      });
      return;
    }

    if (e.key === "PageUp") {
      const beforeFocus = describeControllerElement(document.activeElement);
      e.preventDefault();
      cycleSection(-1);
      logControllerOutcome(action, "library", "handled", {
        afterFocus: describeControllerElement(document.activeElement),
        beforeFocus,
        reason: "cycle-section",
      });
      return;
    }

    if (e.key === "PageDown") {
      const beforeFocus = describeControllerElement(document.activeElement);
      e.preventDefault();
      cycleSection(1);
      logControllerOutcome(action, "library", "handled", {
        afterFocus: describeControllerElement(document.activeElement),
        beforeFocus,
        reason: "cycle-section",
      });
      return;
    }

    if (loading) {
      logControllerOutcome(action, "library", "ignored", {
        reason: "library-loading",
      });
      return;
    }
    if (!visibleGames.length) {
      logControllerOutcome(action, "library", "ignored", {
        reason: "no-visible-actions",
      });
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
      case "ArrowLeft": {
        next = Math.max(0, selectedIndex - 1);
        break;
      }
      case "ArrowRight": {
        next = Math.min(visibleGames.length - 1, selectedIndex + 1);
        break;
      }
      case "ArrowUp": {
        next = Math.max(0, selectedIndex - cols);
        break;
      }
      case "ArrowDown": {
        next = Math.min(visibleGames.length - 1, selectedIndex + cols);
        break;
      }
      case "Enter": {
        e.preventDefault();
        onSelectGame(visibleGames[selectedIndex]);
        logControllerOutcome(action, "library", "handled", {
          reason: "open-selected-game",
          selectedIndex,
        });
        return;
      }
      default: {
        return;
      }
    }

    const beforeFocus = describeControllerElement(document.activeElement);
    if (next === selectedIndex) {
      logControllerOutcome(action, "library", "ignored", {
        afterFocus: beforeFocus,
        beforeFocus,
        reason: "focus-boundary",
      });
      return;
    }

    e.preventDefault();
    onSelectedIndexChange(next, visibleGames[next]);
    const el = gridRef.current?.querySelector?.(
      `[data-immersive-index="${next}"]`
    );
    const focusTarget = focusGameControl(el);
    try {
      el?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    } catch {
      // ignore
    }
    const afterFocus = describeControllerElement(document.activeElement);
    if (el) {
      const focused = document.activeElement === focusTarget;
      logControllerOutcome(action, "library", focused ? "handled" : "ignored", {
        reason: focused ? "focus-moved" : "focus-target-not-focused",
        beforeFocus,
        afterFocus,
        targetFocus: describeControllerElement(el),
      });
    } else {
      logControllerOutcome(action, "library", "ignored", {
        reason: "focus-target-missing",
        beforeFocus,
        afterFocus,
        targetIndex: next,
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
        const label =
          key === "all" ? "All" : key === "favorites" ? "Favorites" : "Recent";
        const active = section === key;
        return (
          <Button
            key={key}
            onClick={() => {
              setSectionAndReset(key);
            }}
            sx={{
              "&:hover": {
                bgcolor: active ? "primary.dark" : alpha(colors.primary, 0.12),
                color: active ? "#fff" : "text.primary",
              },
              bgcolor: active ? "primary.main" : "transparent",
              border: (t) =>
                active ? "none" : `1px solid ${alpha(t.palette.divider, 0.5)}`,
              borderRadius: 1.5,
              boxShadow: active
                ? `0 0 12px ${alpha(colors.primary, 0.45)}`
                : "none",
              color: active ? "#fff" : "text.secondary",
              fontSize: { sm: "1rem", xs: "0.95rem" },
              fontWeight: active ? 800 : 600,
              lineHeight: 1.2,
              minHeight: 44,
              minWidth: 0,
              px: 2,
              py: 0.9,
              textTransform: "none",
              transition: (t) =>
                t.transitions.create(
                  ["background-color", "box-shadow", "color"],
                  {
                    duration: t.transitions.duration.short,
                  }
                ),
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
        sx={{
          display: "block",
          fontWeight: 700,
          letterSpacing: "0.08em",
          mb: 0.5,
        }}
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
              onClick={() => {
                onSelectedPlatformChange?.(platform.id);
              }}
              sx={{
                "&:hover": {
                  bgcolor: active
                    ? "primary.dark"
                    : alpha(colors.primary, 0.12),
                  color: active ? "#fff" : "text.primary",
                },
                bgcolor: active ? "primary.main" : "transparent",
                border: (t) =>
                  active
                    ? "none"
                    : `1px solid ${alpha(t.palette.divider, 0.5)}`,
                borderRadius: 1.5,
                boxShadow: active
                  ? `0 0 12px ${alpha(colors.primary, 0.4)}`
                  : "none",
                color: active ? "#fff" : "text.secondary",
                flexShrink: 0,
                fontWeight: active ? 800 : 600,
                lineHeight: 1.2,
                minWidth: 0,
                px: 1.5,
                py: 0.5,
                textTransform: "none",
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
              "&:hover": {
                bgcolor: alpha(colors.primary, 0.1),
                color: "text.primary",
              },
              border: (t) => `1px solid ${alpha(t.palette.divider, 0.5)}`,
              borderRadius: 1.5,
              color: "text.secondary",
              fontWeight: 600,
              lineHeight: 1.2,
              minWidth: 0,
              px: 1.5,
              py: 0.5,
              textTransform: "none",
            }}
          >
            Downloads
          </Button>
        </Badge>
      ) : null}
      <Button
        onClick={onOpenSettings}
        sx={{
          "&:hover": {
            bgcolor: alpha(colors.primary, 0.1),
            color: "text.primary",
          },
          border: (t) => `1px solid ${alpha(t.palette.divider, 0.5)}`,
          borderRadius: 1.5,
          color: "text.secondary",
          fontWeight: 600,
          lineHeight: 1.2,
          minWidth: 0,
          px: 1.5,
          py: 0.5,
          textTransform: "none",
        }}
      >
        Settings
      </Button>
      <Button
        data-testid="immersive-exit-to-desktop"
        onClick={onExitImmersive}
        sx={{
          "&:hover": {
            bgcolor: alpha(colors.primary, 0.1),
            color: "text.primary",
          },
          border: (t) => `1px solid ${alpha(t.palette.divider, 0.5)}`,
          borderRadius: 1.5,
          color: "text.secondary",
          fontWeight: 600,
          lineHeight: 1.2,
          minWidth: 0,
          px: 1.5,
          py: 0.5,
          textTransform: "none",
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
      onPointerDown={(event) => {
        if (!isTextInputTarget(event.target)) {
          rootRef.current?.focus?.();
        }
      }}
      sx={{
        backgroundImage: `radial-gradient(1200px 420px at 12% -8%, ${alpha(colors.primary, 0.14)} 0%, transparent 55%),
          radial-gradient(900px 380px at 88% 0%, ${alpha(colors.primaryLight, 0.08)} 0%, transparent 50%)`,
        bgcolor: "background.default",
        display: "flex",
        flex: 1,
        flexDirection: "column",
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          bgcolor: (t) => alpha(t.palette.background.paper, 0.45),
          borderBottom: (t) => `1px solid ${alpha(t.palette.divider, 0.6)}`,
          px: { md: 4, sm: 3, xs: 2 },
          py: 2,
        }}
      >
        <Stack
          direction="row"
          spacing={2}
          sx={{
            alignItems: "center",
            flexWrap: "wrap",
            justifyContent: "space-between",
            rowGap: 1.5,
          }}
        >
          <Stack
            direction="row"
            spacing={1.5}
            sx={{ alignItems: "center", flexWrap: "wrap" }}
          >
            <LauncherIcon size={36} />
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="h6"
                sx={{
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryLight} 100%)`,
                  backgroundClip: "text",
                  fontWeight: 800,
                  letterSpacing: "-0.4px",
                  lineHeight: 1.2,
                }}
              >
                Wingosy
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  display: "block",
                  fontWeight: 600,
                  letterSpacing: "0.03em",
                  lineHeight: 1.2,
                }}
              >
                Immersive mode
              </Typography>
            </Box>
          </Stack>

          {headerSectionButtons}
          {utilityButtons}
        </Stack>
        <TextField
          inputRef={searchInputRef}
          data-testid="immersive-game-search"
          label="Search games by name"
          placeholder="Search by game name"
          size="small"
          value={searchQuery}
          onChange={(e) => {
            onSearchChange?.(e.target.value);
          }}
          sx={{ maxWidth: 420, mt: 1.5, width: "100%" }}
          slotProps={{
            input: {
              endAdornment: searchQuery ? (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="Clear game search"
                    edge="end"
                    size="small"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                    }}
                    onClick={() => {
                      onSearchChange?.("");
                      searchInputRef.current?.focus?.();
                    }}
                  >
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : null,
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
            },
          }}
        />
        {platformFilterButtons}
      </Box>

      <Box
        ref={scrollRef}
        sx={{
          flex: 1,
          minHeight: 0,
          overflowX: "hidden",
          overflowY: "auto",
          overscrollBehavior: "contain",
          px: { md: 4, sm: 3, xs: 2 },
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
              alignItems: "center",
              display: "flex",
              flexDirection: "column",
              gap: 2,
              height: "60vh",
              justifyContent: "center",
            }}
          >
            <CircularProgress color="primary" />
            <Typography variant="body2" color="text.secondary">
              Loading your library…
            </Typography>
          </Box>
        ) : visibleGames.length === 0 ? (
          <Box
            sx={{
              height: "60vh",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Stack
              spacing={1}
              sx={{ alignItems: "center", textAlign: "center" }}
            >
              <Typography variant="h5" color="text.secondary">
                {searchQuery.trim()
                  ? "No games match your search."
                  : "No games found."}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {searchQuery.trim()
                  ? "Try a different game name or clear your search."
                  : "Try another platform or section."}
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
};

export default ImmersiveLibrary;
