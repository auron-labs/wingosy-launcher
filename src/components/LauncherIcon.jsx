import Box from "@mui/material/Box";

/**
 * Raster launcher mark from `public/icon.svg` (kept in sync via `bun run icons:windows`).
 */
export default function LauncherIcon({ size = 40, sx = {} }) {
  return (
    <Box
      component="img"
      src="/icon.svg"
      alt=""
      draggable={false}
      sx={{
        width: size,
        height: size,
        minWidth: size,
        flexShrink: 0,
        borderRadius: 1,
        display: "block",
        objectFit: "contain",
        boxShadow: (theme) =>
          theme.palette.mode === "dark"
            ? "0 1px 4px rgba(0,0,0,0.4)"
            : "0 1px 4px rgba(0,0,0,0.12)",
        ...sx,
      }}
    />
  );
}
