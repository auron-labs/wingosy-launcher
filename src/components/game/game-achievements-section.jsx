import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import LinearProgress from "@mui/material/LinearProgress";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import { useState } from "react";

import AchievementBadge from "./achievement-badge";
import AchievementListOverlay from "./achievement-list-overlay";
import { getAchievementStats } from "./achievement-presentation";

/** @typedef {import("./game-details-types").GameDetailsAchievementsAchievement} Achievement */

const TROPHY_AMBER = "#FFB300";
/** @type {Achievement[]} */
const EMPTY_ACHIEVEMENTS = [];

/** @param {{onOpenIntegrations: (() => void)|null}} props Renders the disabled-state navigation link. */
const IntegrationLink = ({ onOpenIntegrations }) => (
  <Link
    href="#settings/integrations"
    onClick={(event) => {
      if (onOpenIntegrations !== null) {
        event.preventDefault();
        onOpenIntegrations();
      }
    }}
  >
    Enable it in Settings → Integrations.
  </Link>
);

/** @param {{enabled: boolean, total: number, onOpenIntegrations: (() => void)|null}} props Renders the section empty state. */
const AchievementsEmptyState = ({ enabled, onOpenIntegrations, total }) => {
  if (enabled && total > 0) {
    return null;
  }
  const disabled = !enabled;
  return (
    <Box
      data-testid={
        disabled ? "achievements-disabled-empty" : "achievements-empty"
      }
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
      <EmojiEventsIcon
        sx={{ color: TROPHY_AMBER, fontSize: 34, opacity: 0.75 }}
      />
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
    {achievements.slice(0, 12).map((achievement) => {
      const unlocked = achievement.unlocked === true;
      return (
        <Box
          aria-label={`${achievement.title} (${unlocked ? "unlocked" : "locked"})`}
          data-testid={`achievement-tile-${achievement.id}`}
          key={achievement.id}
          sx={{
            alignItems: "center",
            bgcolor: unlocked ? "action.selected" : "action.hover",
            border: 1,
            borderColor: unlocked ? "warning.main" : "divider",
            borderRadius: 1,
            display: "flex",
            flexDirection: "column",
            flexShrink: 0,
            height: 72,
            justifyContent: "center",
            position: "relative",
            width: 72,
          }}
        >
          <AchievementBadge achievement={achievement} compact />
          {achievement.unlocked_hardcore === true && (
            <Typography
              component="span"
              sx={{
                bgcolor: "background.paper",
                borderRadius: 0.5,
                bottom: 2,
                color: "warning.main",
                fontSize: "0.55rem",
                fontWeight: 700,
                lineHeight: 1.2,
                position: "absolute",
                px: 0.25,
                right: 2,
              }}
            >
              HC
            </Typography>
          )}
        </Box>
      );
    })}
  </Box>
);

/** @param {{canRefresh: boolean, loading: boolean, onRefresh: (() => Promise<void>)|null, refreshing: boolean, showData: boolean, onOpen: () => void}} props Achievement actions. */
const AchievementActions = ({
  canRefresh,
  loading,
  onOpen,
  onRefresh,
  refreshing,
  showData,
}) => (
  <Box sx={{ display: "flex", gap: 1 }}>
    {canRefresh && (
      <Button
        aria-label="Refresh achievement progress"
        disabled={loading || refreshing}
        onClick={() => {
          void onRefresh?.();
        }}
        size="small"
      >
        {refreshing ? "Refreshing…" : "Refresh"}
      </Button>
    )}
    {showData && (
      <Button onClick={onOpen} size="small" variant="outlined">
        View all
      </Button>
    )}
  </Box>
);

/** @param {{error: string|null, loading: boolean, previousResult: boolean, total: number}} props Achievement status. */
const AchievementStatus = ({ error, loading, previousResult, total }) => {
  if (error !== null && total > 0) {
    return (
      <Typography
        color="error"
        data-testid={
          previousResult ? "achievements-previous-result" : "achievements-error"
        }
        role="alert"
        sx={{ mb: 1.5 }}
        variant="body2"
      >
        {previousResult
          ? "Could not refresh achievement progress. Showing previous results. "
          : "Could not load achievement progress. "}
        {error}
      </Typography>
    );
  }
  if (loading && total === 0) {
    return (
      <Typography
        color="text.secondary"
        data-testid="achievements-loading"
        variant="body2"
      >
        Loading RetroAchievements…
      </Typography>
    );
  }
  if (error !== null && total === 0) {
    return (
      <Typography
        color="error"
        data-testid="achievements-error"
        role="alert"
        variant="body2"
      >
        Could not load achievement progress: {error}
      </Typography>
    );
  }
  return null;
};

/** @param {{progress: number, total: number}} props Achievement progress summary. */
const AchievementProgress = ({ progress, total }) => {
  if (total === 0) {
    return null;
  }
  return (
    <Box sx={{ alignItems: "center", display: "flex", gap: 1.25, mb: 1.5 }}>
      <LinearProgress
        aria-label="Achievement completion"
        sx={{ borderRadius: 999, flex: 1, height: 7 }}
        value={progress}
        variant="determinate"
      />
      <Typography color="text.secondary" variant="caption">
        {progress}%
      </Typography>
    </Box>
  );
};

/** @param {{achievements: Achievement[], enabled: boolean, onOpenIntegrations: (() => void)|null, total: number}} props Achievement body. */
const AchievementBody = ({
  achievements,
  enabled,
  onOpenIntegrations,
  total,
}) => {
  if (enabled && total > 0) {
    return <AchievementTiles achievements={achievements} />;
  }
  return (
    <AchievementsEmptyState
      enabled={enabled}
      onOpenIntegrations={onOpenIntegrations}
      total={total}
    />
  );
};

/** @param {{canRefresh: boolean, earnedPoints: number, loading: boolean, onOpen: () => void, onRefresh: (() => Promise<void>)|null, refreshing: boolean, showData: boolean, total: number, totalPoints: number, unlocked: number}} props Achievement heading. */
const AchievementHeading = ({
  canRefresh,
  earnedPoints,
  loading,
  onOpen,
  onRefresh,
  refreshing,
  showData,
  total,
  totalPoints,
  unlocked,
}) => (
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
        sx={{
          color: "primary.main",
          fontWeight: 800,
          letterSpacing: 0.8,
        }}
        variant="subtitle2"
      >
        ACHIEVEMENTS
      </Typography>
      {showData && (
        <Box sx={{ alignItems: "center", display: "flex", gap: 1 }}>
          <Typography color="text.secondary" variant="body2">
            ({unlocked}/{total})
          </Typography>
          <Typography color="text.secondary" variant="caption">
            {earnedPoints}/{totalPoints} pts
          </Typography>
        </Box>
      )}
    </Box>
    <AchievementActions
      canRefresh={canRefresh}
      loading={loading}
      onOpen={onOpen}
      onRefresh={onRefresh}
      refreshing={refreshing}
      showData={showData}
    />
  </Box>
);

/**
 * @param {object} props Achievement section properties.
 * @param {string} props.gameName Game name shown by the overlay.
 * @param {boolean} props.retroAchievementsEnabled Integration state.
 * @param {(() => void)|null} [props.onOpenIntegrations] Settings navigation callback.
 * @param {Achievement[]} [props.achievements] Achievement rows.
 * @param {string|null} [props.error] Achievement loading error.
 * @param {boolean} [props.loading] Whether the initial result is loading.
 * @param {(() => Promise<void>)|null} [props.onRefresh] Refresh callback.
 * @param {boolean} [props.previousResult] Whether data was retained after refresh failure.
 * @param {boolean} [props.refreshing] Whether an explicit refresh is active.
 */
const GameAchievementsSection = ({
  achievements = EMPTY_ACHIEVEMENTS,
  error = null,
  gameName,
  loading = false,
  onOpenIntegrations = null,
  onRefresh = null,
  previousResult = false,
  retroAchievementsEnabled,
  refreshing = false,
}) => {
  const [overlayOpen, setOverlayOpen] = useState(false);
  const { earnedPoints, progress, total, totalPoints, unlocked } =
    getAchievementStats(achievements);
  const showData = retroAchievementsEnabled && total > 0;
  const canRefresh = retroAchievementsEnabled && onRefresh !== null;
  const hasEmptyDataStatus = total === 0 && (loading || error !== null);
  return (
    <>
      <Box sx={{ mb: 3 }}>
        <AchievementHeading
          canRefresh={canRefresh}
          earnedPoints={earnedPoints}
          loading={loading}
          onOpen={() => {
            setOverlayOpen(true);
          }}
          onRefresh={onRefresh}
          refreshing={refreshing}
          showData={showData}
          total={total}
          totalPoints={totalPoints}
          unlocked={unlocked}
        />
        <AchievementStatus
          error={error}
          loading={loading}
          previousResult={previousResult}
          total={total}
        />
        {showData && <AchievementProgress progress={progress} total={total} />}
        {!hasEmptyDataStatus && (
          <AchievementBody
            achievements={achievements}
            enabled={retroAchievementsEnabled}
            onOpenIntegrations={onOpenIntegrations}
            total={total}
          />
        )}
      </Box>
      <AchievementListOverlay
        achievements={achievements}
        gameTitle={gameName}
        onClose={() => {
          setOverlayOpen(false);
        }}
        onOpenIntegrations={onOpenIntegrations}
        open={overlayOpen}
        retroAchievementsEnabled={retroAchievementsEnabled}
      />
    </>
  );
};

export default GameAchievementsSection;
