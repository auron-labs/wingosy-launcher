import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ClearIcon from "@mui/icons-material/Clear";
import SearchIcon from "@mui/icons-material/Search";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";

import LauncherIcon from "../components/launcher-icon";
import { platformBadgeLabel } from "../utils/platform-icons";
import {
  IMMERSIVE_ACCENT_GLOW,
  IMMERSIVE_SPINE_WIDTH,
} from "./immersive-shell-utils";

/** @typedef {import("./immersive-shell-utils").SpinePlatformOption} SpinePlatformOption */

/** @param {{active?: boolean, color?: string}} props Bracket overlay properties. */
export const FocusBrackets = ({ active = true, color = "#a5b4fc" }) => {
  if (!active) {
    return null;
  }
  /** @type {Record<string, string>} */
  const horizontalArm = {
    backgroundColor: color,
    height: "3px",
    left: "0",
    position: "absolute",
    right: "0",
    top: "0",
  };
  /** @type {Record<string, string>} */
  const verticalArm = {
    backgroundColor: color,
    bottom: "0",
    left: "0",
    position: "absolute",
    top: "0",
    width: "3px",
  };
  const corners = [
    {
      horizontal: {},
      id: "top-left",
      placement: { left: 0, top: 0 },
      vertical: {},
    },
    {
      horizontal: {},
      id: "top-right",
      placement: { right: 0, top: 0 },
      vertical: { left: "auto", right: "0" },
    },
    {
      horizontal: { bottom: "0", top: "auto" },
      id: "bottom-left",
      placement: { bottom: 0, left: 0 },
      vertical: {},
    },
    {
      horizontal: { bottom: "0", top: "auto" },
      id: "bottom-right",
      placement: { bottom: 0, right: 0 },
      vertical: { left: "auto", right: "0" },
    },
  ];
  return (
    <Box
      aria-hidden="true"
      sx={{ inset: -7, pointerEvents: "none", position: "absolute" }}
    >
      {corners.map((corner) => (
        <Box
          key={corner.id}
          sx={{
            height: 18,
            position: "absolute",
            width: 18,
            ...corner.placement,
          }}
        >
          <Box sx={{ ...horizontalArm, ...corner.horizontal }} />
          <Box sx={{ ...verticalArm, ...corner.vertical }} />
        </Box>
      ))}
    </Box>
  );
};

/** @param {{coverSrc: string|null, reducedMotion: boolean}} props Backdrop properties. */
export const HeroBackdrop = ({ coverSrc, reducedMotion }) => (
  <Box
    aria-hidden="true"
    sx={{ inset: 0, overflow: "hidden", position: "absolute" }}
  >
    {coverSrc === null ? null : (
      <Box
        component="img"
        draggable={false}
        src={coverSrc}
        sx={{
          filter: "saturate(1.15)",
          height: "100%",
          objectFit: "cover",
          objectPosition: "center 20%",
          opacity: 0.9,
          transition: reducedMotion ? "none" : "opacity 0.45s ease",
          width: "100%",
        }}
      />
    )}
    <Box
      sx={{
        background:
          "linear-gradient(90deg, rgba(5,7,14,0.96) 0%, rgba(5,7,14,0.88) 30%, rgba(5,7,14,0.45) 62%, rgba(5,7,14,0.25) 100%), linear-gradient(0deg, rgba(5,7,14,0.98) 0%, rgba(5,7,14,0.55) 42%, rgba(5,7,14,0.05) 75%)",
        inset: 0,
        position: "absolute",
      }}
    />
  </Box>
);

/** @param {{selected: boolean}} props Spine marker properties. */
const SpineMarker = ({ selected }) => (
  <Box
    aria-hidden="true"
    sx={{
      bgcolor: "primary.main",
      borderRadius: 2,
      bottom: 6,
      boxShadow: selected ? `0 0 12px ${IMMERSIVE_ACCENT_GLOW}` : "none",
      opacity: selected ? 1 : 0,
      position: "absolute",
      right: -13,
      top: 6,
      transition: "opacity 0.2s ease",
      width: 4,
    }}
  />
);

/** @param {{option: SpinePlatformOption, selected: boolean}} props Spine badge properties. */
const SpineBadge = ({ option, selected }) => {
  const badge =
    option.id === null ? "✳" : (platformBadgeLabel(option.id) ?? "•");
  return (
    <Box
      sx={{
        alignItems: "center",
        border: selected
          ? "1px solid rgba(165, 180, 252, 0.9)"
          : "1px solid rgba(255,255,255,0.18)",
        borderRadius: "50%",
        color: selected ? "primary.light" : "text.secondary",
        display: "flex",
        flexShrink: 0,
        fontSize: selected ? "0.8rem" : "0.7rem",
        fontWeight: 800,
        height: selected ? 44 : 36,
        justifyContent: "center",
        letterSpacing: "0.04em",
        width: selected ? 44 : 36,
      }}
    >
      {badge}
    </Box>
  );
};

