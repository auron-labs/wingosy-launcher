import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Link from "@mui/material/Link";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import LockIcon from "@mui/icons-material/Lock";
import AchievementListOverlay from "./AchievementListOverlay";

const TROPHY_AMBER = "#FFB300";

/**
 * Argosy-style ACHIEVEMENTS header + (unlocked/total) + horizontal strip of badges.
 * Shows progress only when the integration is enabled and real data exists.
 */
export default function GameAchievementsSection({
  gameName,
  retroAchievementsEnabled,
  onOpenIntegrations = null,
  /** Optional real data later */
  achievements = [],
}) {
  const [overlayOpen, setOverlayOpen] = useState(false);
  const total = achievements.length;
  const uCount = achievements.filter((a) => a.unlocked).length;
  const displayUnlocked = retroAchievementsEnabled ? uCount : 0;
  const displayTotal = retroAchievementsEnabled ? total : 0;

  return (
    <>
      <Box sx={{ mb: 3 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 1,
            mb: 1.5,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <EmojiEventsIcon sx={{ color: TROPHY_AMBER, fontSize: 22 }} />
            <Typography
              variant="subtitle2"
              sx={{ fontWeight: 800, letterSpacing: 0.8, color: "primary.main" }}
            >
              ACHIEVEMENTS
            </Typography>
            {retroAchievementsEnabled && total > 0 ? (
              <Typography variant="body2" color="text.secondary">
                ({displayUnlocked}/{displayTotal})
              </Typography>
            ) : null}
          </Box>
          {retroAchievementsEnabled && total > 0 ? (
            <Button size="small" variant="outlined" onClick={() => setOverlayOpen(true)}>
              View all
            </Button>
          ) : null}
        </Box>

        {!retroAchievementsEnabled ? (
          <Box
            data-testid="achievements-disabled-empty"
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              p: 2,
              border: 1,
              borderColor: "divider",
              borderRadius: 2,
              bgcolor: "action.hover",
            }}
          >
            <EmojiEventsIcon sx={{ color: TROPHY_AMBER, fontSize: 34, opacity: 0.75 }} />
            <Typography variant="body2" color="text.secondary">
              RetroAchievements is turned off.{" "}
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
            </Typography>
          </Box>
        ) : total === 0 ? (
          <Box
            data-testid="achievements-empty"
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              p: 2,
              border: 1,
              borderColor: "divider",
              borderRadius: 2,
              bgcolor: "action.hover",
            }}
          >
            <EmojiEventsIcon sx={{ color: TROPHY_AMBER, fontSize: 34, opacity: 0.75 }} />
            <Typography variant="body2" color="text.secondary">
              No RetroAchievements data is available for this game yet.
            </Typography>
          </Box>
        ) : null}

        {retroAchievementsEnabled && total > 0 ? (
          /* Argosy-style horizontal badge strip */
          <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", pb: 0.5 }}>
            {achievements.slice(0, 12).map((a) => (
                <Box
                  key={a.id}
                  sx={{
                    width: 72,
                    height: 72,
                    borderRadius: 1,
                    bgcolor: a.unlocked ? "action.selected" : "action.hover",
                    border: 1,
                    borderColor: a.unlocked ? "warning.main" : "divider",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {a.unlocked ? (
                    <EmojiEventsIcon sx={{ color: TROPHY_AMBER }} />
                  ) : (
                    <LockIcon fontSize="small" color="disabled" />
                  )}
                </Box>
              ))}
          </Box>
        ) : null}
      </Box>

      <AchievementListOverlay
        open={overlayOpen}
        onClose={() => setOverlayOpen(false)}
        gameTitle={gameName}
        retroAchievementsEnabled={retroAchievementsEnabled}
        onOpenIntegrations={onOpenIntegrations}
        achievements={achievements}
      />
    </>
  );
}
