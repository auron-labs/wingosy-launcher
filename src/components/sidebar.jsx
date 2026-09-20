import { Icon } from "@iconify/react";
import CloudDownloadIcon from "@mui/icons-material/CloudDownload";
import FavoriteIcon from "@mui/icons-material/Favorite";
import HomeIcon from "@mui/icons-material/Home";
import SettingsIcon from "@mui/icons-material/Settings";
import SyncIcon from "@mui/icons-material/Sync";
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import { lighten, useTheme } from "@mui/material/styles";
import Typography from "@mui/material/Typography";
import { useState } from "react";

import { useRomDownloads } from "../rom-downloads-context-value";
import { useAppTheme } from "../theme-context";
import { tauriDragRegionProps, tauriDragRegionSx } from "../utils/is-tauri";
import {
  PLATFORM_COLORS,
  platformIconSource,
  rommPlatformIconCandidates,
} from "../utils/platform-icons";
import LauncherIcon from "./launcher-icon";

/** @param {number} size Icon box size in pixels. @returns {import("@mui/system").SxProps} Icon box styles. */
const ICON_BOX = (size) => ({
  alignItems: "center",
  bgcolor: "transparent",
  borderRadius: 0,
  display: "flex",
  flexShrink: 0,
  height: size,
  justifyContent: "center",
  minWidth: size,
  overflow: "visible",
  width: size,
});

/** @typedef {{id: string, name: string, short_name?: string|null}} SidebarPlatform */

/** @param {{candidates: string[], platform: SidebarPlatform, size: number}} props Remote platform icon properties. */
const RemotePlatformIcon = ({ candidates, platform, size }) => {
  const innerPx = Math.max(18, Math.round(size * 0.92));
  const [rommStep, setRommStep] = useState(0);
  const rommSrc = candidates[rommStep] ?? null;

  return (
    <Box sx={ICON_BOX(size)} title={platform.name}>
      <Box
        component="img"
        src={rommSrc ?? ""}
        alt=""
        loading="lazy"
        decoding="async"
        draggable={false}
        onError={() => {
          setRommStep((step) => step + 1);
        }}
        sx={{
          display: "block",
          flexShrink: 0,
          height: innerPx,
          maxHeight: innerPx,
          maxWidth: innerPx,
          objectFit: "contain",
          width: innerPx,
        }}
      />
    </Box>
  );
};

/** @param {{platform: SidebarPlatform, rommUrl?: string|null, size?: number}} props Platform icon properties. */
const PlatformIcon = ({ platform, rommUrl, size = 28 }) => {
  const theme = useTheme();
  const baseColor = PLATFORM_COLORS[platform.id] ?? PLATFORM_COLORS.default;
  const color =
    theme.palette.mode === "dark" ? lighten(baseColor, 0.38) : baseColor;
  const innerPx = Math.max(18, Math.round(size * 0.92));
  const rommCandidates = rommPlatformIconCandidates(platform.id, rommUrl);
  const iconSource = platformIconSource(platform);

  if (rommCandidates.length > 0) {
    return (
      <RemotePlatformIcon
        key={`${platform.id}:${rommUrl ?? ""}`}
        candidates={rommCandidates}
        platform={platform}
        size={size}
      />
    );
  }

  if (iconSource.kind === "bundled") {
    return (
      <Box sx={ICON_BOX(size)} title={platform.name}>
        <Icon
          icon={iconSource.value}
          width={innerPx}
          height={innerPx}
          inline={false}
          style={{ color, display: "block", flexShrink: 0 }}
        />
      </Box>
    );
  }

  const label = iconSource.value;
  return (
    <Box sx={ICON_BOX(size)} title={platform.name}>
      <Typography
        component="span"
        sx={{
          color,
          fontSize: Math.max(10, Math.round(size * 0.36)),
          fontWeight: 800,
          letterSpacing: label.length <= 3 ? "0.02em" : "-0.02em",
          lineHeight: 1,
          px: 0.25,
          textAlign: "center",
        }}
      >
        {label}
      </Typography>
    </Box>
  );
};

/** @typedef {{platforms: Array<[SidebarPlatform, number]>, selectedPlatform: string|null, onSelectPlatform: (platformId: string|null) => void, onNavigate: (view: string, options?: {filterBy?: string}) => void, currentView: string, libraryFilterBy?: string, drawerWidth: number, rommUrl?: string|null}} SidebarProps */