/** @param {{option: SpinePlatformOption, selected: boolean}} props Spine label properties. */
const SpineLabels = ({ option, selected }) => (
  <Box sx={{ minWidth: 0, textAlign: "left" }}>
    <Typography
      sx={{
        fontSize: selected ? "1.25rem" : "1rem",
        fontWeight: selected ? 800 : 600,
        lineHeight: 1.15,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
    >
      {option.label}
    </Typography>
    {option.subtitle !== null &&
    option.subtitle !== undefined &&
    option.subtitle !== "" ? (
      <Typography
        sx={{
          color: selected ? "primary.light" : "text.secondary",
          fontSize: "0.85rem",
          fontWeight: 600,
          lineHeight: 1.2,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {option.subtitle}
      </Typography>
    ) : null}
  </Box>
);

/** @param {{option: SpinePlatformOption, selected: boolean, buttonRef: (element: HTMLButtonElement|null) => void, onSelect: (platform: string|null) => void}} props Spine entry properties. */
const SpineEntry = ({ option, selected, buttonRef, onSelect }) => (
  <Box sx={{ position: "relative" }}>
    <SpineMarker selected={selected} />
    <Button
      ref={buttonRef}
      data-immersive-platform-filter={option.id ?? "all"}
      aria-label={option.label}
      aria-pressed={selected}
      onClick={() => {
        onSelect(option.id);
      }}
      sx={{
        "&:focus-visible": {
          outline: "2px solid",
          outlineColor: "primary.light",
          outlineOffset: 2,
        },
        bgcolor: selected ? "rgba(129, 140, 248, 0.12)" : "transparent",
        borderRadius: 2,
        color: selected ? "common.white" : "text.secondary",
        display: "flex",
        justifyContent: "flex-start",
        px: 1.5,
        py: selected ? 1.25 : 1,
        textTransform: "none",
        transform: selected ? "scale(1.03)" : "scale(1)",
        transformOrigin: "left center",
        width: "100%",
      }}
    >
      <Stack
        direction="row"
        spacing={1.5}
        sx={{ alignItems: "center", minWidth: 0 }}
      >
        <SpineBadge option={option} selected={selected} />
        <SpineLabels option={option} selected={selected} />
      </Stack>
    </Button>
  </Box>
);

/** @param {{options: SpinePlatformOption[], selectedPlatform: string|null, platformButtonRefs: {current: (HTMLButtonElement|null)[]}, onSelectedPlatformChange: (platform: string|null) => void}} props Spine properties. */
export const PlatformSpine = ({
  options,
  selectedPlatform,
  platformButtonRefs,
  onSelectedPlatformChange,
}) => (
  <Box
    component="nav"
    aria-label="Platforms"
    sx={{
      borderRight: "1px solid rgba(255,255,255,0.08)",
      display: "flex",
      flexDirection: "column",
      flexShrink: 0,
      gap: 0.5,
      height: "100%",
      overflowY: "auto",
      px: 2.5,
      py: 3,
      width: IMMERSIVE_SPINE_WIDTH,
    }}
  >
    <Box
      sx={{ alignItems: "center", display: "flex", gap: 1.25, mb: 3, px: 0.5 }}
    >
      <LauncherIcon size={34} />
      <Typography
        sx={{
          color: "primary.light",
          fontSize: "1.5rem",
          fontWeight: 800,
          letterSpacing: "-0.02em",
        }}
      >
        Wingosy
      </Typography>
    </Box>
    <Typography
      variant="overline"
      color="text.secondary"
      sx={{
        display: "block",
        fontWeight: 700,
        letterSpacing: "0.28em",
        mb: 1,
        px: 0.5,
      }}
    >
      Platforms
    </Typography>
    <Stack spacing={0.5}>
      {options.map((option, index) => (
        <SpineEntry
          key={option.id ?? "all-platforms"}
          option={option}
          selected={selectedPlatform === option.id}
          buttonRef={(element) => {
            platformButtonRefs.current[index] = element;
          }}
          onSelect={onSelectedPlatformChange}
        />
      ))}
    </Stack>
  </Box>
);

/** @param {{id: string, label: string, active: boolean, onSelect: (section: string) => void}} props Section tab properties. */
const SectionTab = ({ id, label, active, onSelect }) => (
  <Button
    aria-current={active ? "page" : undefined}
    onClick={() => {
      onSelect(id);
    }}
    sx={{
      "&:focus-visible": {
        outline: "2px solid",
        outlineColor: "primary.light",
        outlineOffset: 4,
      },
      borderRadius: 0,
      color: active ? "common.white" : "text.secondary",
      fontSize: "1.05rem",
      fontWeight: active ? 700 : 500,
      minWidth: 0,
      position: "relative",
      px: 0.5,
      py: 1,
      textTransform: "none",
    }}
  >
    {label}
    <Box
      aria-hidden="true"
      sx={{
        bgcolor: "primary.light",
        borderRadius: 2,
        bottom: 2,
        height: 2,
        left: 4,
        opacity: active ? 1 : 0,
        position: "absolute",
        right: 4,
      }}
    />
  </Button>
);

/** @param {{section: string|null, onSectionChange: ((section: string) => void)|null}} props Section tab properties. */
const SectionTabs = ({ section, onSectionChange }) => {
  const tabs = [
    { id: "all", label: "Library" },
    { id: "favorites", label: "Favorites" },
    { id: "recent", label: "Recent" },
  ];
  /** @param {string} id Selected section identifier. */
  const handleSelect = (id) => {
    onSectionChange?.(id);
  };
  return (
    <Stack direction="row" spacing={3} sx={{ alignItems: "center" }}>
      {tabs.map((tab) => (
        <SectionTab
          key={tab.id}
          id={tab.id}
          label={tab.label}
          active={section === null ? tab.id === "all" : section === tab.id}
          onSelect={handleSelect}
        />
      ))}
    </Stack>
  );
};

/** @param {{searchInputRef: {current: HTMLInputElement|null}, searchQuery: string, onSearchChange: (query: string) => void}} props Header search properties. */
export const HeaderSearch = ({
  searchInputRef,
  searchQuery,
  onSearchChange,
}) => (
  <TextField
    inputRef={searchInputRef}
    data-testid="immersive-game-search"
    label="Search games by name"
    placeholder="Search by game name"
    size="small"
    value={searchQuery}
    onChange={(event) => {
      onSearchChange(event.target.value);
    }}
    sx={{
      "& .MuiOutlinedInput-root": {
        "& fieldset": { borderColor: "rgba(255,255,255,0.16)" },
        borderRadius: 2,
        color: "common.white",
      },
      width: { lg: 260, md: 210, xs: 160 },
    }}
    slotProps={{
      input: {
        endAdornment:
          searchQuery === "" ? null : (
            <InputAdornment position="end">
              <IconButton
                aria-label="Clear game search"
                edge="end"
                size="small"
                onPointerDown={(event) => {
                  event.stopPropagation();
                }}
                onMouseDown={(event) => {
                  event.preventDefault();
                }}
                onClick={() => {
                  onSearchChange("");
                  searchInputRef.current?.focus?.();
                }}
                sx={{ color: "text.secondary" }}
              >
                <ClearIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          ),
        startAdornment: (
          <InputAdornment position="start">
            <SearchIcon sx={{ color: "text.secondary" }} fontSize="small" />
          </InputAdornment>
        ),
      },
    }}
  />
);

/** @param {{section: string|null, onSectionChange: ((section: string) => void)|null, searchInputRef: {current: HTMLInputElement|null}, searchQuery?: string, onSearchChange?: (query: string) => void, menuLabel?: string, onOpenMenu?: () => void}} props Top bar properties. */
export const ImmersiveTopBar = ({
  section,
  onSectionChange,
  searchInputRef,
  searchQuery = "",
  onSearchChange,
  menuLabel = "Menu",
  onOpenMenu,
}) => (
  <Box
    sx={{
      alignItems: "center",
      display: "flex",
      flexWrap: "wrap",
      gap: 2,
      justifyContent: "space-between",
      px: { lg: 5, md: 4, xs: 2.5 },
      py: 1.5,
      rowGap: 1,
    }}
  >
    <SectionTabs section={section} onSectionChange={onSectionChange} />
    <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
      {onSearchChange ? (
        <HeaderSearch
          searchInputRef={searchInputRef}
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
        />
      ) : null}
      {onOpenMenu ? (
        <Button
          onClick={onOpenMenu}
          sx={{
            color: "text.secondary",
            fontSize: "1rem",
            fontWeight: 600,
            textTransform: "none",
          }}
        >
          {menuLabel}
        </Button>
      ) : null}
    </Stack>
  </Box>
);

/** @param {{installed: boolean}} props Installed marker properties. */
export const InstalledMarker = ({ installed }) => {
  if (!installed) {
    return null;
  }
  return (
    <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
      <CheckCircleIcon sx={{ color: "primary.light", fontSize: "1.1rem" }} />
      <Typography
        sx={{ color: "primary.light", fontSize: "0.95rem", fontWeight: 600 }}
      >
        Installed
      </Typography>
    </Stack>
  );
};

/** @param {{children: import("react").ReactNode}} props Shell layout properties. */
export const ImmersiveShellLayout = ({ children }) => {
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  return (
    <Box
      sx={{
        bgcolor: "#070a13",
        color: "common.white",
        display: "flex",
        flex: 1,
        minHeight: 0,
        overflow: "hidden",
      }}
      data-immersive-reduced-motion={reducedMotion ? "true" : undefined}
    >
      {children}
    </Box>
  );
};
