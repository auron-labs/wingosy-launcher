import * as Mui from "@mui/material";

/** @typedef {{background: string, label: string, mode: string, muted: string, surface: string, text: string}} ThemePreview */

const THEME_PREVIEWS = [
  {
    background: "#fffbfe",
    label: "Light",
    mode: "light",
    muted: "#5f5f5f",
    surface: "#f5f5f5",
    text: "#1c1b1f",
  },
  {
    background: "#202124",
    label: "System",
    mode: "system",
    muted: "#bdc1c6",
    surface: "#303134",
    text: "#f1f3f4",
  },
  {
    background: "#121212",
    label: "Dark",
    mode: "dark",
    muted: "#b3b3b3",
    surface: "#1e1e1e",
    text: "#e1e1e1",
  },
];

/** @param {ThemePreview} preview Theme preview. */
const ThemePreview = (preview) => (
  <Mui.Box
    data-testid={`theme-preview-${preview.mode}`}
    aria-label={`${preview.label} theme preview`}
    sx={{
      bgcolor: preview.background,
      border: 1,
      borderColor: "divider",
      borderRadius: 2,
      p: 1,
    }}
  >
    <Mui.Typography
      variant="caption"
      sx={{ color: preview.text, fontWeight: 600 }}
    >
      {preview.label}
    </Mui.Typography>
    <Mui.Box
      sx={{
        bgcolor: preview.surface,
        borderRadius: 1,
        mt: 0.75,
        p: 1,
      }}
    >
      <Mui.Typography
        variant="caption"
        sx={{ color: preview.text, display: "block" }}
      >
        Wingosy Library
      </Mui.Typography>
      <Mui.Box sx={{ display: "flex", gap: 0.5, mt: 0.75 }}>
        <Mui.Box
          sx={{
            bgcolor: "primary.main",
            borderRadius: 0.5,
            height: 24,
            width: 18,
          }}
        />
        <Mui.Box
          sx={{
            bgcolor: preview.muted,
            borderRadius: 0.5,
            height: 24,
            width: 18,
          }}
        />
        <Mui.Box
          sx={{
            bgcolor: preview.background,
            borderRadius: 0.5,
            flex: 1,
            height: 24,
          }}
        />
      </Mui.Box>
    </Mui.Box>
    {preview.mode === "system" && (
      <Mui.Typography
        variant="caption"
        sx={{ color: preview.muted, display: "block", mt: 0.5 }}
      >
        Follows your OS preference
      </Mui.Typography>
    )}
  </Mui.Box>
);

const ThemePreviewGrid = () => (
  <Mui.Box
    sx={{
      display: "grid",
      gap: 1.5,
      gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
      mb: 3,
    }}
  >
    {THEME_PREVIEWS.map((preview) => (
      <ThemePreview key={preview.mode} {...preview} />
    ))}
  </Mui.Box>
);

export default ThemePreviewGrid;
