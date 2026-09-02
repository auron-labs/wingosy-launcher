import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Divider from "@mui/material/Divider";
import { alpha } from "@mui/material/styles";

function Hint({ label, detail }) {
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
      <Box
        sx={(t) => ({
          px: 1,
          py: 0.35,
          borderRadius: 1.25,
          bgcolor: alpha(t.palette.common.white, 0.08),
          border: `1px solid ${alpha(t.palette.common.white, 0.12)}`,
        })}
      >
        <Typography
          variant="body2"
          sx={{ fontWeight: 800, letterSpacing: "0.03em", fontSize: { xs: "0.95rem", sm: "1rem" } }}
        >
          {label}
        </Typography>
      </Box>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ fontWeight: 650, fontSize: { xs: "0.95rem", sm: "1rem" } }}
      >
        {detail}
      </Typography>
    </Stack>
  );
}

export default function ImmersiveHintBar({ view, visible = true, unsupportedGamepad = false }) {
  if (!visible && !unsupportedGamepad) return null;

  const viewHints =
    view === "details"
      ? [
          { label: "D-pad / Stick / Arrows", detail: "Navigate" },
          { label: "South / Enter", detail: "Confirm / Open" },
          { label: "East / Esc", detail: "Back" },
          { label: "View / H", detail: "Hide help" },
        ]
      : view === "settings"
        ? [
            { label: "D-pad / Stick / Arrows", detail: "Navigate" },
            { label: "South / Enter", detail: "Confirm / Open" },
            { label: "East / Esc", detail: "Back" },
            { label: "View / H", detail: "Hide help" },
          ]
        : view === "downloads"
          ? [
              { label: "East / Esc", detail: "Back to library" },
              { label: "View / H", detail: "Hide help" },
            ]
          : [
              { label: "D-pad / Stick / Arrows", detail: "Navigate" },
              { label: "South / Enter", detail: "Confirm / Open" },
              { label: "East / Esc", detail: "Back" },
              { label: "LB / RB / PgUp/PgDn", detail: "Sections" },
              { label: "Menu / S", detail: "Menu" },
              { label: "View / H", detail: "Hide help" },
            ];
  const hints = [...viewHints, { label: "F11", detail: "Fullscreen" }];

  return (
    <Box
      data-testid="immersive-hintbar"
      sx={(t) => ({
        flexShrink: 0,
        width: "100%",
        minHeight: 64,
        px: { xs: 1.5, sm: 2.25 },
        py: 1.5,
        borderTop: `1px solid ${alpha(t.palette.divider, 0.6)}`,
        borderRadius: 0,
        bgcolor: alpha(t.palette.background.paper, 0.7),
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        boxShadow: `0 -4px 24px ${alpha("#000", 0.25)}`,
      })}
    >
      {unsupportedGamepad ? (
        <Typography
          role="status"
          variant="body2"
          color="warning.main"
          sx={{ display: "block", mb: visible ? 1 : 0, fontWeight: 650, fontSize: { xs: "0.95rem", sm: "1rem" } }}
        >
          Unsupported controller. Use a standard/XInput controller or keyboard for immersive navigation.
        </Typography>
      ) : null}
      {visible ? (
        <Stack
          direction="row"
          spacing={1.5}
          divider={<Divider flexItem orientation="vertical" sx={{ opacity: 0.16 }} />}
          sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 0.75 }}
        >
          {hints.map((h) => (
            <Hint key={`${h.label}-${h.detail}`} label={h.label} detail={h.detail} />
          ))}
        </Stack>
      ) : null}
    </Box>
  );
}
