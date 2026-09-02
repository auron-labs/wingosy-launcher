import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import Box from "@mui/material/Box";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Divider from "@mui/material/Divider";
import { lighten, useTheme } from "@mui/material/styles";
import LauncherIcon from "./LauncherIcon";
import FavoriteIcon from "@mui/icons-material/Favorite";
import SettingsIcon from "@mui/icons-material/Settings";
import HomeIcon from "@mui/icons-material/Home";
import CloudDownloadIcon from "@mui/icons-material/CloudDownload";
import Badge from "@mui/material/Badge";
import { useAppTheme } from "../ThemeContext";
import { useRomDownloads } from "../RomDownloadsContext";
import { tauriDragRegionProps, tauriDragRegionSx } from "../utils/isTauri";
import {
  PLATFORM_COLORS,
  platformIconSource,
  rommPlatformIconCandidates,
} from "../utils/platformIcons";

/** Integer px sizes avoid blurry subpixel scaling; square corners avoid clipping SVG edges. */
const ICON_BOX = (size) => ({
  width: size,
  height: size,
  minWidth: size,
  borderRadius: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  overflow: "visible",
  bgcolor: "transparent",
});

function PlatformIcon({ platform, rommUrl, size = 28 }) {
  const theme = useTheme();
  const baseColor = PLATFORM_COLORS[platform.id] || PLATFORM_COLORS.default;
  const color =
    theme.palette.mode === "dark" ? lighten(baseColor, 0.38) : baseColor;
  const innerPx = Math.max(18, Math.round(size * 0.92));
  const rommCandidates = rommPlatformIconCandidates(platform.id, rommUrl);

  const [rommStep, setRommStep] = useState(0);
  useEffect(() => {
    setRommStep(0);
  }, [platform.id, rommUrl]);

  const rommSrc = rommCandidates[rommStep] || null;
  const iconSource = platformIconSource(platform);

  if (rommSrc) {
    return (
      <Box sx={ICON_BOX(size)} title={platform.name}>
        <Box
          component="img"
          src={rommSrc}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setRommStep((step) => step + 1)}
          sx={{
            width: innerPx,
            height: innerPx,
            maxWidth: innerPx,
            maxHeight: innerPx,
            objectFit: "contain",
            display: "block",
            flexShrink: 0,
          }}
        />
      </Box>
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
          fontSize: Math.max(10, Math.round(size * 0.36)),
          fontWeight: 800,
          lineHeight: 1,
          color,
          letterSpacing: label.length <= 3 ? "0.02em" : "-0.02em",
          textAlign: "center",
          px: 0.25,
        }}
      >
        {label}
      </Typography>
    </Box>
  );
}

export default function Sidebar({
  platforms,
  selectedPlatform,
  onSelectPlatform,
  onNavigate,
  currentView,
  drawerWidth,
  rommUrl,
}) {
  const { colors } = useAppTheme();
  const { activeCount } = useRomDownloads();

  return (
    <Box
      sx={{
        width: drawerWidth,
        minWidth: drawerWidth,
        minHeight: 0,
        alignSelf: "stretch",
        bgcolor: "background.default",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <Box
        {...tauriDragRegionProps()}
        sx={{
          p: 2.5,
          pb: 1,
          ...tauriDragRegionSx,
        }}
      >
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <LauncherIcon size={40} />
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="h5"
              sx={{
                fontWeight: 700,
                background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryLight} 100%)`,
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
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

      <Divider sx={{ mx: 2, my: 1 }} />

      <List sx={{ px: 1 }}>
        <ListItemButton
          selected={currentView === "library" && !selectedPlatform}
          onClick={() => onSelectPlatform(null)}
          sx={{ borderRadius: 2, mb: 0.5 }}
        >
          <ListItemIcon sx={{ minWidth: 40, color: "text.secondary" }}>
            <HomeIcon />
          </ListItemIcon>
          <ListItemText primary="All Games" />
        </ListItemButton>

        <ListItemButton
          onClick={() => {
            onSelectPlatform(null);
            onNavigate("library");
          }}
          sx={{ borderRadius: 2, mb: 0.5 }}
        >
          <ListItemIcon sx={{ minWidth: 40, color: "text.secondary" }}>
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
          <ListItemIcon sx={{ minWidth: 40, color: "text.secondary" }}>
            <Badge
              color="primary"
              badgeContent={activeCount > 0 ? activeCount : 0}
              invisible={activeCount === 0}
              max={99}
            >
              <CloudDownloadIcon />
            </Badge>
          </ListItemIcon>
          <ListItemText primary="Downloads" />
        </ListItemButton>
      </List>

      <Divider sx={{ mx: 2, my: 1 }} />

      <Typography
        variant="overline"
        color="text.secondary"
        sx={{ px: 2.5, py: 0.5 }}
      >
        Platforms
      </Typography>

      <List
        sx={{
          px: 1,
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
          overscrollBehavior: "contain",
        }}
      >
        {platforms.map(([platform, count]) => (
          <ListItemButton
            key={platform.id}
            selected={selectedPlatform === platform.id}
            onClick={() => onSelectPlatform(platform.id)}
            sx={{ borderRadius: 2, mb: 0.25, py: 0.75 }}
          >
            <ListItemIcon
              sx={{
                minWidth: 40,
                justifyContent: "center",
                color: "inherit",
              }}
            >
              <PlatformIcon platform={platform} rommUrl={rommUrl} size={28} />
            </ListItemIcon>
            <ListItemText
              primary={platform.short_name || platform.name}
              slotProps={{ primary: { sx: { fontSize: "0.875rem" } } }}
            />
            <Typography variant="caption" color="text.secondary">
              {count}
            </Typography>
          </ListItemButton>
        ))}
      </List>

      <Divider sx={{ mx: 2 }} />

      <List sx={{ px: 1, pb: 1 }}>
        <ListItemButton
          selected={currentView === "settings"}
          onClick={() => onNavigate("settings")}
          sx={{ borderRadius: 2 }}
        >
          <ListItemIcon sx={{ minWidth: 40, color: "text.secondary" }}>
            <SettingsIcon />
          </ListItemIcon>
          <ListItemText primary="Settings" />
        </ListItemButton>
      </List>
    </Box>
  );
}
