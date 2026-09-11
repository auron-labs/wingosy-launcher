import Box from "@mui/material/Box";

const KEYBOARD_HINT_SX = {
  border: 1,
  borderColor: "divider",
  borderRadius: 1,
  color: "text.secondary",
  display: "inline-block",
  fontFamily: "inherit",
  fontSize: "inherit",
  lineHeight: 1.4,
  px: 0.75,
  py: 0.25,
  whiteSpace: "nowrap",
};

/** @param {Omit<import("@mui/material/Box").BoxProps<"kbd">, "sx"> & {sx?: import("@mui/system").SystemStyleObject<import("@mui/material/styles").Theme>}} props Keyboard label and optional styles. */
const KeyboardHint = ({ children, sx, ...props }) => (
  <Box component="kbd" sx={{ ...KEYBOARD_HINT_SX, ...sx }} {...props}>
    {children}
  </Box>
);

export default KeyboardHint;
