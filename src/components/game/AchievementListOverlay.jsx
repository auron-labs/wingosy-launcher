import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Dialog from "@mui/material/Dialog";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import Link from "@mui/material/Link";
import Divider from "@mui/material/Divider";
import CloseIcon from "@mui/icons-material/Close";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import LockIcon from "@mui/icons-material/Lock";
import KeyboardHint from "../KeyboardHint";

/** Argosy TrophyAmber */
const TROPHY_AMBER = "#FFB300";

/**
 * AchievementListOverlay — full-screen list with UNLOCKED / LOCKED sections (Argosy layout).
 * `achievements`: { id, title, description, points, unlocked }[]
 */
export default function AchievementListOverlay({
  open,
  onClose,
  gameTitle,
  retroAchievementsEnabled,
  onOpenIntegrations = null,
  achievements = [],
}) {
  const unlocked = achievements.filter((a) => a.unlocked);
  const locked = achievements.filter((a) => !a.unlocked);
  const total = achievements.length;
  const uCount = unlocked.length;
  const pct = total > 0 ? Math.floor((uCount * 100) / total) : 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen
      slotProps={{
        paper: {
          sx: { bgcolor: "background.default" },
        },
      }}
    >
      <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            px: 2,
            py: 2,
            borderBottom: 1,
            borderColor: "divider",
          }}
        >
          <EmojiEventsIcon sx={{ color: TROPHY_AMBER, fontSize: 28 }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" noWrap sx={{ fontWeight: 600 }}>
              {gameTitle}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Achievements
            </Typography>
          </Box>
          {retroAchievementsEnabled && total > 0 ? (
            <Typography variant="subtitle1" color="primary">
              {uCount}/{total} ({pct}%)
            </Typography>
          ) : null}
          <KeyboardHint>Esc to close</KeyboardHint>
          <IconButton onClick={onClose} aria-label="Close">
            <CloseIcon />
          </IconButton>
        </Box>

        <Box sx={{ flex: 1, overflow: "auto", px: 3, py: 2 }}>
          {!retroAchievementsEnabled ? (
            <AchievementEmptyState
              title="RetroAchievements is turned off"
              description={
                <>
                  Turn on RetroAchievements to load achievement data when supported. Visit{" "}
                  <Link
                    href="#settings/integrations"
                    onClick={(event) => handleNavigation(event, onOpenIntegrations)}
                  >
                    Settings → Integrations
                  </Link>{" "}
                  to enable it.
                </>
              }
              action="Open Integrations settings"
              onOpenIntegrations={onOpenIntegrations}
            />
          ) : total === 0 ? (
            <AchievementEmptyState
              title="No achievements yet"
              description="No RetroAchievements data is available for this game yet."
            />
          ) : (
            <>
              {unlocked.length > 0 && (
                <>
                  <Typography
                    variant="overline"
                    sx={{ color: TROPHY_AMBER, fontWeight: 700, letterSpacing: 1 }}
                  >
                    UNLOCKED ({unlocked.length})
                  </Typography>
                  {unlocked.map((a) => (
                    <AchievementRow key={a.id} achievement={a} locked={false} />
                  ))}
                </>
              )}
              {locked.length > 0 && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography
                    variant="overline"
                    color="text.secondary"
                    sx={{ fontWeight: 700, letterSpacing: 1 }}
                  >
                    LOCKED ({locked.length})
                  </Typography>
                  {locked.map((a) => (
                    <AchievementRow key={a.id} achievement={a} locked />
                  ))}
                </>
              )}
            </>
          )}
        </Box>

      </Box>
    </Dialog>
  );
}

function AchievementEmptyState({ title, description, action = null, onOpenIntegrations = null }) {
  return (
    <Box
      data-testid="achievement-empty-state"
      sx={{
        minHeight: "min(52vh, 520px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        gap: 1.5,
        px: 2,
      }}
    >
      <EmojiEventsIcon sx={{ color: TROPHY_AMBER, fontSize: 72, opacity: 0.8 }} />
      <Typography variant="h5" component="h2">
        {title}
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 560 }}>
        {description}
      </Typography>
      {action ? (
        <Button
          component="a"
          href="#settings/integrations"
          onClick={(event) => handleNavigation(event, onOpenIntegrations)}
          variant="outlined"
          sx={{ mt: 1 }}
        >
          {action}
        </Button>
      ) : null}
    </Box>
  );
}

function handleNavigation(event, callback) {
  if (!callback) return;
  event.preventDefault();
  callback();
}

function AchievementRow({ achievement, locked }) {
  return (
    <Box
      sx={{
        display: "flex",
        gap: 2,
        py: 1.5,
        alignItems: "flex-start",
        borderRadius: 2,
        bgcolor: locked ? "action.hover" : "action.selected",
        mb: 1,
        px: 1.5,
      }}
    >
      <Box
        sx={{
          width: 56,
          height: 56,
          borderRadius: 1,
          bgcolor: "background.paper",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {locked ? (
          <LockIcon color="disabled" />
        ) : (
          <EmojiEventsIcon sx={{ color: TROPHY_AMBER }} />
        )}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {achievement.title}
        </Typography>
        {achievement.description ? (
          <Typography variant="caption" color="text.secondary">
            {achievement.description}
          </Typography>
        ) : null}
      </Box>
      <Typography variant="caption" color="text.secondary">
        {achievement.points ?? 0} pts
      </Typography>
    </Box>
  );
}