/** @param {{colors: Record<string, string>}} props Sidebar branding properties. */
const SidebarBrand = ({ colors }) => (
  <Box {...tauriDragRegionProps()} sx={{ p: 2.5, pb: 1, ...tauriDragRegionSx }}>
    <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
      <LauncherIcon size={40} />
      <Box sx={{ minWidth: 0 }}>
        <Typography
          variant="h5"
          sx={{
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryLight} 100%)`,
            backgroundClip: "text",
            fontWeight: 700,
            letterSpacing: "-0.5px",
          }}
        >
          Wingosy
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Game Launcher
        </Typography>
      </Box>
    </Stack>
  </Box>
);

/** @param {{allGamesSelected: boolean, favoritesSelected: boolean, currentView: string, activeCount: number, onSelectPlatform: (platformId: string|null) => void, onNavigate: (view: string, options?: {filterBy?: string}) => void}} props Main navigation properties. */
const SidebarMainLinks = ({
  activeCount,
  allGamesSelected,
  currentView,
  favoritesSelected,
  onNavigate,
  onSelectPlatform,
}) => (
  <List sx={{ px: 1 }}>
    <ListItemButton
      selected={allGamesSelected}
      aria-current={allGamesSelected ? "page" : undefined}
      onClick={() => {
        onSelectPlatform(null);
      }}
      sx={{ borderRadius: 2, mb: 0.5 }}
    >
      <ListItemIcon sx={{ color: "text.secondary", minWidth: 40 }}>
        <HomeIcon />
      </ListItemIcon>
      <ListItemText primary="All Games" />
    </ListItemButton>
    <ListItemButton
      selected={favoritesSelected}
      aria-current={favoritesSelected ? "page" : undefined}
      onClick={() => {
        onNavigate("library", { filterBy: "favorites" });
      }}
      sx={{ borderRadius: 2, mb: 0.5 }}
    >
      <ListItemIcon sx={{ color: "text.secondary", minWidth: 40 }}>
        <FavoriteIcon />
      </ListItemIcon>
      <ListItemText primary="Favorites" />
    </ListItemButton>
    <ListItemButton
      selected={currentView === "downloads"}
      onClick={() => {
        onSelectPlatform(null);
        onNavigate("downloads");
      }}
      sx={{ borderRadius: 2, mb: 0.5 }}
    >
      <ListItemIcon sx={{ color: "text.secondary", minWidth: 40 }}>
        <Badge
          color="primary"
          badgeContent={Math.max(activeCount, 0)}
          invisible={activeCount === 0}
          max={99}
        >
          <CloudDownloadIcon />
        </Badge>
      </ListItemIcon>
      <ListItemText primary="Downloads" />
    </ListItemButton>
    <ListItemButton
      selected={currentView === "romm-sync"}
      onClick={() => {
        onSelectPlatform(null);
        onNavigate("romm-sync");
      }}
      sx={{ borderRadius: 2, mb: 0.5 }}
    >
      <ListItemIcon sx={{ color: "text.secondary", minWidth: 40 }}>
        <SyncIcon />
      </ListItemIcon>
      <ListItemText primary="RomM Sync" />
    </ListItemButton>
  </List>
);

/** @param {{platforms: Array<[SidebarPlatform, number]>, selectedPlatform: string|null, onSelectPlatform: (platformId: string|null) => void, rommUrl?: string|null}} props Platform navigation properties. */
const SidebarPlatforms = ({
  platforms,
  rommUrl,
  selectedPlatform,
  onSelectPlatform,
}) => (
  <List
    sx={{
      flex: 1,
      minHeight: 0,
      overflowX: "hidden",
      overflowY: "auto",
      overscrollBehavior: "contain",
      px: 1,
    }}
  >
    {platforms.map(([platform, count]) => (
      <ListItemButton
        key={platform.id}
        selected={selectedPlatform === platform.id}
        onClick={() => {
          onSelectPlatform(platform.id);
        }}
        sx={{ borderRadius: 2, mb: 0.25, py: 0.75 }}
      >
        <ListItemIcon
          sx={{ color: "inherit", justifyContent: "center", minWidth: 40 }}
        >
          <PlatformIcon platform={platform} rommUrl={rommUrl} size={28} />
        </ListItemIcon>
        <ListItemText
          primary={platform.short_name ?? platform.name}
          slotProps={{ primary: { sx: { fontSize: "0.875rem" } } }}
        />
        <Typography variant="caption" color="text.secondary">
          {count}
        </Typography>
      </ListItemButton>
    ))}
  </List>
);

/** @param {{selected: boolean, onNavigate: (view: string) => void}} props Settings navigation properties. */
const SidebarSettings = ({ onNavigate, selected }) => (
  <List sx={{ pb: 1, px: 1 }}>
    <ListItemButton
      selected={selected}
      onClick={() => {
        onNavigate("settings");
      }}
      sx={{ borderRadius: 2 }}
    >
      <ListItemIcon sx={{ color: "text.secondary", minWidth: 40 }}>
        <SettingsIcon />
      </ListItemIcon>
      <ListItemText primary="Settings" />
    </ListItemButton>
  </List>
);

/** @param {SidebarProps} props Sidebar properties. */
const Sidebar = ({
  platforms,
  selectedPlatform,
  onSelectPlatform,
  onNavigate,
  currentView,
  libraryFilterBy = "all",
  drawerWidth,
  rommUrl,
}) => {
  const { colors } = useAppTheme();
  const { activeCount } = useRomDownloads();
  const noPlatformSelected =
    selectedPlatform === null || selectedPlatform === "";
  const allGamesSelected =
    currentView === "library" &&
    noPlatformSelected &&
    libraryFilterBy === "all";
  const favoritesSelected =
    currentView === "library" &&
    noPlatformSelected &&
    libraryFilterBy === "favorites";

  return (
    <Box
      sx={{
        alignSelf: "stretch",
        bgcolor: "background.default",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        minWidth: drawerWidth,
        overflow: "hidden",
        width: drawerWidth,
      }}
    >
      <SidebarBrand colors={colors} />
      <Divider sx={{ mx: 2, my: 1 }} />
      <SidebarMainLinks
        activeCount={activeCount}
        allGamesSelected={allGamesSelected}
        currentView={currentView}
        favoritesSelected={favoritesSelected}
        onNavigate={onNavigate}
        onSelectPlatform={onSelectPlatform}
      />
      <Divider sx={{ mx: 2, my: 1 }} />
      <Typography
        variant="overline"
        color="text.secondary"
        sx={{ px: 2.5, py: 0.5 }}
      >
        Platforms
      </Typography>
      <SidebarPlatforms
        platforms={platforms}
        rommUrl={rommUrl}
        selectedPlatform={selectedPlatform}
        onSelectPlatform={onSelectPlatform}
      />
      <Divider sx={{ mx: 2 }} />
      <SidebarSettings
        onNavigate={onNavigate}
        selected={currentView === "settings"}
      />
    </Box>
  );
};

export default Sidebar;
