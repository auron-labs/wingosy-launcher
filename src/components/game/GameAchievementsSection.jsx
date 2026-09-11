import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import LockIcon from "@mui/icons-material/Lock";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import { useState } from "react";

import AchievementListOverlay from "./AchievementListOverlay";

/** @typedef {import("./game-details-types").GameDetailsAchievementsAchievement} Achievement */

const TROPHY_AMBER = "#FFB300";
const EMPTY_ACHIEVEMENTS = [];

/** @param {{enabled: boolean, total: number, onOpenIntegrations: (() => void)|null}} props Renders the section empty state. */
const AchievementsEmptyState = ({ enabled, onOpenIntegrations, total }) => {
  if (enabled && total > 0) {
    return null;
  }
  const disabled = !enabled;
  return (
    <Box
      data-testid={disabled ? "achievements-disabled-empty" : "achievements-empty"}
      sx={{
        alignItems: "center",
        bgcolor: "action.hover",
        border: 1,
        borderColor: "divider",
        borderRadius: 2,
        display: "flex",
        gap: 2,
        p: 2,
      }}
    >
      <EmojiEventsIcon sx={{ color: TROPHY_AMBER, fontSize: 34, opacity: 0.75 }} />
      <Typography color="text.secondary" variant="body2">
        {disabled
          ? "RetroAchievements is turned off."
          : "No RetroAchievements data is available for this game yet."}
        {disabled && " "}
        {disabled && (
          <IntegrationLink onOpenIntegrations={onOpenIntegrations} />
        )}
      </Typography>
    </Box>
  );
};

/** @param {{achievements: Achievement[]}} props Renders achievement badge tiles. */
const AchievementTiles = ({ achievements }) => (
  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, pb: 0.5 }}>
    {achievements.slice(0, 12).map((achievement) => (
      <Box
        key={achievement.id}
        sx={{
          alignItems: "center",
          bgcolor: achievement.unlocked ? "action.selected" : "action.hover",
          border: 1,
          borderColor: achievement.unlocked ? "warning.main" : "divider",
          borderRadius: 1,
          display: "flex",
          flexShrink: 0,
          height: 72,
          justifyContent: "center",
          width: 72,
        }}
      >
        {achievement.unlocked ? (
          <EmojiEventsIcon sx={{ color: TROPHY_AMBER }} />
        ) : (
          <LockIcon color="disabled" fontSize="small" />
        )}
      </Box>
    ))}
  </Box>
);

/** @param {{onOpenIntegrations: (() => void)|null}} props Renders the disabled-state navigation link. */
const IntegrationLink = ({ onOpenIntegrations }) => (
  <Link
    href="#settings/integrations"
    onClick={(event) => {
      if (onOpenIntegrations) {
        event.preventDefault();
        onOpenIntegrations();
      }
    }}
  >
    Enable it in Settings → Integrations.
  </Link>
);

/**
 * @param {object} props
 * @param {string} props.gameName Game name shown by the overlay.
 * @param {boolean} props.retroAchievementsEnabled Integration state.
 * @param {(() => void)|null} [props.onOpenIntegrations] Settings navigation callback.
 * @param {Achievement[]} [props.achievements] Achievement rows.
 */
const GameAchievementsSection = ({
  achievements = EMPTY_ACHIEVEMENTS,
  gameName,
  onOpenIntegrations = null,
  retroAchievementsEnabled,
}) => {
  const [overlayOpen, setOverlayOpen] = useState(false);
  const total = achievements.length;
  const unlocked = achievements.filter((achievement) => achievement.unlocked).length;
  const showData = retroAchievementsEnabled && total > 0;
  return (
    <>
      <Box sx={{ mb: 3 }}>
        <Box
          sx={{
            alignItems: "center",
            display: "flex",
            flexWrap: "wrap",
            gap: 1,
            justifyContent: "space-between",
            mb: 1.5,
          }}
        >
          <Box sx={{ alignItems: "center", display: "flex", gap: 1 }}>
            <EmojiEventsIcon sx={{ color: TROPHY_AMBER, fontSize: 22 }} />
            <Typography
              sx={{ color: "primary.main", fontWeight: 800, letterSpacing: 0.8 }}
              variant="subtitle2"
            >
              ACHIEVEMENTS
            </Typography>
            {showData && <Typography color="text.secondary" variant="body2">({unlocked}/{total})</Typography>}
          </Box>
          {showData && <Button onClick={() => setOverlayOpen(true)} size="small" variant="outlined">View all</Button>}
        </Box>
        {showData ? (
          <AchievementTiles achievements={achievements} />
        ) : (
          <AchievementsEmptyState
            enabled={retroAchievementsEnabled}
            onOpenIntegrations={onOpenIntegrations}
            total={total}
          />
        )}
      </Box>
      <AchievementListOverlay
        achievements={achievements}
        gameTitle={gameName}
        onClose={() => setOverlayOpen(false)}
        onOpenIntegrations={onOpenIntegrations}
        open={overlayOpen}
        retroAchievementsEnabled={retroAchievementsEnabled}
      />
    </>
  );
};

export default GameAchievementsSection;
