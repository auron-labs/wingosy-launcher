import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import LockIcon from "@mui/icons-material/Lock";
import AchievementListOverlay from "./AchievementListOverlay";

const TROPHY_AMBER = "#FFB300";

/**
 * Argosy-style ACHIEVEMENTS header + (unlocked/total) + horizontal strip of badges.
 * Shows 0/0 until RetroAchievements is enabled; still 0/0 until real data exists.
 */
export default function GameAchievementsSection({
  gameName,
  retroAchievementsEnabled,
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
            <Typography variant="body2" color="text.secondary">
              ({displayUnlocked}/{displayTotal})
            </Typography>
          </Box>
          <Button size="small" variant="outlined" onClick={() => setOverlayOpen(true)}>
            View all
          </Button>
        </Box>

        {!retroAchievementsEnabled ? (
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: "block" }}>
            Enable RetroAchievements in Settings → Integrations to track progress.
          </Typography>
        ) : null}

        {/* Argosy-style horizontal badge strip */}
        <Box sx={{ display: "flex", gap: 1.5, overflowX: "auto", pb: 0.5 }}>
          {total > 0
            ? achievements.slice(0, 12).map((a) => (
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
              ))
            : Array.from({ length: 6 }).map((_, i) => (
                <Box
                  key={i}
                  sx={{
                    width: 72,
                    height: 72,
                    borderRadius: 1,
                    bgcolor: "action.hover",
                    border: 1,
                    borderColor: "divider",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    opacity: retroAchievementsEnabled ? 0.5 : 0.35,
                  }}
                >
                  <LockIcon fontSize="small" color="disabled" />
                </Box>
              ))}
        </Box>
      </Box>

      <AchievementListOverlay
        open={overlayOpen}
        onClose={() => setOverlayOpen(false)}
        gameTitle={gameName}
        retroAchievementsEnabled={retroAchievementsEnabled}
        achievements={achievements}
      />
    </>
  );
}
