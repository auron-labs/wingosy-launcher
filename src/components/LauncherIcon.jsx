import Box from "@mui/material/Box";

/**
 * Raster launcher mark from `public/icon.svg` (kept in sync via `bun run icons:windows`).
 * @param {{size?: number, sx?: import("@mui/system").SystemStyleObject<import("@mui/material/styles").Theme>}} props Icon size and optional styles.
 */
const LauncherIcon = ({ size = 40, sx }) => (
  <Box
    component="img"
    src="/icon.svg"
    alt=""
    draggable={false}
    sx={{
      borderRadius: 1,
      boxShadow: (theme) =>
        theme.palette.mode === "dark"
          ? "0 1px 4px rgba(0,0,0,0.4)"
          : "0 1px 4px rgba(0,0,0,0.12)",
      display: "block",
      flexShrink: 0,
      height: size,
      minWidth: size,
      objectFit: "contain",
      width: size,
      ...sx,
    }}
  />
);

export default LauncherIcon;
