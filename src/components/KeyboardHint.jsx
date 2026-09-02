import Box from "@mui/material/Box";

const KEYBOARD_HINT_SX = {
  display: "inline-block",
  px: 0.75,
  py: 0.25,
  border: 1,
  borderColor: "divider",
  borderRadius: 1,
  color: "text.secondary",
  fontFamily: "inherit",
  fontSize: "inherit",
  lineHeight: 1.4,
  whiteSpace: "nowrap",
};

export default function KeyboardHint({ children, sx = {}, ...props }) {
  return (
    <Box component="kbd" sx={{ ...KEYBOARD_HINT_SX, ...sx }} {...props}>
      {children}
    </Box>
  );
}
