import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import { alpha } from "@mui/material/styles";
import Typography from "@mui/material/Typography";

/** @param {{label: string, detail: string}} props - Hint copy. */
const Hint = ({ label, detail }) => (
  <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
    <Box
      sx={(t) => ({
        bgcolor: alpha(t.palette.common.white, 0.08),
        border: `1px solid ${alpha(t.palette.common.white, 0.12)}`,
        borderRadius: 1.25,
        px: 1,
        py: 0.35,
      })}
    >
      <Typography
        variant="body2"
        sx={{
          fontSize: { sm: "1rem", xs: "0.95rem" },
          fontWeight: 800,
          letterSpacing: "0.03em",
        }}
      >
        {label}
      </Typography>
    </Box>
    <Typography
      variant="body2"
      color="text.secondary"
      sx={{ fontSize: { sm: "1rem", xs: "0.95rem" }, fontWeight: 650 }}
    >
      {detail}
    </Typography>
  </Stack>
);

const NAVIGATION_HINTS = [
  { detail: "Navigate", label: "D-pad / Stick / Arrows" },
  { detail: "Confirm / Open", label: "South / Enter" },
  { detail: "Back", label: "East / Esc" },
  { detail: "Hide help", label: "View / H" },
];

const LIBRARY_HINTS = [
  ...NAVIGATION_HINTS.slice(0, 3),
  { detail: "Sections", label: "LB / RB / PgUp/PgDn" },
  { detail: "Menu", label: "Menu / S" },
  NAVIGATION_HINTS[3],
];

/** @param {string} view - Active immersive view. */
const getViewHints = (view) => {
  if (view === "downloads") {
    return [
      { detail: "Back to library", label: "East / Esc" },
      NAVIGATION_HINTS[3],
    ];
  }
  if (view === "library") {
    return LIBRARY_HINTS;
  }
  return NAVIGATION_HINTS;
};

/**
 * @param {{view: string, visible?: boolean, unsupportedGamepad?: boolean}} props - Hint bar state.
 */
const ImmersiveHintBar = ({
  view,
  visible = true,
  unsupportedGamepad = false,
}) => {
  if (!visible && !unsupportedGamepad) {
    return null;
  }

  const hints = [...getViewHints(view), { detail: "Fullscreen", label: "F11" }];

  return (
    <Box
      data-testid="immersive-hintbar"
      sx={(t) => ({
        WebkitBackdropFilter: "blur(10px)",
        backdropFilter: "blur(10px)",
        bgcolor: alpha(t.palette.background.paper, 0.7),
        borderRadius: 0,
        borderTop: `1px solid ${alpha(t.palette.divider, 0.6)}`,
        boxShadow: `0 -4px 24px ${alpha("#000", 0.25)}`,
        flexShrink: 0,
        minHeight: 64,
        px: { sm: 2.25, xs: 1.5 },
        py: 1.5,
        width: "100%",
      })}
    >
      {unsupportedGamepad ? (
        <Typography
          component="output"
          variant="body2"
          color="warning.main"
          sx={{
            display: "block",
            fontSize: { sm: "1rem", xs: "0.95rem" },
            fontWeight: 650,
            mb: visible ? 1 : 0,
          }}
        >
          Unsupported controller. Use a standard/XInput controller or keyboard
          for immersive navigation.
        </Typography>
      ) : null}
      {visible ? (
        <Stack
          direction="row"
          spacing={1.5}
          divider={
            <Divider flexItem orientation="vertical" sx={{ opacity: 0.16 }} />
          }
          sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 0.75 }}
        >
          {hints.map((h) => (
            <Hint
              key={`${h.label}-${h.detail}`}
              label={h.label}
              detail={h.detail}
            />
          ))}
        </Stack>
      ) : null}
    </Box>
  );
};

export default ImmersiveHintBar;